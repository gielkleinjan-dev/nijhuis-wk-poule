#!/usr/bin/env tsx
/**
 * DRY-RUN: knock-outpunten dynamisch (placement) vs. huidige opgeslagen punten.
 *
 * READ-ONLY. Schrijft NIETS naar de database. Vergelijkt per deelnemer de
 * huidige opgeslagen knock-outpunten met wat de nieuwe placement-telling
 * (lib/scoring-knockout.ts) zou opleveren — zodat de poule-baas ziet wát er
 * verschuift vóór het live gaat.
 *
 * Twee modi:
 *   npm-stijl:  tsx scripts/dryrun-knockout.ts
 *     → tegen de live-data: huidige werkelijke bracket-vulling (nu nog leeg,
 *       dus laat zien dat er nog niets te scoren valt = geen regressie).
 *
 *   tsx scripts/dryrun-knockout.ts --simulate-as=email@adres
 *     → neemt de volledige voorspelde bracket van die deelnemer als
 *       "werkelijkheid" en scoort iedereen daartegen. Geeft NU al een
 *       representatieve puntenverdeling om het effect te tonen.
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { existsSync } from "node:fs";
import {
  decodeBracketPicks,
  predictedOccupants,
  scoreKnockoutPlacement,
  type RawPick,
} from "../lib/scoring-knockout";
import { BRACKET_GRAPH, ALL_MATCH_IDS } from "../lib/bracket/bracket-graph";
import { isGroupCode, type GroupCode } from "../lib/bracket/types";

for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) {
    config({ path: file });
    break;
  }
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("❌ Vereist: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in env.");
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false } });

const simulateArg = process.argv.find((a) => a.startsWith("--simulate-as="));
const simulateName = simulateArg ? simulateArg.split("=").slice(1).join("=") : null;

type MatchesByFifa = Map<number, { home_team: string | null; away_team: string | null }>;

// Supabase kapt elke query standaard op 1000 rijen af. bracket_picks heeft er
// ~7100, dus pagineren in batches van 1000 om ALLE picks te laden.
async function fetchAll<T>(
  table: string,
  columns: string,
): Promise<T[]> {
  const out: T[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const batch = (data ?? []) as T[];
    out.push(...batch);
    if (batch.length < pageSize) break;
  }
  return out;
}

async function main() {
  // 1. team → groep (uit groepswedstrijden)
  const { data: groupMatches } = await supabase
    .from("matches")
    .select("home_team, away_team, group_name")
    .eq("stage", "GROUP_STAGE")
    .not("group_name", "is", null);

  const teamGroupMap = new Map<string, GroupCode>();
  for (const m of groupMatches ?? []) {
    const raw = m.group_name ?? "";
    const letter = raw.startsWith("GROUP_") ? raw.slice(6) : raw;
    if (!isGroupCode(letter)) continue;
    if (m.home_team) teamGroupMap.set(m.home_team, letter);
    if (m.away_team) teamGroupMap.set(m.away_team, letter);
  }

  // 2. profielen + alle bracket_picks (gepagineerd — anders kapt Supabase op 1000)
  const profiles = await fetchAll<{ id: string; display_name: string | null }>(
    "profiles",
    "id, display_name",
  );
  const allPicks = await fetchAll<{ user_id: string; round: string; slot: number | null; team_code: string | null }>(
    "bracket_picks",
    "user_id, round, slot, team_code",
  );

  const picksByUser = new Map<string, RawPick[]>();
  for (const p of allPicks) {
    if (!picksByUser.has(p.user_id)) picksByUser.set(p.user_id, []);
    picksByUser.get(p.user_id)!.push({ round: p.round, slot: p.slot, team_code: p.team_code });
  }

  // 3. huidige opgeslagen knock-outpunten per user (gepagineerd, alleen source=knockout)
  const oldByUser = new Map<string, number>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("points")
      .select("user_id, points")
      .eq("source", "knockout")
      .range(from, from + 999);
    if (error) throw error;
    const batch = data ?? [];
    for (const r of batch) oldByUser.set(r.user_id, (oldByUser.get(r.user_id) ?? 0) + (r.points ?? 0));
    if (batch.length < 1000) break;
  }

  // 4. "werkelijke" bracket-vulling bepalen
  let matchesByFifa: MatchesByFifa = new Map();
  let actualChampion: string | null = null;
  let modeLabel = "";

  if (simulateName) {
    // Simulatie: neem de volledige voorspelde bracket van één deelnemer als
    // waarheid en scoor iedereen daartegen — geeft een representatief beeld van
    // de eindstand-spreiding terwijl de echte bracket nog niet gevuld is.
    const sim = (profiles ?? []).find(
      (p) => (p.display_name ?? "").toLowerCase().includes(simulateName.toLowerCase()),
    );
    if (!sim) {
      console.error(`❌ Geen deelnemer gevonden met naam die "${simulateName}" bevat.`);
      process.exit(1);
    }
    const simPicks = picksByUser.get(sim.id) ?? [];
    const { phaseA, phaseB, bracket } = decodeBracketPicks(simPicks);
    const predicted = predictedOccupants(phaseA, phaseB, bracket, teamGroupMap);
    for (const matchId of ALL_MATCH_IDS) {
      const fifa = BRACKET_GRAPH[matchId].fifaMatchNo;
      const occ = predicted.get(matchId);
      matchesByFifa.set(fifa, { home_team: occ?.home ?? null, away_team: occ?.away ?? null });
    }
    actualChampion = bracket["F-1"] ?? null;
    modeLabel = `SIMULATIE — werkelijkheid = volledige bracket van ${sim.display_name}`;
  } else {
    // Live: werkelijke vulling uit matches.home_team/away_team voor KO-rondes.
    const { data: koMatches } = await supabase
      .from("matches")
      .select("id, home_team, away_team, home_score, away_score, status, stage")
      .in("stage", ["LAST_32", "LAST_16", "QUARTER_FINALS", "SEMI_FINALS", "FINAL"]);
    for (const m of koMatches ?? []) {
      matchesByFifa.set(m.id, { home_team: m.home_team, away_team: m.away_team });
    }
    const finalMatch = (koMatches ?? []).find((m) => m.stage === "FINAL");
    if (finalMatch && finalMatch.status === "FINISHED" && finalMatch.home_score != null && finalMatch.away_score != null) {
      if (finalMatch.home_score > finalMatch.away_score) actualChampion = finalMatch.home_team;
      else if (finalMatch.away_score > finalMatch.home_score) actualChampion = finalMatch.away_team;
      // gelijk = penalty's: niet af te leiden uit scores, laat null (heeft nu geen effect)
    }
    const filled = [...matchesByFifa.values()].filter((m) => m.home_team || m.away_team).length;
    modeLabel = `LIVE — ${filled} van ${matchesByFifa.size} KO-wedstrijden hebben (deels) gevulde teams`;
  }

  // 5. per deelnemer: nieuwe placement-punten vs. oude opgeslagen knock-outpunten
  const nameById = new Map<string, string>();
  for (const p of profiles ?? []) nameById.set(p.id, p.display_name ?? p.id);

  type Row = { name: string; oldPts: number; newPts: number; delta: number };
  const rows: Row[] = [];
  for (const [userId, picks] of picksByUser) {
    const newRows = scoreKnockoutPlacement(picks, teamGroupMap, matchesByFifa, actualChampion);
    const newPts = newRows.reduce((s, r) => s + r.points, 0);
    const oldPts = oldByUser.get(userId) ?? 0;
    rows.push({ name: nameById.get(userId) ?? userId, oldPts, newPts, delta: newPts - oldPts });
  }

  rows.sort((a, b) => b.newPts - a.newPts);

  // 6. rapport
  console.log("\n══════════════════════════════════════════════════════════════");
  console.log(`  DRY-RUN knock-outpunten (READ-ONLY, niets weggeschreven)`);
  console.log(`  ${modeLabel}`);
  console.log("══════════════════════════════════════════════════════════════\n");

  const withNew = rows.filter((r) => r.newPts > 0);
  const changed = rows.filter((r) => r.delta !== 0);
  console.log(`Deelnemers met bracket-picks : ${rows.length}`);
  console.log(`Deelnemers met nieuwe KO-punten: ${withNew.length}`);
  console.log(`Deelnemers met gewijzigd totaal: ${changed.length}\n`);

  const top = rows.slice(0, 20);
  console.log("  Top 20 (nieuwe KO-punten):");
  console.log("  " + "naam".padEnd(28) + "oud".padStart(6) + "nieuw".padStart(8) + "Δ".padStart(8));
  for (const r of top) {
    console.log(
      "  " +
        r.name.slice(0, 27).padEnd(28) +
        String(r.oldPts).padStart(6) +
        String(r.newPts).padStart(8) +
        (r.delta >= 0 ? "+" : "") + String(r.delta).padStart(7),
    );
  }
  console.log("\n(READ-ONLY dry-run — er is niets gewijzigd aan de standen.)\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
