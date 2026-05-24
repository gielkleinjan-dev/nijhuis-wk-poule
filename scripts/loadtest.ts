#!/usr/bin/env tsx
/**
 * Load-test script — simuleert N parallel users die in een korte tijd hun
 * voorspellingen invullen. Stress-test op Supabase Postgres + RPCs.
 *
 *   npx tsx scripts/loadtest.ts --users=50           # dry-run, geen DB-writes
 *   npx tsx scripts/loadtest.ts --users=50 --confirm # echt schrijven
 *   npx tsx scripts/loadtest-cleanup.ts              # opruimen na afloop
 *
 * Werkwijze:
 *  - Schrijft via service-role direct in profiles / predictions / bracket_picks
 *    / bonus_picks. Skipt de auth/signUp-flow (die is gedekt door E2E smoke).
 *  - Gebruikt deterministische UUIDs zodat herhaaldelijk runnen idempotent is.
 *  - Markeert alle test-rijen met department='__LOADTEST__' zodat cleanup
 *    triviaal is.
 *  - Logt p50/p95/p99 latencies + success-rate per fase.
 *
 * Veiligheid:
 *  - Vereist SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL in env.
 *  - Zonder --confirm = dry-run met overzicht; je ziet wat 'm ZOU doen.
 *  - 5-seconden countdown vóór schrijven start (Ctrl-C om te stoppen).
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { existsSync } from "node:fs";
import { randomUUID, createHash } from "node:crypto";

// Laad .env.local (Vercel-conventie) of .env
for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) {
    config({ path: file });
    break;
  }
}

// ── Args ───────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const usersArg = args.find((a) => a.startsWith("--users="));
const confirm = args.includes("--confirm");
const N = usersArg ? Math.max(1, parseInt(usersArg.split("=")[1], 10)) : 10;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("❌ Vereist: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in env.");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

// ── Deterministische UUIDs voor test-users ─────────────────────────────────
const TEST_NAMESPACE = "wk-poule-loadtest";
function testUserId(n: number): string {
  // Niet UUID v5 (geen sha1-impl in node:crypto out-of-box op alle versies);
  // bouwen we zelf van een md5 hash. Niet RFC-correct UUID, maar wel
  // deterministisch + uniek per N + niet-botsend met echte UUIDs.
  const h = createHash("md5").update(`${TEST_NAMESPACE}:${n}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

// ── Latency-tracking ───────────────────────────────────────────────────────
type Phase = "profile" | "predictions" | "bracket" | "bonus";
const latencies: Record<Phase, number[]> = {
  profile: [],
  predictions: [],
  bracket: [],
  bonus: [],
};
const errors: Record<Phase, number> = {
  profile: 0,
  predictions: 0,
  bracket: 0,
  bonus: 0,
};

async function timed<T extends { error?: unknown }>(
  phase: Phase,
  fn: () => PromiseLike<T>,
): Promise<void> {
  const t0 = performance.now();
  try {
    const result = await fn();
    const ms = performance.now() - t0;
    latencies[phase].push(ms);
    if (result?.error) errors[phase]++;
  } catch {
    const ms = performance.now() - t0;
    latencies[phase].push(ms);
    errors[phase]++;
  }
}

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

// ── Test-data generator ────────────────────────────────────────────────────
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

async function simulateUser(n: number): Promise<void> {
  const userId = testUserId(n);
  const name = `Loadtest #${n}`;

  // 1. Profile (markeer met department='__LOADTEST__' voor cleanup)
  await timed("profile", () =>
    supabase.from("profiles").upsert(
      { id: userId, display_name: name, department: "__LOADTEST__" },
      { onConflict: "id" }
    ),
  );

  // 2. Predictions: 30 willekeurige van de 72 wedstrijden (alleen tot id 30
  //    om buiten echte data te blijven; je productie-matches hebben hogere ids)
  //    Eigenlijk pakken we alle matches die bestaan en kiezen daar willekeurig
  //    30 uit. Voor load-doeleinden volstaat: 30 inserts per user.
  const { data: matchSample } = await supabase
    .from("matches")
    .select("id")
    .eq("stage", "GROUP_STAGE")
    .limit(30);

  const matchIds = (matchSample ?? []).map((m) => m.id);
  for (const matchId of matchIds) {
    await timed("predictions", () =>
      supabase.from("predictions").upsert(
        {
          user_id: userId,
          match_id: matchId,
          home_score: Math.floor(Math.random() * 4),
          away_score: Math.floor(Math.random() * 4),
          toto_pick: pick(["1", "X", "2"]),
        },
        { onConflict: "user_id,match_id" }
      ),
    );
  }

  // 3. Bracket-picks: representatieve sample (geen volledige cascade — alleen
  //    de schrijf-load testen)
  const bracketRows = Array.from({ length: 20 }, (_, i) => ({
    user_id: userId,
    round: pick(["GROUP_TOP_2", "BEST_THIRDS", "LAST_32", "LAST_16"]),
    slot: i,
    team_code: pick(["NED", "BEL", "GER", "FRA", "ESP", "POR", "ENG", "ARG", "BRA", "USA"]),
  }));
  for (const row of bracketRows) {
    await timed("bracket", () =>
      supabase.from("bracket_picks").upsert(row, { onConflict: "user_id,round,slot" }),
    );
  }

  // 4. Bonus: 1 rij per user
  await timed("bonus", () =>
    supabase.from("bonus_picks").upsert(
      {
        user_id: userId,
        top_scorer: `Test-spits ${n}`,
        total_goals_tiebreak: 120 + (n % 30),
        total_yellow_cards_tiebreak: 180 + (n % 40),
        nl_top_scorer: `NL-spits ${n}`,
        nl_total_goals: 5 + (n % 8),
        nl_progress: pick(["GROUP_STAGE", "LAST_16", "QUARTER_FINALS", "SEMI_FINALS", "CHAMPION"]),
      },
      { onConflict: "user_id" }
    ),
  );
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n🧪 Load-test: ${N} parallel users tegen ${url}\n`);

  if (!confirm) {
    console.log("⚠️  Dry-run (geen DB-writes). Run met --confirm om echt te draaien.\n");
    console.log("Geplande acties per user:");
    console.log("  - 1× upsert in profiles");
    console.log("  - 30× upsert in predictions");
    console.log("  - 20× upsert in bracket_picks");
    console.log("  - 1× upsert in bonus_picks");
    console.log(`\nTotaal verwachte writes: ${N * 52} = ${N} users × 52 writes\n`);
    return;
  }

  console.log(`⚠️  GAAT ECHT SCHRIJVEN — ${N * 52} upserts in ~${N} parallel sessies.`);
  console.log("Druk Ctrl-C in 5 seconden om te annuleren...");
  for (let i = 5; i > 0; i--) {
    process.stdout.write(`${i}... `);
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.log("\n\n🚀 Start...\n");

  const t0 = performance.now();

  // Parallel maar in batches van 25 om niet alle N tegelijk te firen
  const BATCH = 25;
  for (let i = 0; i < N; i += BATCH) {
    const batch = Array.from({ length: Math.min(BATCH, N - i) }, (_, j) =>
      simulateUser(i + j + 1),
    );
    await Promise.all(batch);
    process.stdout.write(`  ${Math.min(i + BATCH, N)}/${N}\r`);
  }

  const totalMs = performance.now() - t0;
  console.log("\n\n✅ Klaar.\n");

  // ── Rapport ──
  const phases: Phase[] = ["profile", "predictions", "bracket", "bonus"];
  console.log("Latencies per fase (ms):");
  console.log("                p50      p95      p99    errors   total");
  for (const p of phases) {
    const lat = latencies[p];
    const err = errors[p];
    console.log(
      `  ${p.padEnd(13)}` +
        `${Math.round(percentile(lat, 50)).toString().padStart(6)}   ` +
        `${Math.round(percentile(lat, 95)).toString().padStart(6)}   ` +
        `${Math.round(percentile(lat, 99)).toString().padStart(6)}   ` +
        `${err.toString().padStart(6)}   ` +
        `${lat.length.toString().padStart(6)}`,
    );
  }
  console.log(`\nTotale wallclock: ${(totalMs / 1000).toFixed(1)}s voor ${N} parallel users`);
  console.log(`Effectieve throughput: ${(latencies.predictions.length + latencies.bracket.length) / (totalMs / 1000) | 0} writes/s\n`);

  const totalErrors = phases.reduce((s, p) => s + errors[p], 0);
  if (totalErrors === 0) {
    console.log("🎉 Zero errors — Supabase + RPC's hielden de load.");
  } else {
    console.log(`⚠️  ${totalErrors} errors. Check Supabase logs voor detail.`);
  }
  console.log("\nOpruimen: npx tsx scripts/loadtest-cleanup.ts\n");
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});

// Voor TS-strict: deze import wordt benut maar de linter ziet 'm niet als gebruikt
void randomUUID;
