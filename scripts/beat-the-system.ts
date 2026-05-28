#!/usr/bin/env tsx
/**
 * Beat the System — twee digitale collega's die mee-spelen in de poule.
 *
 *   🟢 Johan Derksen (Mr Nijhuis)  — Wisdom of the Crowd
 *     Vult per vraag de meest gekozen optie in (modal) van alle echte
 *     deelnemers. Werkt alleen ná lock, anders is de modus nog niet
 *     gestabiliseerd.
 *
 *   🟠 Rene van der Gijp (Mr Bookmaker) — Bookmaker-favorieten
 *     Vult op basis van een hardcoded tier-lijst van favorieten. Tier 1
 *     teams winnen in groepsfase + ver in knock-out. Lager-gerangschikte
 *     teams verliezen vroeg. Bedoeld als 'wat de odds zouden voorspellen'.
 *
 * Gebruik:
 *   npm run beat -- johan         # alleen Johan (na lock)
 *   npm run beat -- rene          # alleen Rene
 *   npm run beat -- both          # beide
 *   npm run beat -- cleanup       # beide verwijderen
 *
 * Zonder --confirm = dry-run met overzicht. Met --confirm wordt het echt
 * uitgevoerd.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { existsSync } from "node:fs";
import {
  RENE_CHAMPION_ODDS,
  RENE_GROUP_FORECAST,
  RENE_BONUS,
  strength,
} from "../data/rene-knowledge";
import { computeR32Slots, type PhaseA, type Bracket } from "../lib/bracket/cascade";
import {
  BRACKET_GRAPH,
  ALL_MATCH_IDS,
  MATCH_IDS_BY_ROUND,
} from "../lib/bracket/bracket-graph";
import type { GroupCode, MatchId } from "../lib/bracket/types";
import { GROUP_CODES, isGroupCode } from "../lib/bracket/types";

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

const MARKER = "🤖 Beat the System";

type Bot = {
  email: string;
  displayName: string;
  description: string;
};

const JOHAN: Bot = {
  email: "johan-derksen@beat-the-system.local",
  displayName: "Johan Derksen (de meerderheid)",
  description: "Wisdom of the Crowd — modus van alle deelnemers",
};

const RENE: Bot = {
  email: "rene-van-der-gijp@beat-the-system.local",
  displayName: "Rene van der Gijp (de bookmaker)",
  description: "Bookmaker-favorieten — odds-driven",
};

// ── Helpers ────────────────────────────────────────────────────────────────

async function ensureBotUser(bot: Bot): Promise<string> {
  // Bestaat 'ie al?
  const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const existing = list?.users.find((u) => u.email === bot.email);
  if (existing) {
    // Profile zeker stellen
    await supabase.from("profiles").upsert(
      { id: existing.id, display_name: bot.displayName, department: MARKER },
      { onConflict: "id" },
    );
    return existing.id;
  }

  const { data: created, error } = await supabase.auth.admin.createUser({
    email: bot.email,
    password: "beat-the-system-internal-do-not-use",
    email_confirm: true,
    user_metadata: { display_name: bot.displayName, department: MARKER },
  });
  if (error || !created?.user) throw new Error(`Auth create faalt: ${error?.message}`);

  await supabase.from("profiles").upsert(
    { id: created.user.id, display_name: bot.displayName, department: MARKER },
    { onConflict: "id" },
  );
  return created.user.id;
}

async function clearBotData(userId: string) {
  for (const t of [
    "predictions",
    "bracket_picks",
    "bracket_match_overrides",
    "bonus_picks",
    "points",
  ]) {
    await supabase.from(t).delete().eq("user_id", userId);
  }
}

async function deleteBotCompletely(bot: Bot) {
  const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const existing = list?.users.find((u) => u.email === bot.email);
  if (!existing) return false;
  await clearBotData(existing.id);
  await supabase.from("profiles").delete().eq("id", existing.id);
  await supabase.auth.admin.deleteUser(existing.id);
  return true;
}

function mode<T>(arr: T[]): T | undefined {
  if (arr.length === 0) return undefined;
  const counts = new Map<T, number>();
  for (const v of arr) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: T | undefined;
  let bestN = -1;
  for (const [v, n] of counts) {
    if (n > bestN) { best = v; bestN = n; }
  }
  return best;
}

// ── Johan Derksen — Wisdom of the Crowd ────────────────────────────────────

async function seedJohan(userId: string, dryRun: boolean) {
  console.log(`\n🟢 Johan Derksen (${JOHAN.description})\n`);

  // Wis alle bestaande Johan-picks (idempotent)
  if (!dryRun) await clearBotData(userId);

  // Real users = niet de bot-markers en niet de test-markers
  const { data: realProfiles } = await supabase
    .from("profiles")
    .select("id")
    .not("department", "in", `("${MARKER}","__LOADTEST__","__SCORING_TEST__")`);
  const realIds = (realProfiles ?? []).map((p) => p.id);
  console.log(`  ${realIds.length} echte deelnemers gevonden voor modus-berekening`);
  if (realIds.length === 0) {
    console.log("  ⚠️  Geen echte deelnemers — niets te aggregeren");
    return;
  }

  // ── Predictions (groepsfase): per match, modal home_score + away_score + toto
  const { data: allPred } = await supabase
    .from("predictions")
    .select("user_id, match_id, home_score, away_score, toto_pick")
    .in("user_id", realIds);
  const byMatch = new Map<number, Array<{ home: number; away: number; toto: string | null }>>();
  for (const p of allPred ?? []) {
    if (p.home_score == null || p.away_score == null) continue;
    if (!byMatch.has(p.match_id)) byMatch.set(p.match_id, []);
    byMatch.get(p.match_id)!.push({ home: p.home_score, away: p.away_score, toto: p.toto_pick });
  }
  const predRows: Array<{ user_id: string; match_id: number; home_score: number; away_score: number; toto_pick: string | null }> = [];
  for (const [matchId, picks] of byMatch) {
    // Modale (home, away) combinatie
    const tuples = picks.map((p) => `${p.home}-${p.away}`);
    const modalTuple = mode(tuples);
    if (!modalTuple) continue;
    const [home, away] = modalTuple.split("-").map(Number);
    // Modale toto (vaak afgeleid maar mensen kunnen 'm handmatig zetten)
    const modalToto = mode(picks.map((p) => p.toto).filter((t): t is string => t != null));
    predRows.push({ user_id: userId, match_id: matchId, home_score: home, away_score: away, toto_pick: modalToto ?? null });
  }
  console.log(`  Groepsfase: ${predRows.length} modale predictions`);

  // ── Bracket-picks: per (round, slot), modale team_code
  const { data: allBracket } = await supabase
    .from("bracket_picks")
    .select("user_id, round, slot, team_code")
    .in("user_id", realIds);
  const byBracketSlot = new Map<string, string[]>();
  for (const b of allBracket ?? []) {
    if (!b.team_code) continue;
    const key = `${b.round}|${b.slot}`;
    if (!byBracketSlot.has(key)) byBracketSlot.set(key, []);
    byBracketSlot.get(key)!.push(b.team_code);
  }
  const bracketRows: Array<{ user_id: string; round: string; slot: number; team_code: string }> = [];
  for (const [key, codes] of byBracketSlot) {
    const modalCode = mode(codes);
    if (!modalCode) continue;
    const [round, slotStr] = key.split("|");
    bracketRows.push({ user_id: userId, round, slot: Number(slotStr), team_code: modalCode });
  }
  console.log(`  Knock-out: ${bracketRows.length} modale bracket-picks`);

  // ── Bonus
  const { data: allBonus } = await supabase
    .from("bonus_picks")
    .select("user_id, top_scorer, total_goals_tiebreak, total_yellow_cards_tiebreak, nl_top_scorer, nl_total_goals, nl_progress")
    .in("user_id", realIds);
  const bonusFields = {
    top_scorer: mode((allBonus ?? []).map((b) => b.top_scorer).filter((v): v is string => !!v)),
    total_goals_tiebreak: medianNumber((allBonus ?? []).map((b) => b.total_goals_tiebreak).filter((n): n is number => n != null)),
    total_yellow_cards_tiebreak: medianNumber((allBonus ?? []).map((b) => b.total_yellow_cards_tiebreak).filter((n): n is number => n != null)),
    nl_top_scorer: mode((allBonus ?? []).map((b) => b.nl_top_scorer).filter((v): v is string => !!v)),
    nl_total_goals: medianNumber((allBonus ?? []).map((b) => b.nl_total_goals).filter((n): n is number => n != null)),
    nl_progress: mode((allBonus ?? []).map((b) => b.nl_progress).filter((v): v is string => !!v)),
  };
  console.log(`  Bonus modaal: topscorer=${bonusFields.top_scorer ?? "—"}, goals=${bonusFields.total_goals_tiebreak ?? "—"}, NL-progress=${bonusFields.nl_progress ?? "—"}`);

  if (dryRun) {
    console.log("\n  (dry-run, niets geschreven)");
    return;
  }

  // Inserts in batches om Supabase limits te respecteren
  for (let i = 0; i < predRows.length; i += 100) {
    const chunk = predRows.slice(i, i + 100);
    const { error } = await supabase.from("predictions").upsert(chunk, { onConflict: "user_id,match_id" });
    if (error) console.error(`  ❌ predictions chunk: ${error.message}`);
  }
  for (let i = 0; i < bracketRows.length; i += 100) {
    const chunk = bracketRows.slice(i, i + 100);
    const { error } = await supabase.from("bracket_picks").upsert(chunk, { onConflict: "user_id,round,slot" });
    if (error) console.error(`  ❌ bracket chunk: ${error.message}`);
  }
  const { error: bErr } = await supabase.from("bonus_picks").upsert({
    user_id: userId,
    top_scorer: bonusFields.top_scorer ?? null,
    total_goals_tiebreak: bonusFields.total_goals_tiebreak ?? null,
    total_yellow_cards_tiebreak: bonusFields.total_yellow_cards_tiebreak ?? null,
    nl_top_scorer: bonusFields.nl_top_scorer ?? null,
    nl_total_goals: bonusFields.nl_total_goals ?? null,
    nl_progress: bonusFields.nl_progress ?? null,
  }, { onConflict: "user_id" });
  if (bErr) console.error(`  ❌ bonus: ${bErr.message}`);

  console.log(`  ✅ Johan klaar`);
}

function medianNumber(arr: number[]): number | undefined {
  if (arr.length === 0) return undefined;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
}

// ── Rene van der Gijp — Bookmaker-favorieten ───────────────────────────────
//
// Rene's logica is pure data + cascade. Alle "kennis" zit in
// data/rene-knowledge.ts:
//   • RENE_CHAMPION_ODDS — decimal odds per land → strength = 1/odds
//   • RENE_GROUP_FORECAST — wie wordt 1e/2e/3e per groep (host-effecten,
//     specifieke matchups)
//   • RENE_BONUS — topscorer + tiebreakers + NL-progress
//
// De cascade-logica uit lib/bracket/cascade.ts wordt hergebruikt om alle
// 31 KO-wedstrijden in te vullen (R32 → R16 → QF → SF → F).

/**
 * Bouw groepsfase-prediction met odds-based model.
 * Gebaseerd op verhouding strength(home) / strength(away):
 *   < 0.5×  → uit-favoriet: 0-2 of 0-3
 *   0.5-0.8 → uit-favoriet (klein): 1-2
 *   0.8-1.25 → close game: 1-1
 *   1.25-2 → thuis-favoriet (klein): 2-1
 *   > 2×    → thuis-favoriet: 2-0 of 3-0
 */
function predictGroupScore(home: string, away: string): { home: number; away: number; toto: "1" | "X" | "2" } {
  const sh = strength(home);
  const sa = strength(away);
  // Eén of beide ratings ontbreekt → neutraal 1-1
  if (sh === 0 && sa === 0) return { home: 1, away: 1, toto: "X" };
  if (sh === 0) return { home: 0, away: 2, toto: "2" };
  if (sa === 0) return { home: 2, away: 0, toto: "1" };

  const ratio = sh / sa;
  if (ratio < 0.4) return { home: 0, away: 3, toto: "2" };
  if (ratio < 0.625) return { home: 1, away: 2, toto: "2" };
  if (ratio <= 1.6) return { home: 1, away: 1, toto: "X" };
  if (ratio <= 2.5) return { home: 2, away: 1, toto: "1" };
  return { home: 3, away: 0, toto: "1" };
}

async function seedRene(userId: string, dryRun: boolean) {
  console.log(`\n🟠 Rene van der Gijp (${RENE.description})\n`);
  if (!dryRun) await clearBotData(userId);

  // ── 1. Match-data ophalen ───────────────────────────────────────────────
  const { data: matches } = await supabase
    .from("matches")
    .select("id, stage, group_name, home_team, away_team")
    .order("kickoff_at", { ascending: true });

  const groupMatches = (matches ?? []).filter((m) => m.stage === "GROUP_STAGE");

  // Bouw teamGroupMap (team-code → groep) uit de matches
  const teamGroupMap = new Map<string, GroupCode>();
  for (const m of groupMatches) {
    if (!m.home_team || !m.away_team || !m.group_name) continue;
    const letter = m.group_name.startsWith("GROUP_") ? m.group_name.slice(6) : m.group_name;
    if (!isGroupCode(letter)) continue;
    teamGroupMap.set(m.home_team, letter);
    teamGroupMap.set(m.away_team, letter);
  }

  // ── 2. Groepsfase-predictions (72 wedstrijden) ──────────────────────────
  const predRows: Array<{ user_id: string; match_id: number; home_score: number; away_score: number; toto_pick: string }> = [];
  for (const m of groupMatches) {
    if (!m.home_team || !m.away_team) continue;
    const s = predictGroupScore(m.home_team, m.away_team);
    predRows.push({ user_id: userId, match_id: m.id, home_score: s.home, away_score: s.away, toto_pick: s.toto });
  }
  console.log(`  Groepsfase: ${predRows.length} predictions (odds-based)`);

  // ── 3. GROUP_TOP_2 + BEST_THIRDS uit RENE_GROUP_FORECAST ────────────────
  const bracketRows: Array<{ user_id: string; round: string; slot: number; team_code: string }> = [];
  const phaseA: PhaseA = {};

  for (let i = 0; i < GROUP_CODES.length; i++) {
    const g = GROUP_CODES[i];
    const f = RENE_GROUP_FORECAST[g];
    if (!f) continue;
    phaseA[g] = { rank1: f.first, rank2: f.second, rank3: f.third };
    // slot 0..11 = rank1 per A..L, slot 12..23 = rank2
    bracketRows.push({ user_id: userId, round: "GROUP_TOP_2", slot: i, team_code: f.first });
    bracketRows.push({ user_id: userId, round: "GROUP_TOP_2", slot: 12 + i, team_code: f.second });
  }

  // 8 beste derde plaatsen — gesorteerd op strength
  const thirdsRanked = GROUP_CODES.map((g, idx) => ({
    g, idx, team: RENE_GROUP_FORECAST[g]?.third, s: strength(RENE_GROUP_FORECAST[g]?.third ?? ""),
  }))
    .filter((x) => x.team)
    .sort((a, b) => b.s - a.s)
    .slice(0, 8);

  const phaseB = new Set<string>();
  for (const t of thirdsRanked) {
    phaseB.add(t.team!);
    // BEST_THIRDS slot = group-index (0..11), aanwezig voor de gekozen 8
    bracketRows.push({ user_id: userId, round: "BEST_THIRDS", slot: t.idx, team_code: t.team! });
  }
  console.log(`  Top-2: 24 picks (alle 12 groepen) + Beste 3e: 8 picks`);
  console.log(`  → 8 thirds (door volgens odds): ${thirdsRanked.map((t) => t.team).join(", ")}`);

  // ── 4. KO-cascade: vul alle 31 matches in ───────────────────────────────
  // R32: computeR32Slots geeft per match home/away → kies team met hoogste strength
  // R16+: home/away komen uit bracket[homeFromMatch] / bracket[awayFromMatch]
  const r32Slots = computeR32Slots(phaseA, phaseB, teamGroupMap);
  const bracket: Bracket = {};

  let r32Filled = 0;
  for (const mid of MATCH_IDS_BY_ROUND.LAST_32) {
    const slot = r32Slots[mid];
    if (!slot?.home && !slot?.away) continue;
    const home = slot.home, away = slot.away;
    const winner =
      home && away ? (strength(home) >= strength(away) ? home : away)
        : (home ?? away);
    if (winner) {
      bracket[mid] = winner;
      // DB-encoding: slot = match-number, R32-N → slot N
      const slotNo = Number(mid.split("-")[1]);
      bracketRows.push({ user_id: userId, round: "LAST_32", slot: slotNo, team_code: winner });
      r32Filled++;
    }
  }

  // R16+: walk in volgorde
  function fillRound(round: "LAST_16" | "QUARTER_FINALS" | "SEMI_FINALS" | "FINAL", dbRound: string) {
    let count = 0;
    for (const mid of MATCH_IDS_BY_ROUND[round]) {
      const node = BRACKET_GRAPH[mid];
      if (node.round === "LAST_32") continue;
      const home = bracket[node.homeFromMatch];
      const away = bracket[node.awayFromMatch];
      const winner =
        home && away ? (strength(home) >= strength(away) ? home : away)
          : (home ?? away);
      if (winner) {
        bracket[mid] = winner;
        const slotNo = mid === "F-1" ? 1 : Number(mid.split("-")[1]);
        bracketRows.push({ user_id: userId, round: dbRound, slot: slotNo, team_code: winner });
        count++;
      }
    }
    return count;
  }
  const r16Filled = fillRound("LAST_16", "LAST_16");
  const qfFilled = fillRound("QUARTER_FINALS", "QUARTER_FINALS");
  const sfFilled = fillRound("SEMI_FINALS", "SEMI_FINALS");
  const fFilled = fillRound("FINAL", "FINAL");

  console.log(`  KO-cascade: R32=${r32Filled} R16=${r16Filled} QF=${qfFilled} SF=${sfFilled} F=${fFilled}`);
  console.log(`  🏆 Rene's wereldkampioen: ${bracket["F-1"] ?? "?"}`);

  // ── 5. Bonus ────────────────────────────────────────────────────────────
  const bonusValues = {
    top_scorer: RENE_BONUS.topScorer,
    total_goals_tiebreak: RENE_BONUS.totalGoals,
    total_yellow_cards_tiebreak: RENE_BONUS.totalYellowCards,
    nl_top_scorer: RENE_BONUS.nlTopScorer,
    nl_total_goals: RENE_BONUS.nlTotalGoals,
    nl_progress: RENE_BONUS.nlProgress,
  };
  console.log(`  Bonus: topscorer=${bonusValues.top_scorer}, totaal-goals=${bonusValues.total_goals_tiebreak}, NL=${bonusValues.nl_progress}`);

  if (dryRun) {
    console.log("\n  (dry-run, niets geschreven)");
    return;
  }

  for (let i = 0; i < predRows.length; i += 100) {
    const chunk = predRows.slice(i, i + 100);
    const { error } = await supabase.from("predictions").upsert(chunk, { onConflict: "user_id,match_id" });
    if (error) console.error(`  ❌ predictions: ${error.message}`);
  }
  for (let i = 0; i < bracketRows.length; i += 100) {
    const chunk = bracketRows.slice(i, i + 100);
    const { error } = await supabase.from("bracket_picks").upsert(chunk, { onConflict: "user_id,round,slot" });
    if (error) console.error(`  ❌ bracket: ${error.message}`);
  }
  const { error: bErr } = await supabase.from("bonus_picks").upsert(
    { user_id: userId, ...bonusValues },
    { onConflict: "user_id" },
  );
  if (bErr) console.error(`  ❌ bonus: ${bErr.message}`);

  console.log(`  ✅ Rene klaar`);
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];
  const confirm = args.includes("--confirm");
  const dryRun = !confirm;

  if (!cmd || !["johan", "rene", "both", "cleanup"].includes(cmd)) {
    console.error(`Gebruik:
  npm run beat -- johan [--confirm]
  npm run beat -- rene [--confirm]
  npm run beat -- both [--confirm]
  npm run beat -- cleanup [--confirm]
`);
    process.exit(1);
  }

  if (cmd === "cleanup") {
    console.log(`\n🧹 Beat-the-System cleanup\n`);
    if (dryRun) {
      console.log("(dry-run — voeg --confirm toe om echt te verwijderen)");
    }
    if (!dryRun) {
      const j = await deleteBotCompletely(JOHAN);
      console.log(`  ${j ? "✅" : "—"} Johan Derksen ${j ? "verwijderd" : "bestond niet"}`);
      const r = await deleteBotCompletely(RENE);
      console.log(`  ${r ? "✅" : "—"} Rene van der Gijp ${r ? "verwijderd" : "bestond niet"}`);
    } else {
      console.log("  Zou Johan + Rene verwijderen (incl. picks + auth)");
    }
    return;
  }

  if (dryRun) {
    console.log("\n⚠️  Dry-run. Voeg --confirm toe om echt te draaien.\n");
  }

  if (cmd === "johan" || cmd === "both") {
    const johanId = await ensureBotUser(JOHAN);
    await seedJohan(johanId, dryRun);
  }
  if (cmd === "rene" || cmd === "both") {
    const reneId = await ensureBotUser(RENE);
    await seedRene(reneId, dryRun);
  }

  console.log("\n");
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
