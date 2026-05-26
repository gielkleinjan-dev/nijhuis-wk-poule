import { createSupabaseServerClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { flagEmoji } from "@/lib/flags";
import {
  scoreGroupPrediction,
  scoreKnockoutMatch,
  KO_POINTS_FULL,
  KO_POINTS_HALF,
  type BracketRound,
  type NLProgress,
} from "@/lib/scoring";
import { computeR32Slots } from "@/lib/bracket/cascade";
import { BRACKET_GRAPH } from "@/lib/bracket/bracket-graph";
import { isGroupCode, type GroupCode, type MatchId } from "@/lib/bracket/types";
import TodayButton from "@/app/components/TodayButton";

function TeamSpan({ code, name, highlighted }: { code: string | undefined | null; name?: string; highlighted?: boolean }) {
  if (!code) return <span className="text-muted italic">—</span>;
  if (highlighted) {
    // Winnaar-pill, zelfde stijl als in de invul-knock-out
    return (
      <span className="inline-flex items-center gap-1 bg-pitch text-white font-semibold border border-pitch rounded px-1.5 py-0.5 max-w-full min-w-0">
        <span aria-hidden className="flag-emoji shrink-0">{flagEmoji(code)}</span>
        <span className="truncate min-w-0">{name ?? code}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 max-w-full min-w-0">
      <span aria-hidden className="flag-emoji shrink-0">{flagEmoji(code)}</span>
      <span className="truncate min-w-0">{name ?? code}</span>
    </span>
  );
}

function PtsChip({ pts }: { pts: number }) {
  const color =
    pts === 0
      ? "text-brand"
      : pts <= 4
      ? "text-amber-600"
      : "text-pitch";
  return (
    <span className={`font-semibold tabular-nums ${color}`}>
      {pts === 0 ? "0" : `+${pts}`}
    </span>
  );
}

const NL_PROGRESS_LABEL: Record<string, string> = {
  GROUP_STAGE: "Uitgeschakeld in groepsfase",
  LAST_32: "Uitgeschakeld in 1/16e finale",
  LAST_16: "Uitgeschakeld in 1/8e finale",
  QUARTER_FINALS: "Uitgeschakeld in kwartfinale",
  SEMI_FINALS: "Uitgeschakeld in halve finale",
  FINAL_LOSER: "Verliest finale (tweede plaats)",
  CHAMPION: "Wereldkampioen",
};

const ROUND_LABEL: Record<BracketRound, string> = {
  LAST_32: "1/16e finale",
  LAST_16: "1/8e finale",
  QUARTER_FINALS: "Kwartfinale",
  SEMI_FINALS: "Halve finale",
  FINAL: "Finale",
  CHAMPION: "Wereldkampioen",
};

const RANK_BADGE: Record<1 | 2, string> = {
  1: "bg-pitch text-white",
  2: "bg-pitch/70 text-white",
};

function normalize(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

function scoreNumber(pick: number | null | undefined, actual: number | null, exact: number, close: number): number {
  if (pick == null || actual == null) return 0;
  const diff = Math.abs(pick - actual);
  if (diff === 0) return exact;
  if (diff <= 3) return close;
  return 0;
}


export default async function VoorspellingDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const supabase = await createSupabaseServerClient();

  const [
    { data: profile },
    { data: matchesRaw },
    { data: predictionsRaw },
    { data: bracketPicksRaw },
    { data: bonusRow },
    { data: teamsRaw },
    { data: bonusSettings },
    { data: overridesRaw },
    // Voor 'Hoe afwijkend ben je?' sectie: alle picks van alle deelnemers
    // (exclusief test-users) om per pick te berekenen hoe mainstream/uniek 'ie is.
    { data: testProfiles },
    { data: allPredictions },
    { data: allBracketPicks },
    { data: allBonusPicks },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, department")
      .eq("id", userId)
      .single(),
    supabase
      .from("matches")
      .select("id, stage, status, group_name, kickoff_at, home_team, away_team, home_score, away_score")
      .order("kickoff_at", { ascending: true }),
    supabase
      .from("predictions")
      .select("match_id, home_score, away_score, toto_pick")
      .eq("user_id", userId),
    supabase
      .from("bracket_picks")
      .select("round, slot, team_code")
      .eq("user_id", userId),
    supabase
      .from("bonus_picks")
      .select("top_scorer, total_goals_tiebreak, total_yellow_cards_tiebreak, nl_top_scorer, nl_total_goals, nl_progress")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase.from("teams").select("code, name"),
    supabase
      .from("settings")
      .select("actual_top_scorer, actual_yellow_cards, actual_nl_top_scorer, actual_nl_total_goals, actual_nl_progress")
      .eq("id", 1)
      .single(),
    supabase
      .from("bracket_match_overrides")
      .select("match_id, side, team_code")
      .eq("user_id", userId),
    supabase
      .from("profiles")
      .select("id")
      .or("department.eq.__LOADTEST__,department.eq.__SCORING_TEST__"),
    supabase.from("predictions").select("user_id, match_id, home_score, away_score, toto_pick"),
    supabase.from("bracket_picks").select("user_id, round, slot, team_code"),
    supabase.from("bonus_picks").select("user_id, top_scorer, nl_top_scorer, nl_progress"),
  ]);

  if (!profile) notFound();

  const teamName = new Map((teamsRaw ?? []).map((t) => [t.code, t.name]));
  const predByMatch = new Map((predictionsRaw ?? []).map((p) => [p.match_id, p]));

  // ── Bonus uitslagen + werkelijke totalen ──────────────────────────────────
  const actualTopScorer = bonusSettings?.actual_top_scorer ?? null;
  const actualYellowCards = bonusSettings?.actual_yellow_cards ?? null;
  const actualNLTopScorer = bonusSettings?.actual_nl_top_scorer ?? null;
  const actualNLTotalGoals = bonusSettings?.actual_nl_total_goals ?? null;
  const actualNLProgress = (bonusSettings?.actual_nl_progress as NLProgress | null) ?? null;
  const actualTotalGoals = (matchesRaw ?? [])
    .filter((m) => m.status === "FINISHED" && m.home_score != null && m.away_score != null)
    .reduce((s, m) => s + (m.home_score ?? 0) + (m.away_score ?? 0), 0);

  // ── Bonus-punten (10/5 + NL all-or-nothing) ───────────────────────────────
  const bonusTopScorerPts = actualTopScorer && bonusRow?.top_scorer && normalize(bonusRow.top_scorer) === normalize(actualTopScorer) ? 10 : 0;
  const bonusYellowPts = scoreNumber(bonusRow?.total_yellow_cards_tiebreak, actualYellowCards, 10, 5);
  const bonusGoalsPts = scoreNumber(bonusRow?.total_goals_tiebreak, actualTotalGoals, 10, 5);
  const bonusNLTopScorerPts = actualNLTopScorer && bonusRow?.nl_top_scorer && normalize(bonusRow.nl_top_scorer) === normalize(actualNLTopScorer) ? 10 : 0;
  const bonusNLGoalsPts = scoreNumber(bonusRow?.nl_total_goals, actualNLTotalGoals, 10, 5);
  const bonusNLProgressPts = bonusRow?.nl_progress && actualNLProgress && bonusRow.nl_progress === actualNLProgress ? 10 : 0;

  const bonusTotalPts =
    bonusTopScorerPts + bonusYellowPts + bonusGoalsPts +
    bonusNLTopScorerPts + bonusNLGoalsPts + bonusNLProgressPts;

  // ── Groepsfase ────────────────────────────────────────────────────────────
  const groupMatches = (matchesRaw ?? []).filter((m) => m.stage === "GROUP_STAGE");

  const teamGroup = new Map<string, string>();
  for (const m of groupMatches) {
    const letter = (m.group_name ?? "").replace("GROUP_", "");
    if (m.home_team) teamGroup.set(m.home_team, letter);
    if (m.away_team) teamGroup.set(m.away_team, letter);
  }
  const grouped = new Map<string, typeof groupMatches>();
  for (const m of groupMatches) {
    const g = m.group_name ?? "?";
    if (!grouped.has(g)) grouped.set(g, []);
    grouped.get(g)!.push(m);
  }
  const sortedGroups = Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b));

  const groupTotalPts = groupMatches.reduce((sum, m) => {
    if (m.status !== "FINISHED" || m.home_score == null || m.away_score == null) return sum;
    const pred = predByMatch.get(m.id);
    if (!pred) return sum;
    return sum + scoreGroupPrediction(pred, { id: m.id, home_score: m.home_score, away_score: m.away_score });
  }, 0);

  // ── Knock-out: tab 1+2 (info-only) ────────────────────────────────────────
  const phaseA: Record<string, { rank1?: string; rank2?: string }> = {};
  const phaseBSet = new Set<string>();
  for (const p of bracketPicksRaw ?? []) {
    if (p.round === "GROUP_TOP_2" && typeof p.slot === "number" && p.team_code) {
      const rank = Math.floor(p.slot / 12) + 1;
      const groupIdx = p.slot % 12;
      const g = String.fromCharCode(65 + groupIdx);
      if (!phaseA[g]) phaseA[g] = {};
      if (rank === 1) phaseA[g].rank1 = p.team_code;
      else if (rank === 2) phaseA[g].rank2 = p.team_code;
    } else if (p.round === "BEST_THIRDS" && p.team_code) {
      phaseBSet.add(p.team_code);
    }
  }

  // Map voor cascade: team-code → GroupCode (alleen ABCDEFGHIJKL)
  const teamGroupMap = new Map<string, GroupCode>();
  for (const [team, letter] of teamGroup) {
    if (isGroupCode(letter)) teamGroupMap.set(team, letter);
  }

  // PhaseA in cascade-compatible vorm (GroupCode keys)
  const phaseAForCascade: Partial<Record<GroupCode, { rank1?: string; rank2?: string }>> = {};
  for (const [g, ranks] of Object.entries(phaseA)) {
    if (isGroupCode(g)) phaseAForCascade[g] = ranks;
  }

  // R32 cascade slots
  const r32Slots = computeR32Slots(phaseAForCascade, phaseBSet, teamGroupMap);

  // Jouw bracket-winnaars per match (uit bracket_picks)
  const userBracket: Partial<Record<MatchId, string>> = {};
  for (const p of bracketPicksRaw ?? []) {
    if (typeof p.slot !== "number" || !p.team_code) continue;
    let mid: MatchId | null = null;
    if (p.round === "LAST_32") mid = `R32-${p.slot}` as MatchId;
    else if (p.round === "LAST_16") mid = `R16-${p.slot}` as MatchId;
    else if (p.round === "QUARTER_FINALS") mid = `QF-${p.slot}` as MatchId;
    else if (p.round === "SEMI_FINALS") mid = `SF-${p.slot}` as MatchId;
    else if (p.round === "FINAL" && p.slot === 1) mid = "F-1" as MatchId;
    if (mid) userBracket[mid] = p.team_code;
  }

  // Overrides per match per side
  const overridesMap: Partial<Record<MatchId, { home?: string; away?: string }>> = {};
  for (const o of overridesRaw ?? []) {
    const mid = o.match_id as MatchId;
    if (!overridesMap[mid]) overridesMap[mid] = {};
    if (o.side === "home") overridesMap[mid]!.home = o.team_code;
    else if (o.side === "away") overridesMap[mid]!.away = o.team_code;
  }

  // Helper: jouw home + away per match (cascade + override)
  function userHomeAway(fifaNo: number, stage: BracketRound): { home?: string; away?: string } {
    let mid: MatchId | null = null;
    if (stage === "LAST_32") mid = `R32-${fifaNo - 72}` as MatchId;
    else if (stage === "LAST_16") mid = `R16-${fifaNo - 88}` as MatchId;
    else if (stage === "QUARTER_FINALS") mid = `QF-${fifaNo - 96}` as MatchId;
    else if (stage === "SEMI_FINALS") mid = `SF-${fifaNo - 100}` as MatchId;
    else if (stage === "FINAL" && fifaNo === 104) mid = "F-1" as MatchId;
    if (!mid) return {};
    const node = BRACKET_GRAPH[mid];
    let h: string | undefined;
    let a: string | undefined;
    if (node.round === "LAST_32") {
      const s = r32Slots[mid];
      h = s?.home;
      a = s?.away;
    } else {
      h = userBracket[node.homeFromMatch];
      a = userBracket[node.awayFromMatch];
    }
    const ov = overridesMap[mid];
    return { home: ov?.home ?? h, away: ov?.away ?? a };
  }

  // ── Knock-out per match (V2 scoring) ──────────────────────────────────────
  const koMatches = (matchesRaw ?? []).filter((m) =>
    ["LAST_32", "LAST_16", "QUARTER_FINALS", "SEMI_FINALS", "FINAL"].includes(m.stage),
  );

  const winnerByMatchId = new Map<number, string>();
  for (const m of koMatches) {
    if (m.status !== "FINISHED" || m.home_score == null || m.away_score == null || m.home_score === m.away_score) continue;
    const w = m.home_score > m.away_score ? m.home_team : m.away_team;
    if (w) winnerByMatchId.set(m.id, w);
  }

  // Werkelijke winnaars per ronde
  const realWinnersByRound: Partial<Record<BracketRound, Set<string>>> = {};
  for (const [mid, winner] of winnerByMatchId) {
    const m = koMatches.find((x) => x.id === mid);
    if (!m) continue;
    const stage = m.stage as BracketRound;
    if (!realWinnersByRound[stage]) realWinnersByRound[stage] = new Set<string>();
    realWinnersByRound[stage]!.add(winner);
  }

  // Per match: jouw winner-pick (uit bracket_picks met slot=N en round=stage)
  const myPickByFifa = new Map<number, string>();
  for (const p of bracketPicksRaw ?? []) {
    if (typeof p.slot !== "number" || !p.team_code) continue;
    const stage = p.round as BracketRound;
    if (!["LAST_32", "LAST_16", "QUARTER_FINALS", "SEMI_FINALS", "FINAL"].includes(stage)) continue;
    let fifaNo: number | null = null;
    if (stage === "LAST_32") fifaNo = 72 + p.slot;
    else if (stage === "LAST_16") fifaNo = 88 + p.slot;
    else if (stage === "QUARTER_FINALS") fifaNo = 96 + p.slot;
    else if (stage === "SEMI_FINALS") fifaNo = 100 + p.slot;
    else if (stage === "FINAL" && p.slot === 1) fifaNo = 104;
    if (fifaNo != null) myPickByFifa.set(fifaNo, p.team_code);
  }

  // Group matches per stage
  const stageOrder: BracketRound[] = ["LAST_32", "LAST_16", "QUARTER_FINALS", "SEMI_FINALS", "FINAL"];
  const koMatchesByStage = new Map<BracketRound, typeof koMatches>();
  for (const stage of stageOrder) koMatchesByStage.set(stage, []);
  for (const m of koMatches) {
    const stage = m.stage as BracketRound;
    if (koMatchesByStage.has(stage)) koMatchesByStage.get(stage)!.push(m);
  }
  for (const arr of koMatchesByStage.values()) {
    arr.sort((a, b) => a.id - b.id);
  }

  // Score per ronde + per match
  type MatchScore = {
    match: (typeof koMatches)[number];
    myHome: string | undefined;
    myAway: string | undefined;
    myPick: string | undefined;
    actualWinner: string | undefined;
    pts: number;
  };
  const koByStage = new Map<BracketRound, { matches: MatchScore[]; subtotal: number }>();
  for (const stage of stageOrder) {
    const matches = koMatchesByStage.get(stage) ?? [];
    const allRoundWinners = realWinnersByRound[stage] ?? new Set<string>();
    const matchScores: MatchScore[] = matches.map((m) => {
      const myPick = myPickByFifa.get(m.id);
      const actualWinner = winnerByMatchId.get(m.id);
      const pts = scoreKnockoutMatch(myPick, actualWinner, allRoundWinners, stage);
      const { home: myHome, away: myAway } = userHomeAway(m.id, stage);
      return { match: m, myHome, myAway, myPick, actualWinner, pts };
    });
    const subtotal = matchScores.reduce((s, ms) => s + ms.pts, 0);
    koByStage.set(stage, { matches: matchScores, subtotal });
  }
  const koTotalPts = Array.from(koByStage.values()).reduce((s, x) => s + x.subtotal, 0);

  const grandTotal = groupTotalPts + koTotalPts + bonusTotalPts;

  const fmt = (kickoff: string) =>
    new Intl.DateTimeFormat("nl-NL", {
      weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
    }).format(new Date(kickoff));

  // ── 'Hoe afwijkend ben je?' aggregatie ─────────────────────────────────
  // Filter test-users uit voor schone cijfers.
  const testIds = new Set((testProfiles ?? []).map((p) => p.id));
  const realPredictions = (allPredictions ?? []).filter((p) => !testIds.has(p.user_id));
  const realBracket = (allBracketPicks ?? []).filter((p) => !testIds.has(p.user_id));
  const realBonus = (allBonusPicks ?? []).filter((p) => !testIds.has(p.user_id));

  // Per match: hoe vaak komt elke exacte tuple voor? + hoeveel users voorspelden
  const matchTupleCounts = new Map<string, number>();         // key: "matchId|h-a-t" -> count
  const matchUserCounts = new Map<number, number>();          // matchId -> aantal users
  for (const p of realPredictions) {
    if (p.home_score == null || p.away_score == null) continue;
    matchUserCounts.set(p.match_id, (matchUserCounts.get(p.match_id) ?? 0) + 1);
    const k = `${p.match_id}|${p.home_score}-${p.away_score}-${p.toto_pick ?? "_"}`;
    matchTupleCounts.set(k, (matchTupleCounts.get(k) ?? 0) + 1);
  }

  // Per (round,slot): hoe vaak welk land + totaal voorspellers
  const bracketTupleCounts = new Map<string, number>();      // "round|slot|code" -> count
  const bracketSlotCounts = new Map<string, number>();       // "round|slot" -> totaal users
  for (const p of realBracket) {
    if (!p.team_code) continue;
    const slot = `${p.round}|${p.slot}`;
    bracketSlotCounts.set(slot, (bracketSlotCounts.get(slot) ?? 0) + 1);
    const k = `${slot}|${p.team_code}`;
    bracketTupleCounts.set(k, (bracketTupleCounts.get(k) ?? 0) + 1);
  }

  // Bonus per veld: count per waarde + totaal
  type BonusField = "top_scorer" | "nl_top_scorer" | "nl_progress";
  const bonusFieldCounts: Record<BonusField, Map<string, number>> = {
    top_scorer: new Map(),
    nl_top_scorer: new Map(),
    nl_progress: new Map(),
  };
  const bonusFieldTotals: Record<BonusField, number> = {
    top_scorer: 0,
    nl_top_scorer: 0,
    nl_progress: 0,
  };
  for (const b of realBonus) {
    for (const field of ["top_scorer", "nl_top_scorer", "nl_progress"] as const) {
      const v = b[field];
      if (!v) continue;
      bonusFieldTotals[field]++;
      const m = bonusFieldCounts[field];
      m.set(v, (m.get(v) ?? 0) + 1);
    }
  }

  // Bouw lijst van ALLE picks van DEZE user, elk met een agreement-percentage
  type AgreementPick = {
    category: "groep" | "knockout" | "bonus";
    label: string;             // bv. "NL-Mex 2-1" of "Wereldkampioen"
    value: string;             // bv. "2-1 toto:1" of "BRA"
    valueDisplay: string;      // bv. "Brazilië" of "1-1 (X)"
    agreementPct: number;      // 0-100, hoeveel ANDERE users hebben dezelfde pick
    others: number;            // n_anderen met dezelfde pick
    totalOthers: number;       // n_anderen in deze pool
  };
  const userPicks: AgreementPick[] = [];

  // Groepsfase predictions van deze user
  for (const p of predictionsRaw ?? []) {
    if (p.home_score == null || p.away_score == null) continue;
    const tupleKey = `${p.match_id}|${p.home_score}-${p.away_score}-${p.toto_pick ?? "_"}`;
    const sameCount = matchTupleCounts.get(tupleKey) ?? 0;
    const others = Math.max(0, sameCount - 1); // exclusief mezelf
    const totalUsers = matchUserCounts.get(p.match_id) ?? 0;
    const totalOthers = Math.max(0, totalUsers - 1);
    if (totalOthers === 0) continue;
    const match = (matchesRaw ?? []).find((m) => m.id === p.match_id);
    const homeCode = match?.home_team ?? "?";
    const awayCode = match?.away_team ?? "?";
    const homeName = teamName.get(homeCode) ?? homeCode;
    const awayName = teamName.get(awayCode) ?? awayCode;
    userPicks.push({
      category: "groep",
      label: `${homeName} – ${awayName}`,
      value: tupleKey,
      valueDisplay: `${p.home_score}–${p.away_score}${p.toto_pick ? ` (${p.toto_pick})` : ""}`,
      agreementPct: (others / totalOthers) * 100,
      others,
      totalOthers,
    });
  }

  // Knock-out: alle slot-picks van deze user. Label is sprekend per type:
  //   GROUP_TOP_2 slot 0..11 = Nummer 1 poule A..L
  //   GROUP_TOP_2 slot 12..23 = Nummer 2 poule A..L
  //   BEST_THIRDS slot 0..11 = Beste 3e van poule A..L
  //   LAST_32..FINAL slot N = "1/16e wedstrijd #N" enz.
  const roundLabelGeneric: Record<string, string> = {
    LAST_32: "1/16e finale",
    LAST_16: "1/8e finale",
    QUARTER_FINALS: "Kwartfinale",
    SEMI_FINALS: "Halve finale",
    FINAL: "Finale",
  };
  function bracketLabel(round: string, slot: number): string {
    if (round === "GROUP_TOP_2") {
      const rank = Math.floor(slot / 12) + 1;
      const group = String.fromCharCode(65 + (slot % 12));
      return `Nummer ${rank} poule ${group}`;
    }
    if (round === "BEST_THIRDS") {
      const group = String.fromCharCode(65 + (slot % 12));
      return `Beste 3e (poule ${group})`;
    }
    const generic = roundLabelGeneric[round];
    if (generic) return `${generic} (wedstrijd ${slot})`;
    return round;
  }
  for (const p of bracketPicksRaw ?? []) {
    if (!p.team_code) continue;
    const slotKey = `${p.round}|${p.slot}`;
    const tupleKey = `${slotKey}|${p.team_code}`;
    const sameCount = bracketTupleCounts.get(tupleKey) ?? 0;
    const others = Math.max(0, sameCount - 1);
    const totalUsers = bracketSlotCounts.get(slotKey) ?? 0;
    const totalOthers = Math.max(0, totalUsers - 1);
    if (totalOthers === 0) continue;
    userPicks.push({
      category: "knockout",
      label: bracketLabel(p.round, p.slot ?? 0),
      value: tupleKey,
      valueDisplay: teamName.get(p.team_code) ?? p.team_code,
      agreementPct: (others / totalOthers) * 100,
      others,
      totalOthers,
    });
  }

  // Bonus: top_scorer, nl_top_scorer, nl_progress van deze user
  const bonusLabel: Record<BonusField, string> = {
    top_scorer: "Topscorer toernooi",
    nl_top_scorer: "Topscorer NL",
    nl_progress: "Hoever komt NL",
  };
  for (const field of ["top_scorer", "nl_top_scorer", "nl_progress"] as const) {
    const v = bonusRow?.[field];
    if (!v) continue;
    const sameCount = bonusFieldCounts[field].get(v) ?? 0;
    const others = Math.max(0, sameCount - 1);
    const totalOthers = Math.max(0, bonusFieldTotals[field] - 1);
    if (totalOthers === 0) continue;
    const display = field === "nl_progress" ? (NL_PROGRESS_LABEL[v] ?? v) : v;
    userPicks.push({
      category: "bonus",
      label: bonusLabel[field],
      value: `${field}|${v}`,
      valueDisplay: display,
      agreementPct: (others / totalOthers) * 100,
      others,
      totalOthers,
    });
  }

  // Overall uniekheid = gemiddelde van (100 - agreement%)
  const uniqueness = userPicks.length === 0
    ? 0
    : userPicks.reduce((s, p) => s + (100 - p.agreementPct), 0) / userPicks.length;

  // Top mainstream (hoogste agreement) en top contrarian (laagste)
  const sortedByAgreement = [...userPicks].sort((a, b) => b.agreementPct - a.agreementPct);
  const mostMainstream = sortedByAgreement.slice(0, 3);
  const mostContrarian = [...sortedByAgreement].reverse().slice(0, 3);

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-8 space-y-8 sm:space-y-10">
      <div>
        <Link href="/voorspellingen" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink transition">
          ← Alle deelnemers
        </Link>
      </div>

      <div className="tab-hero bg-surface border border-border rounded-lg p-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-0.5">{profile.display_name}</h1>
          <p className="text-sm text-muted">
            {profile.department ?? "Geen team"} · ingevulde voorspellingen (alleen-lezen)
          </p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-3xl font-bold tabular-nums text-pitch">+{grandTotal}</div>
          <div className="text-xs text-muted">totaal pt</div>
        </div>
      </div>

      {/* ── Hoe afwijkend? — direct na header voor prominentie ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">🦄 Hoe afwijkend?</h2>
          {userPicks.length >= 3 && (
            <span className="text-sm font-semibold text-trophy tabular-nums">
              {Math.round(uniqueness)}% uniek
            </span>
          )}
        </div>
        {userPicks.length < 3 ? (
          <div className="bg-surface border border-border rounded-lg p-5">
            <p className="text-sm text-muted">
              Te weinig vergelijkbare picks om deze sectie te kunnen tonen.
              Hoort hier te verschijnen zodra {profile.display_name} (of de
              andere deelnemers) meer voorspellingen heeft ingevuld.
            </p>
          </div>
        ) : (
          <div className="bg-surface border border-border rounded-lg p-5">
            <p className="text-sm text-muted mb-4">
              Per pick van {profile.display_name} keek ik hoeveel andere
              collega's exact dezelfde keuze maakten. Gemiddeld over alle{" "}
              <strong>{userPicks.length} voorspellingen</strong>:{" "}
              <strong>{Math.round(100 - uniqueness)}%</strong> koos hetzelfde,
              de overige <strong>{Math.round(uniqueness)}%</strong> gokte
              anders.{" "}
              {uniqueness >= 75
                ? "Een echte eenling — bijna niemand zat op dezelfde lijn."
                : uniqueness >= 50
                ? "Echt eigenwijs — meer dan de helft koos iets anders."
                : uniqueness >= 30
                ? "Mooie mix: gedeeltelijk consensus, gedeeltelijk eigen koers."
                : uniqueness >= 15
                ? "Vooral mainstream, met hier en daar een afwijkende keuze."
                : "Volledig in lijn met de groep — bijna iedereen dacht hetzelfde."}
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              {/* Mainstream */}
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-pitch mb-2">
                  Mainstream-picks
                </h3>
                <p className="text-xs text-muted mb-3">
                  Eensgezind met de meerderheid van Nijhuis
                </p>
                <ul className="space-y-2 text-sm">
                  {mostMainstream.map((p, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-pitch/15 text-pitch text-[10px] font-bold shrink-0 mt-0.5">
                        {Math.round(p.agreementPct)}%
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs text-muted">{p.label}</div>
                        <div className="font-medium truncate">{p.valueDisplay}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
              {/* Contrarian */}
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-trophy mb-2">
                  Tegen de stroom
                </h3>
                <p className="text-xs text-muted mb-3">
                  Eenzaamste keuzes — minste anderen kozen dit
                </p>
                <ul className="space-y-2 text-sm">
                  {mostContrarian.map((p, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-trophy/15 text-trophy-600 text-[10px] font-bold shrink-0 mt-0.5">
                        {Math.round(p.agreementPct)}%
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs text-muted">{p.label}</div>
                        <div className="font-medium truncate">{p.valueDisplay}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ── Groepsfase ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Groepsfase</h2>
          <span className="text-sm font-semibold text-pitch tabular-nums">+{groupTotalPts} pt</span>
        </div>

        {sortedGroups.map(([group, ms]) => (
          <div key={group} className="bg-surface border border-border rounded-lg overflow-hidden">
            <div className="px-4 sm:px-5 py-3 border-b border-border bg-bg/50 text-sm font-bold">
              Groep {group.replace("GROUP_", "")}
            </div>
            <div className="hidden sm:grid grid-cols-[1fr_5rem_8rem_3rem] gap-2 px-4 py-2 border-b border-border text-xs text-muted uppercase tracking-wide bg-bg/30">
              <div>Wedstrijd</div>
              <div className="text-center">Uitslag</div>
              <div className="text-center">Voorspelling</div>
              <div className="text-right">Pt</div>
            </div>
            <ul className="divide-y divide-border">
              {ms.map((m) => {
                const pred = predByMatch.get(m.id);
                const finished = m.status === "FINISHED" && m.home_score != null && m.away_score != null;
                const pts = finished && pred
                  ? scoreGroupPrediction(pred, { id: m.id, home_score: m.home_score!, away_score: m.away_score! })
                  : null;
                const hasScore = pred && pred.home_score != null && pred.away_score != null;
                const toto = pred ? (pred.toto_pick ?? (hasScore
                  ? pred.home_score! > pred.away_score! ? "1"
                    : pred.home_score! < pred.away_score! ? "2"
                    : "X"
                  : null)) : null;
                return (
                  <li key={m.id} data-kickoff={m.kickoff_at} className="px-3 sm:px-4 py-2.5 sm:grid sm:grid-cols-[1fr_5rem_8rem_3rem] sm:gap-2 sm:items-center">
                    <div>
                      <div className="flex items-center gap-1.5 font-medium text-xs flex-wrap">
                        <span className="flag-emoji" aria-hidden>{flagEmoji(m.home_team ?? "")}</span>
                        <span className="text-muted">{teamName.get(m.home_team ?? "") ?? m.home_team}</span>
                        <span className="text-muted mx-0.5">vs</span>
                        <span className="text-muted">{teamName.get(m.away_team ?? "") ?? m.away_team}</span>
                        <span className="flag-emoji" aria-hidden>{flagEmoji(m.away_team ?? "")}</span>
                      </div>
                      <div className="text-[10px] text-muted mt-0.5">{fmt(m.kickoff_at)}</div>
                    </div>
                    <div className="flex items-center justify-between gap-3 mt-2 sm:mt-0 sm:contents">
                      <div className="sm:text-center tabular-nums font-bold text-sm">
                        <span className="sm:hidden text-[10px] text-muted font-normal mr-1">Uitslag:</span>
                        {finished ? <span>{m.home_score}–{m.away_score}</span> : <span className="text-muted font-normal">—</span>}
                      </div>
                      <div className="sm:text-center tabular-nums text-sm">
                        <span className="sm:hidden text-[10px] text-muted font-normal mr-1">Voorsp:</span>
                        {pred ? (
                          <span className="inline-flex items-center gap-1.5">
                            {hasScore && <span className="font-semibold">{pred.home_score}–{pred.away_score}</span>}
                            {toto && <span className="inline-block bg-brand text-white rounded px-1.5 py-0.5 text-xs font-bold">{toto}</span>}
                          </span>
                        ) : <span className="text-muted italic text-xs">—</span>}
                      </div>
                      <div className="sm:text-right">
                        {pts == null ? <span className="text-muted text-xs">—</span> : <PtsChip pts={pts} />}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </section>

      {/* ── Knock-out: bracket per wedstrijd ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Knock-out schema</h2>
          <span className="text-sm font-semibold text-pitch tabular-nums">+{koTotalPts} pt</span>
        </div>

        {stageOrder.map((stage) => {
          const data = koByStage.get(stage);
          if (!data || data.matches.length === 0) return null;
          const full = KO_POINTS_FULL[stage];
          const half = KO_POINTS_HALF[stage];
          return (
            <div key={stage} className="bg-surface border border-border rounded-lg overflow-hidden">
              <div className="px-5 py-3 border-b border-border bg-bg/50 flex items-start justify-between gap-3">
                <div>
                  <span className="text-sm font-bold">{ROUND_LABEL[stage]}</span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    <span className="bg-pitch text-white text-[11px] font-semibold px-1.5 py-0.5 rounded">
                      {full} pt juiste land op juiste plek
                    </span>
                    {half > 0 && (
                      <span className="bg-amber-100 text-amber-800 border border-amber-200 text-[11px] font-semibold px-1.5 py-0.5 rounded">
                        {half} pt juiste land op verkeerde plek
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-sm font-bold text-pitch tabular-nums shrink-0">+{data.subtotal}</span>
              </div>
              <div className="hidden sm:grid grid-cols-[7rem_1fr_1fr_3rem] gap-2 px-4 py-2 border-b border-border text-xs text-muted uppercase tracking-wide bg-bg/30">
                <div>Wedstrijd</div>
                <div>Voorspelling</div>
                <div>Werkelijk</div>
                <div className="text-right">Pt</div>
              </div>
              <ul className="divide-y divide-border">
                {data.matches.map(({ match: m, myHome, myAway, myPick, actualWinner, pts }) => {
                  const finished = m.status === "FINISHED" && m.home_score != null && m.away_score != null;
                  const realHomeWon = finished && (m.home_score ?? 0) > (m.away_score ?? 0);
                  const realAwayWon = finished && (m.away_score ?? 0) > (m.home_score ?? 0);
                  return (
                    <li key={m.id} data-kickoff={m.kickoff_at} className="px-3 sm:px-4 py-2.5 sm:grid sm:grid-cols-[7rem_1fr_1fr_3rem] sm:gap-2 sm:items-center">
                      <div>
                        <div className="text-[10px] font-mono text-muted">W{m.id}</div>
                        <div className="text-[10px] text-muted">{fmt(m.kickoff_at)}</div>
                      </div>
                      {/* Voorspelling: jouw home/away + jouw winnaar groen gemarkeerd */}
                      <div className="mt-1.5 sm:mt-0">
                        <span className="sm:hidden text-[10px] text-muted block mb-0.5">Voorspelling:</span>
                        {myHome || myAway ? (
                          <div className="text-xs flex items-center gap-1 flex-wrap">
                            <TeamSpan code={myHome} name={myHome ? teamName.get(myHome) : undefined} highlighted={myPick === myHome && !!myPick} />
                            <span className="text-muted">vs</span>
                            <TeamSpan code={myAway} name={myAway ? teamName.get(myAway) : undefined} highlighted={myPick === myAway && !!myPick} />
                            {myPick && myPick !== myHome && myPick !== myAway && (
                              <span className="ml-1 text-[10px] text-amber-700">(override: {teamName.get(myPick) ?? myPick})</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted italic text-xs">niet ingevuld</span>
                        )}
                      </div>
                      {/* Werkelijk: echte teams + score + winnaar groen */}
                      <div className="mt-1.5 sm:mt-0">
                        <span className="sm:hidden text-[10px] text-muted block mb-0.5">Werkelijk:</span>
                        {m.home_team && m.away_team ? (
                          <div className="text-xs flex items-center gap-1 flex-wrap">
                            <TeamSpan code={m.home_team} name={teamName.get(m.home_team)} highlighted={realHomeWon} />
                            <span className="text-muted">
                              {finished ? `${m.home_score}–${m.away_score}` : "vs"}
                            </span>
                            <TeamSpan code={m.away_team} name={teamName.get(m.away_team)} highlighted={realAwayWon} />
                            {finished && !actualWinner && m.home_score === m.away_score && (
                              <span className="text-[10px] text-muted italic">(gelijkspel / TBD)</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted italic text-xs">teams nog niet bekend</span>
                        )}
                      </div>
                      {/* Punten */}
                      <div className="sm:text-right mt-1.5 sm:mt-0">
                        {finished ? (
                          <PtsChip pts={pts} />
                        ) : (
                          <span className="text-muted text-xs">—</span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </section>

      {/* ── Bonus ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Bonus</h2>
          <span className="text-sm font-semibold text-pitch tabular-nums">+{bonusTotalPts} pt</span>
        </div>
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <div className="hidden sm:grid grid-cols-[1fr_1fr_1fr_3rem] gap-2 px-4 py-2 border-b border-border text-xs text-muted uppercase tracking-wide bg-bg/30">
            <div>Vraag</div>
            <div>Antwoord</div>
            <div>Uitslag</div>
            <div className="text-right">Pt</div>
          </div>
          <ul className="divide-y divide-border">
            {[
              { label: "Topscorer toernooi", answer: bonusRow?.top_scorer, actual: actualTopScorer, pts: bonusTopScorerPts, fmt: (v: unknown) => (typeof v === "string" || typeof v === "number") ? String(v) : null },
              { label: "Gele kaarten toernooi", answer: bonusRow?.total_yellow_cards_tiebreak, actual: actualYellowCards, pts: bonusYellowPts, fmt: (v: unknown) => v != null ? String(v) : null },
              { label: "Doelpunten toernooi", sub: "(beslisser)", answer: bonusRow?.total_goals_tiebreak, actual: actualTotalGoals, pts: bonusGoalsPts, fmt: (v: unknown) => v != null ? String(v) : null },
              { label: "🇳🇱 Topscorer NL", answer: bonusRow?.nl_top_scorer, actual: actualNLTopScorer, pts: bonusNLTopScorerPts, fmt: (v: unknown) => (typeof v === "string" || typeof v === "number") ? String(v) : null },
              { label: "🇳🇱 Doelpunten NL", answer: bonusRow?.nl_total_goals, actual: actualNLTotalGoals, pts: bonusNLGoalsPts, fmt: (v: unknown) => v != null ? String(v) : null },
              { label: "🇳🇱 Ronde NL", answer: bonusRow?.nl_progress, actual: actualNLProgress, pts: bonusNLProgressPts, fmt: (v: unknown) => typeof v === "string" ? (NL_PROGRESS_LABEL[v] ?? v) : null },
            ].map((r) => {
              const answerStr = r.fmt(r.answer);
              const actualStr = r.fmt(r.actual);
              return (
                <li key={r.label} className="px-3 sm:px-4 py-3 sm:grid sm:grid-cols-[1fr_1fr_1fr_3rem] sm:gap-2 sm:items-center">
                  <div className="text-muted">
                    {r.label}
                    {r.sub && <span className="text-[10px] text-amber-600 ml-1">{r.sub}</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-1 sm:mt-0">
                    <span className="sm:hidden text-[10px] text-muted">Antwoord:</span>
                    <span className="font-medium tabular-nums">
                      {answerStr ?? <span className="text-muted italic text-xs not-italic font-normal">niet ingevuld</span>}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 sm:mt-0">
                    <span className="sm:hidden text-[10px] text-muted">Uitslag:</span>
                    <span className="font-medium tabular-nums">
                      {actualStr ?? <span className="text-muted">—</span>}
                    </span>
                  </div>
                  <div className="sm:text-right mt-1 sm:mt-0">
                    {r.pts > 0 ? <PtsChip pts={r.pts} /> : <span className="text-muted text-xs">—</span>}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>
      <TodayButton />
    </div>
  );
}
