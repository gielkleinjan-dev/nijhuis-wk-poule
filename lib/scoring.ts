// Pure scoring logic for the WK-poule.
//
// All functions in this file except `recomputeUserPoints` are pure: they take
// plain data and return points. The caller (a cron route) is responsible for
// fetching match results and building a `winnerByMatchId` map — penalty
// shoot-outs are NOT derivable from `home_score`/`away_score` alone, so the
// cron should consult football-data.org's winner field directly and only fall
// back to score-compare when scores differ.

import type { SupabaseClient } from "@supabase/supabase-js";

export type BracketRound =
  | "LAST_32"
  | "LAST_16"
  | "QUARTER_FINALS"
  | "SEMI_FINALS"
  | "FINAL"
  | "CHAMPION";

export type MatchResult = {
  id: number;
  home_score: number;
  away_score: number;
};

export type Prediction = {
  match_id: number;
  home_score: number | null;
  away_score: number | null;
  toto_pick?: string | null;
};

export type BracketPick = {
  round: BracketRound;
  team_code: string;
};

export type BonusPicks = {
  top_scorer: string | null;
  total_goals_tiebreak: number | null;
  total_yellow_cards_tiebreak: number | null;
};

export const KO_POINTS: Record<BracketRound, number> = {
  LAST_32: 4,
  LAST_16: 7,
  QUARTER_FINALS: 12,
  SEMI_FINALS: 18,
  FINAL: 28,
  CHAMPION: 40,
};

const KO_ORDER: BracketRound[] = [
  "LAST_32",
  "LAST_16",
  "QUARTER_FINALS",
  "SEMI_FINALS",
  "FINAL",
  "CHAMPION",
];

// For rounds LAST_16 and later: survivors = winners of previous stage matches.
// LAST_32 is special: survivors = all participants in LAST_32 matches (group qualifiers).
const PREVIOUS_STAGE: Partial<Record<BracketRound, string>> = {
  LAST_16: "LAST_32",
  QUARTER_FINALS: "LAST_16",
  SEMI_FINALS: "QUARTER_FINALS",
  FINAL: "SEMI_FINALS",
  CHAMPION: "FINAL",
};

export function scoreGroupPrediction(p: Prediction, a: MatchResult): number {
  const hasScores = p.home_score != null && p.away_score != null;
  if (!hasScores && !p.toto_pick) return 0;

  const actualToto = a.home_score > a.away_score ? "1" : a.home_score < a.away_score ? "2" : "X";
  let pts = 0;
  if (hasScores) {
    if (p.home_score === a.home_score) pts += 2;
    if (p.away_score === a.away_score) pts += 2;
  }
  // Explicit toto_pick wins; otherwise derive from score when available.
  const effectiveToto =
    p.toto_pick ??
    (hasScores
      ? p.home_score! > p.away_score!
        ? "1"
        : p.home_score! < p.away_score!
          ? "2"
          : "X"
      : null);
  if (effectiveToto && effectiveToto === actualToto) pts += 1;
  return pts;
}

export function scoreKnockoutRound(
  picks: string[],
  survivors: Set<string>,
  round: BracketRound,
): number {
  let hits = 0;
  for (const code of picks) if (survivors.has(code)) hits++;
  return hits * KO_POINTS[round];
}

function normalizeName(s: string): string {
  return s.trim().toLowerCase().normalize("NFKC");
}

function scoreNumeric(
  pick: number | null,
  actual: number | null | undefined,
  exactPts: number,
  closePts: number,
): number {
  if (pick == null || actual == null) return 0;
  const diff = Math.abs(pick - actual);
  if (diff === 0) return exactPts;
  if (diff <= 3) return closePts;
  return 0;
}

export function scoreBonus(
  picks: BonusPicks,
  result: {
    topScorer: string | null;
    totalGoals?: number | null;
    totalYellowCards?: number | null;
  },
): { topScorer: number; totalGoals: number; totalYellowCards: number } {
  const topScorer =
    picks.top_scorer &&
    result.topScorer &&
    normalizeName(picks.top_scorer) === normalizeName(result.topScorer)
      ? 15
      : 0;
  const totalGoals = scoreNumeric(picks.total_goals_tiebreak, result.totalGoals, 15, 8);
  const totalYellowCards = scoreNumeric(picks.total_yellow_cards_tiebreak, result.totalYellowCards, 15, 8);
  return { topScorer, totalGoals, totalYellowCards };
}

export function deriveSurvivors(
  matches: Array<{ id: number; stage: string; status: string; home_team?: string | null; away_team?: string | null }>,
  winnerByMatchId: Map<number, string>,
): Record<BracketRound, Set<string>> {
  // LAST_32 survivors = all teams that appear as participants in LAST_32 matches.
  // These are the group-stage qualifiers; home_team/away_team are null (TBD) until
  // groups finish and the bracket is seeded by the cron job.
  const last32Participants = new Set<string>();
  for (const m of matches) {
    if (m.stage !== "LAST_32") continue;
    if (m.home_team) last32Participants.add(m.home_team);
    if (m.away_team) last32Participants.add(m.away_team);
  }

  // LAST_16 and later: survivors = winners of the previous stage's matches.
  const winnersByStage = new Map<string, Set<string>>();
  for (const m of matches) {
    if (m.status !== "FINISHED") continue;
    const w = winnerByMatchId.get(m.id);
    if (!w) continue;
    if (!winnersByStage.has(m.stage)) winnersByStage.set(m.stage, new Set());
    winnersByStage.get(m.stage)!.add(w);
  }

  const out = {} as Record<BracketRound, Set<string>>;
  out["LAST_32"] = last32Participants;
  for (const round of KO_ORDER.filter((r) => r !== "LAST_32")) {
    out[round] = winnersByStage.get(PREVIOUS_STAGE[round]!) ?? new Set();
  }
  return out;
}

export type PointsRow = {
  source: "group" | "knockout" | "bonus";
  ref_id: string;
  points: number;
};

// Splitst bracket_picks-rijen in (a) LAST_32-teams (afgeleid uit V2-rijen
// GROUP_TOP_2 + BEST_THIRDS, of als die ontbreken: uit V1-rijen met round=LAST_32),
// en (b) de overige picks (R16+). Wanneer een gebruiker tegelijk V1- en V2-rijen
// heeft, winnen V2-rijen — V1-LAST_32 wordt genegeerd om dubbele punten te
// voorkomen tijdens migratie.
export function expandBracketPicksForScoring(
  bracketPicks: ReadonlyArray<{ round: string; team_code: string; slot?: number | null }>,
): { last32Teams: Set<string>; otherPicks: Array<{ round: string; team_code: string }> } {
  const hasV2Picks = bracketPicks.some(
    (p) => p.round === "GROUP_TOP_2" || p.round === "BEST_THIRDS",
  );
  const last32Teams = new Set<string>();
  const otherPicks: Array<{ round: string; team_code: string }> = [];
  for (const pick of bracketPicks) {
    if (pick.round === "GROUP_TOP_2") {
      // Slot-encoding: (rank-1)*12 + groupIdx → rank1=0..11, rank2=12..23, rank3=24..35.
      // Alleen rank1+2 tellen automatisch mee in LAST_32. Rank3 = metadata,
      // pas via BEST_THIRDS round-rij gaat een nr3 daadwerkelijk door.
      if (typeof pick.slot === "number" && pick.slot >= 0 && pick.slot < 24) {
        last32Teams.add(pick.team_code);
      }
    } else if (pick.round === "BEST_THIRDS") {
      last32Teams.add(pick.team_code);
    } else if (pick.round === "LAST_32") {
      if (!hasV2Picks) last32Teams.add(pick.team_code);
    } else {
      otherPicks.push(pick);
    }
  }
  return { last32Teams, otherPicks };
}

export type RecomputeContext = {
  winnerByMatchId: Map<number, string>;
  topScorer: string | null;
  totalGoals?: number | null;
  totalYellowCards?: number | null;
};

// Fetches a single user's predictions/picks/bonus from Supabase and returns
// the rows that should land in the `points` table. Pure-ish: read-only.
// The caller writes the rows (via service-role or via cron_replace_user_points RPC).
export async function computeUserPointRows(
  userId: string,
  supabase: SupabaseClient,
  ctx: RecomputeContext,
): Promise<PointsRow[]> {
  const [
    { data: matches, error: mErr },
    { data: predictions, error: pErr },
    { data: bracketPicks, error: bErr },
    { data: bonusRow, error: boErr },
  ] = await Promise.all([
    supabase.from("matches").select("id, stage, status, home_score, away_score, home_team, away_team"),
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
      .select("top_scorer, surprise_team, total_goals_tiebreak, total_yellow_cards_tiebreak")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);
  if (mErr) throw mErr;
  if (pErr) throw pErr;
  if (bErr) throw bErr;
  if (boErr) throw boErr;

  const rows: PointsRow[] = [];
  const matchById = new Map<
    number,
    { home_score: number | null; away_score: number | null; status: string; stage: string }
  >();
  for (const m of matches ?? []) matchById.set(m.id, m);

  for (const pred of predictions ?? []) {
    const m = matchById.get(pred.match_id);
    if (!m || m.status !== "FINISHED") continue;
    if (m.home_score == null || m.away_score == null) continue;
    // Skip if neither exact score nor toto is filled
    if (pred.home_score == null && pred.away_score == null && !pred.toto_pick) continue;
    const pts = scoreGroupPrediction(pred, {
      id: pred.match_id,
      home_score: m.home_score,
      away_score: m.away_score,
    });
    if (pts > 0) rows.push({ source: "group", ref_id: String(pred.match_id), points: pts });
  }

  const survivors = deriveSurvivors(matches ?? [], ctx.winnerByMatchId);

  const { last32Teams, otherPicks } = expandBracketPicksForScoring(bracketPicks ?? []);

  // Score LAST_32 (dedupe op team)
  for (const team of last32Teams) {
    if (survivors["LAST_32"].has(team)) {
      rows.push({
        source: "knockout",
        ref_id: `LAST_32:${team}`,
        points: KO_POINTS["LAST_32"],
      });
    }
  }

  // Score overige rondes (R16 t/m CHAMPION)
  for (const pick of otherPicks) {
    const round = pick.round as BracketRound;
    if (!(round in KO_POINTS)) continue;
    if (survivors[round].has(pick.team_code)) {
      rows.push({
        source: "knockout",
        ref_id: `${round}:${pick.team_code}`,
        points: KO_POINTS[round],
      });
    }
  }

  if (bonusRow) {
    const bonus = scoreBonus(bonusRow, {
      topScorer: ctx.topScorer,
      totalGoals: ctx.totalGoals,
      totalYellowCards: ctx.totalYellowCards,
    });
    if (bonus.topScorer > 0) rows.push({ source: "bonus", ref_id: "top_scorer", points: bonus.topScorer });
    if (bonus.totalGoals > 0) rows.push({ source: "bonus", ref_id: "total_goals", points: bonus.totalGoals });
    if (bonus.totalYellowCards > 0) rows.push({ source: "bonus", ref_id: "total_yellow_cards", points: bonus.totalYellowCards });
  }

  return rows;
}
