#!/usr/bin/env tsx
/**
 * Fill Giel's poule — win-geoptimaliseerde inzending.
 *
 * Doel: het account g.kleinjan@nijhuis.nl (Giel KleinJan) zó invullen dat de
 * KANS OM DE POULE TE WINNEN maximaal is — niet alleen "veel punten scoren".
 * Dat is een ander doel dan de bots:
 *
 *   • Johan (de meerderheid) en Rene (de bookmaker) mikken op de modus / de
 *     favoriet. In een veld van 60+ collega's levert dat een inzending op die
 *     lijkt op die van tientallen anderen → je deelt de grote punten en wint
 *     niet.
 *
 *   • Deze inzending is SCHERP waar het veel oplevert en moet (groepsfase-toto's,
 *     favorieten ver in de knock-out) MAAR neemt één berekende, onderbezette
 *     gok op het duurste item (de wereldkampioen, 96 pt).
 *
 * Strategie (onderbouwing, juni 2026):
 *   1. Groepsfase (max 360 pt): per wedstrijd de meest waarschijnlijke uitslag
 *      (modale scoreline o.b.v. odds-verhouding). Toto eerst goed (1 pt, hoge
 *      trefkans), dan de modale cijfers (2+2 pt). Scherper dan het luie "2-1
 *      overal" van het veld = gratis voorsprong.
 *   2. Knock-out (max 504 pt): favorieten-cascade (hoogste bookmaker-strength
 *      wint elke wedstrijd) — IDENTIEK aan Rene — BEHALVE twee overrides:
 *        · SF-1  → ESP  (Spanje als finalist uit de bovenste helft; zachter pad
 *                        dan Frankrijk, dat eerst Duitsland in de R16 treft)
 *        · F-1   → ENG  (ENGELAND wereldkampioen)
 *      Waarom Engeland? 3e bookmaker-favoriet (7.5 ≈ 13,3%), maar in het veld
 *      van ~30 ingevulde kampioen-picks: 0× gekozen (ESP 9, FRA 7, NED 6).
 *      Engelands bracket-pad vermijdt ESP én FRA tot de finale (R16 v MEX →
 *      QF v BRA → SF v ARG). Als Engeland wint, ben ik vrijwel zeker de ENIGE
 *      met de 96 → poule-winst. Kost ~3% titel-kans t.o.v. ESP/FRA, maar
 *      verdubbelt ruwweg de kans om de poule te WINNEN.
 *   3. Bonus (max 60 pt): scherpe favorieten (Mbappé topscorer), realistische
 *      tiebreaker-getallen, en een Oranje-lijn die consistent is met de bracket
 *      (NED valt in de kwartfinale → nl_progress = QUARTER_FINALS).
 *
 * Gebruik:
 *   npm run fill-giel              # dry-run met volledig overzicht
 *   npm run fill-giel -- --confirm # schrijft echt weg (overschrijft bestaande picks)
 *
 * Hergebruikt exact de geteste cascade uit lib/bracket/* en hetzelfde
 * schrijf-patroon als scripts/beat-the-system.ts.
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { existsSync } from "node:fs";
import { RENE_GROUP_FORECAST, strength } from "../data/rene-knowledge";
import { computeR32Slots, type PhaseA, type Bracket } from "../lib/bracket/cascade";
import { BRACKET_GRAPH, MATCH_IDS_BY_ROUND } from "../lib/bracket/bracket-graph";
import { GROUP_CODES, isGroupCode, type GroupCode, type MatchId } from "../lib/bracket/types";

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

const GIEL_EMAIL = "g.kleinjan@nijhuis.nl";

// ── Knock-out overrides bovenop de favorieten-cascade ───────────────────────
// Alleen op de twee duurste, meest-geclusterde plekken differentiëren.
const BRACKET_OVERRIDES: Partial<Record<MatchId, string>> = {
  "SF-1": "ESP", // bovenste-helft finalist: Spanje (zachter pad dan Frankrijk)
  "F-1": "ESP", // 🏆 WERELDKAMPIOEN: Spanje (lagere variantie dan Engeland; ENG blijft onderbezette runner-up)
};

// ── Bonus ───────────────────────────────────────────────────────────────────
const BONUS = {
  top_scorer: "Kylian Mbappé", // +600 favoriet; FRA haalt de halve finale (6 duels)
  total_goals_tiebreak: 280, // 104 duels × ~2,69 (WK22-gemiddelde) — beslisser
  total_yellow_cards_tiebreak: 355, // 104 × ~3,4 (WK22: 219 in 64 duels)
  nl_top_scorer: "Memphis Depay", // penaltynemer + meest toernooi-relevante NL'er
  nl_total_goals: 9, // NED t/m kwartfinale = 5 duels (WK22: 10 goals in 5 duels)
  nl_progress: "QUARTER_FINALS" as const, // consistent met bracket: NED verliest QF v FRA
};

// ── Groepsfase: scherpere scoreline-overrides voor "twee-echte-teams"-duels ──
// Daar overschat de titel-odds-ratio de favoriet (titel-odds ≠ groepsduel-kracht).
// [home, away, toto] vanuit het perspectief van de DB-fixture (home_team/away_team).
const GROUP_SCORE_OVERRIDES: Record<number, [number, number, "1" | "X" | "2"]> = {
  1: [2, 0, "1"], // MEX-RSA  (host, geen 3-0-machine)
  6: [2, 1, "1"], // BRA-MAR  (Marokko = halvefinalist 2022)
  10: [2, 1, "1"], // NED-JPN
  14: [2, 0, "1"], // BEL-EGY  (Salah)
  17: [2, 0, "1"], // FRA-SEN
  22: [2, 0, "1"], // ENG-CRO  (Kroatië taai)
  33: [2, 1, "1"], // NED-SWE
  37: [2, 0, "1"], // ESP-KSA  (KSA verraste ARG in 2022)
  41: [2, 0, "1"], // ARG-AUT
  43: [2, 1, "1"], // NOR-SEN
  52: [0, 2, "2"], // SCO-BRA
  58: [2, 1, "1"], // JPN-SWE
  61: [1, 2, "2"], // NOR-FRA  (Haaland scoort thuis)
  63: [1, 2, "2"], // URY-ESP
  67: [0, 2, "2"], // PAN-ENG
  69: [1, 2, "2"], // COL-POR
};

/**
 * Modale scoreline o.b.v. odds-verhouding. Maximaliseert verwachte punten:
 * toto eerst (favoriet wint / X bij echte coinflip), dan modale cijfers.
 * 3-0 alleen als de favoriet een écht aanvallend topland is (strength ≥ 0.05,
 * d.w.z. odds ≤ 20) tegen een dwerg — anders 2-0.
 */
function predictGroupScore(
  home: string,
  away: string,
): { home: number; away: number; toto: "1" | "X" | "2" } {
  const sh = strength(home);
  const sa = strength(away);
  if (sh === 0 && sa === 0) return { home: 1, away: 1, toto: "X" };
  if (sh === 0) return { home: 0, away: 2, toto: "2" };
  if (sa === 0) return { home: 2, away: 0, toto: "1" };

  const homeFav = sh >= sa;
  const favStrength = homeFav ? sh : sa;
  const R = homeFav ? sh / sa : sa / sh;

  let strong: number;
  let weak: number;
  if (R >= 8 && favStrength >= 0.05) {
    strong = 3;
    weak = 0;
  } else if (R >= 2.5) {
    strong = 2;
    weak = 0;
  } else if (R >= 1.35) {
    strong = 2;
    weak = 1;
  } else {
    return { home: 1, away: 1, toto: "X" };
  }
  return homeFav
    ? { home: strong, away: weak, toto: "1" }
    : { home: weak, away: strong, toto: "2" };
}

function pickWinner(
  mid: MatchId,
  home: string | undefined,
  away: string | undefined,
): string | undefined {
  const ov = BRACKET_OVERRIDES[mid];
  if (ov && (ov === home || ov === away)) return ov;
  if (home && away) return strength(home) >= strength(away) ? home : away;
  return home ?? away;
}

async function findGielId(): Promise<string> {
  const { data: list, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw new Error(`listUsers faalt: ${error.message}`);
  const u = list?.users.find((x) => x.email?.toLowerCase() === GIEL_EMAIL.toLowerCase());
  if (!u) throw new Error(`Geen account gevonden voor ${GIEL_EMAIL}`);
  return u.id;
}

async function clearGiel(userId: string) {
  for (const t of ["predictions", "bracket_picks", "bracket_match_overrides", "bonus_picks", "points"]) {
    const { error } = await supabase.from(t).delete().eq("user_id", userId);
    if (error) console.error(`  ⚠️  clear ${t}: ${error.message}`);
  }
}

async function main() {
  const confirm = process.argv.includes("--confirm");
  const dryRun = !confirm;

  console.log(`\n🎯 Giel's win-geoptimaliseerde poule${dryRun ? "  (DRY-RUN)" : "  (--confirm: schrijft echt weg)"}\n`);

  const userId = dryRun ? "(dry-run)" : await findGielId();
  if (!dryRun) {
    console.log(`  Account: ${GIEL_EMAIL} → ${userId}`);
    console.log(`  ⚠️  Bestaande picks worden gewist en vervangen.`);
    await clearGiel(userId);
  }

  // ── 1. Match-data ──────────────────────────────────────────────────────────
  const { data: matches, error: mErr } = await supabase
    .from("matches")
    .select("id, stage, group_name, home_team, away_team")
    .eq("stage", "GROUP_STAGE")
    .order("kickoff_at", { ascending: true });
  if (mErr) throw mErr;

  const teamGroupMap = new Map<string, GroupCode>();
  for (const m of matches ?? []) {
    if (!m.home_team || !m.away_team || !m.group_name) continue;
    const letter = m.group_name.startsWith("GROUP_") ? m.group_name.slice(6) : m.group_name;
    if (!isGroupCode(letter)) continue;
    teamGroupMap.set(m.home_team, letter);
    teamGroupMap.set(m.away_team, letter);
  }

  // ── 2. Groepsfase-predictions ───────────────────────────────────────────────
  const predRows: Array<{ user_id: string; match_id: number; home_score: number; away_score: number; toto_pick: string }> = [];
  let overridden = 0;
  for (const m of matches ?? []) {
    if (!m.home_team || !m.away_team) continue;
    const ov = GROUP_SCORE_OVERRIDES[m.id];
    const s = ov
      ? { home: ov[0], away: ov[1], toto: ov[2] }
      : predictGroupScore(m.home_team, m.away_team);
    if (ov) overridden++;
    predRows.push({ user_id: userId, match_id: m.id, home_score: s.home, away_score: s.away, toto_pick: s.toto });
  }
  console.log(`📋 Groepsfase: ${predRows.length} predictions (${overridden} handmatige overrides)`);

  // ── 3. GROUP_TOP_2 + BEST_THIRDS (forecast = odds-based, scoort niet direct) ─
  const bracketRows: Array<{ user_id: string; round: string; slot: number; team_code: string }> = [];
  const phaseA: PhaseA = {};
  for (let i = 0; i < GROUP_CODES.length; i++) {
    const g = GROUP_CODES[i];
    const f = RENE_GROUP_FORECAST[g];
    if (!f) continue;
    phaseA[g] = { rank1: f.first, rank2: f.second, rank3: f.third };
    bracketRows.push({ user_id: userId, round: "GROUP_TOP_2", slot: i, team_code: f.first });
    bracketRows.push({ user_id: userId, round: "GROUP_TOP_2", slot: 12 + i, team_code: f.second });
  }
  const thirdsRanked = GROUP_CODES.map((g, idx) => ({
    g,
    idx,
    team: RENE_GROUP_FORECAST[g]?.third,
    s: strength(RENE_GROUP_FORECAST[g]?.third ?? ""),
  }))
    .filter((x) => x.team)
    .sort((a, b) => b.s - a.s)
    .slice(0, 8);
  const phaseB = new Set<string>();
  for (const t of thirdsRanked) {
    phaseB.add(t.team!);
    bracketRows.push({ user_id: userId, round: "BEST_THIRDS", slot: t.idx, team_code: t.team! });
  }

  // ── 4. KO-cascade met overrides ──────────────────────────────────────────────
  const r32Slots = computeR32Slots(phaseA, phaseB, teamGroupMap);
  const bracket: Bracket = {};

  for (const mid of MATCH_IDS_BY_ROUND.LAST_32) {
    const slot = r32Slots[mid];
    if (!slot?.home && !slot?.away) continue;
    const winner = pickWinner(mid, slot.home, slot.away);
    if (winner) {
      bracket[mid] = winner;
      bracketRows.push({ user_id: userId, round: "LAST_32", slot: Number(mid.split("-")[1]), team_code: winner });
    }
  }
  function fillRound(round: "LAST_16" | "QUARTER_FINALS" | "SEMI_FINALS" | "FINAL", dbRound: string) {
    for (const mid of MATCH_IDS_BY_ROUND[round]) {
      const node = BRACKET_GRAPH[mid];
      if (node.round === "LAST_32") continue;
      const winner = pickWinner(mid, bracket[node.homeFromMatch], bracket[node.awayFromMatch]);
      if (winner) {
        bracket[mid] = winner;
        const slotNo = mid === "F-1" ? 1 : Number(mid.split("-")[1]);
        bracketRows.push({ user_id: userId, round: dbRound, slot: slotNo, team_code: winner });
      }
    }
  }
  fillRound("LAST_16", "LAST_16");
  fillRound("QUARTER_FINALS", "QUARTER_FINALS");
  fillRound("SEMI_FINALS", "SEMI_FINALS");
  fillRound("FINAL", "FINAL");

  // ── Overzicht knock-out pad ──────────────────────────────────────────────────
  console.log(`🏟️  Knock-out: ${bracketRows.filter((r) => ["LAST_32", "LAST_16", "QUARTER_FINALS", "SEMI_FINALS", "FINAL"].includes(r.round)).length} winnaar-picks`);
  console.log(`   QF: ${["QF-1", "QF-2", "QF-3", "QF-4"].map((q) => bracket[q as MatchId]).join(" · ")}`);
  console.log(`   SF: ${bracket["SF-1"]} v ${bracket["SF-2"]}  →  finale: ${bracket["SF-1"]} v ${bracket["SF-2"]}`);
  console.log(`   🏆 WERELDKAMPIOEN: ${bracket["F-1"]}`);

  // ── 5. Bonus ──────────────────────────────────────────────────────────────────
  console.log(`🎁 Bonus: topscorer=${BONUS.top_scorer} · goals=${BONUS.total_goals_tiebreak} · kaarten=${BONUS.total_yellow_cards_tiebreak}`);
  console.log(`   NL: topscorer=${BONUS.nl_top_scorer} · goals=${BONUS.nl_total_goals} · komt tot=${BONUS.nl_progress}`);

  // ── Group-stage tabel (dry-run inzicht) ──────────────────────────────────────
  if (dryRun) {
    console.log(`\n  ── Groepsfase-uitslagen ──`);
    for (const m of matches ?? []) {
      const p = predRows.find((r) => r.match_id === m.id)!;
      const tag = GROUP_SCORE_OVERRIDES[m.id] ? " *" : "";
      console.log(`  M${String(m.id).padStart(2)} ${m.group_name?.slice(6)}  ${m.home_team} ${p.home_score}-${p.away_score} ${m.away_team}  (${p.toto_pick})${tag}`);
    }
    console.log(`\n  (* = handmatige override)  —  dry-run, niets weggeschreven.\n`);
    return;
  }

  // ── Wegschrijven ──────────────────────────────────────────────────────────────
  for (let i = 0; i < predRows.length; i += 100) {
    const { error } = await supabase.from("predictions").upsert(predRows.slice(i, i + 100), { onConflict: "user_id,match_id" });
    if (error) console.error(`  ❌ predictions: ${error.message}`);
  }
  for (let i = 0; i < bracketRows.length; i += 100) {
    const { error } = await supabase.from("bracket_picks").upsert(bracketRows.slice(i, i + 100), { onConflict: "user_id,round,slot" });
    if (error) console.error(`  ❌ bracket: ${error.message}`);
  }
  const { error: bErr } = await supabase.from("bonus_picks").upsert({ user_id: userId, ...BONUS }, { onConflict: "user_id" });
  if (bErr) console.error(`  ❌ bonus: ${bErr.message}`);

  console.log(`\n  ✅ Giel's poule weggeschreven: ${predRows.length} groepsfase · ${bracketRows.length} bracket · 6 bonus\n`);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
