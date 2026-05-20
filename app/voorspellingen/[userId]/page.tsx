import { createSupabaseServerClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { flagEmoji } from "@/lib/flags";
import {
  scoreGroupPrediction,
  deriveSurvivors,
  expandBracketPicksForScoring,
  KO_POINTS,
  type NLProgress,
} from "@/lib/scoring";
import { ROUNDS } from "@/app/invullen/knockout/rounds";

function PtsChip({ pts }: { pts: number }) {
  const color =
    pts === 0
      ? "text-brand"
      : pts <= 2
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

const NL_PROGRESS_ORDER: NLProgress[] = [
  "GROUP_STAGE", "LAST_32", "LAST_16", "QUARTER_FINALS", "SEMI_FINALS", "FINAL_LOSER", "CHAMPION",
];

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
  const predByMatch = new Map(
    (predictionsRaw ?? []).map((p) => [p.match_id, p])
  );

  // ── Bonus uitslagen + werkelijke totalen ──────────────────────────────────
  const actualTopScorer = bonusSettings?.actual_top_scorer ?? null;
  const actualYellowCards = bonusSettings?.actual_yellow_cards ?? null;
  const actualNLTopScorer = bonusSettings?.actual_nl_top_scorer ?? null;
  const actualNLTotalGoals = bonusSettings?.actual_nl_total_goals ?? null;
  const actualNLProgress = (bonusSettings?.actual_nl_progress as NLProgress | null) ?? null;
  const actualTotalGoals = (matchesRaw ?? [])
    .filter((m) => m.status === "FINISHED" && m.home_score != null && m.away_score != null)
    .reduce((s, m) => s + (m.home_score ?? 0) + (m.away_score ?? 0), 0);

  // ── Bonus-punten (10/5 conventie, plus 3 NL-vragen) ───────────────────────
  const bonusTopScorerPts = actualTopScorer && bonusRow?.top_scorer && normalize(bonusRow.top_scorer) === normalize(actualTopScorer) ? 10 : 0;
  const bonusYellowPts = scoreNumber(bonusRow?.total_yellow_cards_tiebreak, actualYellowCards, 10, 5);
  const bonusGoalsPts = scoreNumber(bonusRow?.total_goals_tiebreak, actualTotalGoals, 10, 5);
  const bonusNLTopScorerPts = actualNLTopScorer && bonusRow?.nl_top_scorer && normalize(bonusRow.nl_top_scorer) === normalize(actualNLTopScorer) ? 10 : 0;
  const bonusNLGoalsPts = scoreNumber(bonusRow?.nl_total_goals, actualNLTotalGoals, 10, 5);

  let bonusNLProgressPts = 0;
  if (bonusRow?.nl_progress && actualNLProgress) {
    const pi = NL_PROGRESS_ORDER.indexOf(bonusRow.nl_progress as NLProgress);
    const ri = NL_PROGRESS_ORDER.indexOf(actualNLProgress);
    if (pi >= 0 && ri >= 0) {
      const diff = Math.abs(pi - ri);
      bonusNLProgressPts = diff === 0 ? 10 : diff === 1 ? 5 : 0;
    }
  }

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

  // ── Knock-out ─────────────────────────────────────────────────────────────
  const koMatches = (matchesRaw ?? []).filter((m) =>
    ["LAST_32", "LAST_16", "QUARTER_FINALS", "SEMI_FINALS", "FINAL"].includes(m.stage),
  );
  const winnerByMatchId = new Map<number, string>();
  for (const m of koMatches) {
    if (
      m.status !== "FINISHED" ||
      m.home_score == null ||
      m.away_score == null ||
      m.home_score === m.away_score
    ) continue;
    const w = m.home_score > m.away_score ? m.home_team : m.away_team;
    if (w) winnerByMatchId.set(m.id, w);
  }
  const survivors = deriveSurvivors(koMatches, winnerByMatchId);

  // V2-bracket-picks → expand naar LAST_32 + rest (R16/QF/SF/F)
  const { last32Teams, otherPicks } = expandBracketPicksForScoring(bracketPicksRaw ?? []);
  const picksByRound = new Map<string, Set<string>>();
  picksByRound.set("LAST_32", last32Teams);
  for (const p of otherPicks) {
    if (!picksByRound.has(p.round)) picksByRound.set(p.round, new Set());
    picksByRound.get(p.round)!.add(p.team_code);
  }

  const koTotalPts = ROUNDS.reduce((sum, r) => {
    const picks = picksByRound.get(r.key) ?? new Set<string>();
    const survs = survivors[r.key];
    if (!survs?.size) return sum;
    return sum + Array.from(picks).filter((c) => survs.has(c)).length * r.points;
  }, 0);

  const grandTotal = groupTotalPts + koTotalPts + bonusTotalPts;

  const fmt = (kickoff: string) =>
    new Intl.DateTimeFormat("nl-NL", {
      weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
    }).format(new Date(kickoff));

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-8 space-y-8 sm:space-y-10">
      <div>
        <Link href="/voorspellingen" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink transition">
          ← Alle deelnemers
        </Link>
      </div>

      {/* Header card */}
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

      {/* ── Knock-out ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Knock-out</h2>
          <span className="text-sm font-semibold text-pitch tabular-nums">+{koTotalPts} pt</span>
        </div>

        {ROUNDS.map((round) => {
          const picks = picksByRound.get(round.key) ?? new Set<string>();
          const survs = survivors[round.key];
          const hasData = !!(survs?.size);
          const pts = hasData ? Array.from(picks).filter((c) => survs.has(c)).length * round.points : null;
          return (
            <div key={round.key} className="bg-surface border border-border rounded-lg overflow-hidden">
              <div className="px-5 py-3 border-b border-border bg-bg/50 flex items-center justify-between">
                <span className="text-sm font-bold">{round.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-pitch-soft text-pitch px-1.5 py-0.5 rounded font-semibold">{round.points} pt/team</span>
                  {pts != null && <span className="text-sm font-bold text-pitch tabular-nums">+{pts}</span>}
                </div>
              </div>
              {picks.size === 0 ? (
                <p className="px-5 py-3 text-sm text-muted italic">Niet ingevuld</p>
              ) : (
                <div className="p-3 flex flex-wrap gap-1.5">
                  {Array.from(picks).sort().map((code) => {
                    const correct = hasData && survs.has(code);
                    const wrong = hasData && !survs.has(code);
                    return (
                      <span key={code} className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded border font-medium ${
                        correct ? "bg-pitch-soft border-pitch/30 text-pitch"
                        : wrong ? "bg-brand-soft border-brand/30 text-brand line-through"
                        : "bg-surface border-border text-ink"
                      }`}>
                        {flagEmoji(code)} {teamName.get(code) ?? code}
                        {round.key === "LAST_32" && teamGroup.get(code) && (
                          <span className="ml-0.5 text-[9px] font-bold opacity-50">{teamGroup.get(code)}</span>
                        )}
                      </span>
                    );
                  })}
                </div>
              )}
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
