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

// FIFA match-nummer → (stage, slot). Spiegel van slotToFifaNo in scoring.ts.
function fifaNoToSlot(stage: BracketRound, fifaNo: number): number | null {
  switch (stage) {
    case "LAST_32": return fifaNo - 72;
    case "LAST_16": return fifaNo - 88;
    case "QUARTER_FINALS": return fifaNo - 96;
    case "SEMI_FINALS": return fifaNo - 100;
    case "FINAL": return fifaNo === 104 ? 1 : null;
    default: return null;
  }
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
  type MatchScore = { match: (typeof koMatches)[number]; myPick: string | undefined; actualWinner: string | undefined; pts: number; };
  const koByStage = new Map<BracketRound, { matches: MatchScore[]; subtotal: number }>();
  for (const stage of stageOrder) {
    const matches = koMatchesByStage.get(stage) ?? [];
    const allRoundWinners = realWinnersByRound[stage] ?? new Set<string>();
    const matchScores: MatchScore[] = matches.map((m) => {
      const myPick = myPickByFifa.get(m.id);
      const actualWinner = winnerByMatchId.get(m.id);
      const pts = scoreKnockoutMatch(myPick, actualWinner, allRoundWinners, stage);
      return { match: m, myPick, actualWinner, pts };
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

  // Silence unused-import warnings (gebruikt in PtsChip/KO_POINTS via tests + render)
  void KO_POINTS_HALF; void fifaNoToSlot;

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-8 space-y-8 sm:space-y-10">
      <div>
        <Link href="/voorspellingen" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink transition">
          ← Alle deelnemers
        </Link>
      </div>

      <div className="bg-surface border border-border rounded-lg p-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-0.5">{profile.display_name}</h1>
          <p className="text-sm text-muted">
            {profile.department ?? "Geen team"} · ingevuld poulebriefje (alleen-lezen)
          </p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-3xl font-bold tabular-nums text-pitch">+{grandTotal}</div>
          <div className="text-xs text-muted">totaal pt</div>
        </div>
      </div>

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
                  <li key={m.id} className="px-3 sm:px-4 py-2.5 sm:grid sm:grid-cols-[1fr_5rem_8rem_3rem] sm:gap-2 sm:items-center">
                    <div>
                      <div className="flex items-center gap-1.5 font-medium text-xs flex-wrap">
                        <span>{flagEmoji(m.home_team ?? "")}</span>
                        <span className="text-muted">{teamName.get(m.home_team ?? "") ?? m.home_team}</span>
                        <span className="text-muted mx-0.5">vs</span>
                        <span className="text-muted">{teamName.get(m.away_team ?? "") ?? m.away_team}</span>
                        <span>{flagEmoji(m.away_team ?? "")}</span>
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

      {/* ── Knock-out: tab 1+2 keuzes (info) ── */}
      <section className="space-y-3">
        <h2 className="text-xl font-bold">Knock-out — poule-keuzes</h2>
        <div className="bg-surface border border-border rounded-lg p-4 space-y-3">
          <div>
            <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Top 2 per poule</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 text-sm">
              {Array.from(Object.entries(phaseA)).sort(([a], [b]) => a.localeCompare(b)).map(([g, ranks]) => (
                <div key={g} className="border border-border rounded p-2 bg-bg/30">
                  <p className="text-[10px] font-bold text-muted mb-1">Poule {g}</p>
                  <ul className="space-y-1">
                    {(["rank1", "rank2"] as const).map((rk, i) => {
                      const code = ranks[rk];
                      if (!code) return null;
                      return (
                        <li key={rk} className="flex items-center gap-1.5">
                          <span className={`text-[9px] font-bold px-1 rounded ${RANK_BADGE[(i + 1) as 1 | 2]}`}>{i + 1}e</span>
                          <span aria-hidden>{flagEmoji(code)}</span>
                          <span className="text-xs">{teamName.get(code) ?? code}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </div>
          <div className="pt-3 border-t border-border">
            <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">8 beste nummers 3 (doorgaande)</p>
            <div className="flex flex-wrap gap-1.5">
              {Array.from(phaseBSet).sort().map((code) => (
                <span key={code} className="inline-flex items-center gap-1 bg-amber-500 text-white text-xs font-medium px-2 py-0.5 rounded">
                  <span aria-hidden>{flagEmoji(code)}</span>
                  <span>{teamName.get(code) ?? code}</span>
                </span>
              ))}
              {phaseBSet.size === 0 && <span className="text-xs text-muted italic">niet ingevuld</span>}
            </div>
          </div>
        </div>
      </section>

      {/* ── Knock-out: bracket per wedstrijd ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Knock-out — bracket</h2>
          <span className="text-sm font-semibold text-pitch tabular-nums">+{koTotalPts} pt</span>
        </div>

        {stageOrder.map((stage) => {
          const data = koByStage.get(stage);
          if (!data || data.matches.length === 0) return null;
          const full = KO_POINTS_FULL[stage];
          const half = KO_POINTS_HALF[stage];
          return (
            <div key={stage} className="bg-surface border border-border rounded-lg overflow-hidden">
              <div className="px-5 py-3 border-b border-border bg-bg/50 flex items-center justify-between gap-3">
                <div>
                  <span className="text-sm font-bold">{ROUND_LABEL[stage]}</span>
                  <p className="text-[11px] text-muted">
                    {full} pt juiste plek
                    {half > 0 && `, ${half} pt juiste land verkeerde plek`}
                  </p>
                </div>
                <span className="text-sm font-bold text-pitch tabular-nums shrink-0">+{data.subtotal}</span>
              </div>
              <ul className="divide-y divide-border">
                {data.matches.map(({ match: m, myPick, actualWinner, pts }) => {
                  const finished = m.status === "FINISHED" && m.home_score != null && m.away_score != null;
                  return (
                    <li key={m.id} className="px-3 sm:px-4 py-2.5 sm:flex sm:items-center sm:gap-3">
                      <div className="w-32 shrink-0">
                        <div className="text-[10px] font-mono text-muted">W{m.id}</div>
                        <div className="text-[10px] text-muted">{fmt(m.kickoff_at)}</div>
                      </div>
                      <div className="flex-1 mt-1 sm:mt-0">
                        <div className="text-xs">
                          {m.home_team && m.away_team ? (
                            <span className="text-muted">
                              {flagEmoji(m.home_team)} {teamName.get(m.home_team) ?? m.home_team}
                              {" "}vs{" "}
                              {flagEmoji(m.away_team)} {teamName.get(m.away_team) ?? m.away_team}
                            </span>
                          ) : (
                            <span className="text-muted italic">teams nog niet bekend</span>
                          )}
                        </div>
                        <div className="text-xs mt-0.5 flex items-center gap-2 flex-wrap">
                          <span className="text-muted">jouw winnaar:</span>
                          {myPick ? (
                            <span className="inline-flex items-center gap-1 font-semibold">
                              <span aria-hidden>{flagEmoji(myPick)}</span>
                              <span>{teamName.get(myPick) ?? myPick}</span>
                            </span>
                          ) : <span className="text-muted italic">—</span>}
                          {finished && (
                            <>
                              <span className="text-muted ml-2">·</span>
                              <span className="text-muted">echt:</span>
                              {actualWinner ? (
                                <span className="inline-flex items-center gap-1 font-semibold">
                                  <span aria-hidden>{flagEmoji(actualWinner)}</span>
                                  <span>{teamName.get(actualWinner) ?? actualWinner}</span>
                                </span>
                              ) : (
                                <span className="text-muted text-[10px] italic">(gelijkspel / TBD)</span>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                      <div className="sm:w-16 sm:text-right mt-1 sm:mt-0">
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
    </div>
  );
}
