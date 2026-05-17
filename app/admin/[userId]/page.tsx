import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { isAdmin } from "@/lib/admin";
import Link from "next/link";
import { flagEmoji } from "@/lib/flags";
import { scoreGroupPrediction, deriveSurvivors, KO_POINTS } from "@/lib/scoring";
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

export default async function AdminParticipantPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!isAdmin(user.email)) redirect("/ranglijst");

  const [
    { data: profile },
    { data: matchesRaw },
    { data: predictionsRaw },
    { data: bracketPicksRaw },
    { data: bonusRow },
    { data: teamsRaw },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, department")
      .eq("id", userId)
      .single(),
    supabase
      .from("matches")
      .select(
        "id, stage, status, group_name, kickoff_at, home_team, away_team, home_score, away_score"
      )
      .order("kickoff_at", { ascending: true }),
    supabase
      .from("predictions")
      .select("match_id, home_score, away_score, toto_pick")
      .eq("user_id", userId),
    supabase
      .from("bracket_picks")
      .select("round, team_code")
      .eq("user_id", userId),
    supabase
      .from("bonus_picks")
      .select("top_scorer, total_goals_tiebreak, total_yellow_cards_tiebreak")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase.from("teams").select("code, name"),
  ]);

  if (!profile) notFound();

  const teamName = new Map((teamsRaw ?? []).map((t) => [t.code, t.name]));
  const predByMatch = new Map(
    (predictionsRaw ?? []).map((p) => [p.match_id, p])
  );

  // ── Group stage
  const groupMatches = (matchesRaw ?? []).filter(
    (m) => m.stage === "GROUP_STAGE"
  );

  // Map team code → group letter (e.g. "MEX" → "A")
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
  const sortedGroups = Array.from(grouped.entries()).sort(([a], [b]) =>
    a.localeCompare(b)
  );

  const groupTotalPts = groupMatches.reduce((sum, m) => {
    if (m.status !== "FINISHED" || m.home_score == null || m.away_score == null)
      return sum;
    const pred = predByMatch.get(m.id);
    if (!pred) return sum;
    return (
      sum +
      scoreGroupPrediction(pred, {
        id: m.id,
        home_score: m.home_score,
        away_score: m.away_score,
      })
    );
  }, 0);

  // ── Knock-out
  const koMatches = (matchesRaw ?? []).filter((m) =>
    ["LAST_32", "LAST_16", "QUARTER_FINALS", "SEMI_FINALS", "FINAL"].includes(
      m.stage
    )
  );
  const winnerByMatchId = new Map<number, string>();
  for (const m of koMatches) {
    if (
      m.status !== "FINISHED" ||
      m.home_score == null ||
      m.away_score == null ||
      m.home_score === m.away_score
    )
      continue;
    const w = m.home_score > m.away_score ? m.home_team : m.away_team;
    if (w) winnerByMatchId.set(m.id, w);
  }
  const survivors = deriveSurvivors(koMatches, winnerByMatchId);

  const picksByRound = new Map<string, Set<string>>();
  for (const p of bracketPicksRaw ?? []) {
    if (!picksByRound.has(p.round)) picksByRound.set(p.round, new Set());
    picksByRound.get(p.round)!.add(p.team_code);
  }

  const koTotalPts = ROUNDS.reduce((sum, r) => {
    const picks = picksByRound.get(r.key) ?? new Set<string>();
    const survs = survivors[r.key];
    if (!survs?.size) return sum;
    return (
      sum +
      Array.from(picks).filter((c) => survs.has(c)).length * r.points
    );
  }, 0);

  const grandTotal = groupTotalPts + koTotalPts;

  const fmt = (kickoff: string) =>
    new Intl.DateTimeFormat("nl-NL", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(kickoff));

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-8 space-y-8 sm:space-y-10">

      {/* Breadcrumb */}
      <div>
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink transition"
        >
          ← Deelnemers
        </Link>
      </div>

        {/* Header card */}
        <div className="bg-surface border border-border rounded-lg p-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-0.5">{profile.display_name}</h1>
            <p className="text-sm text-muted">
              {profile.department ?? "Geen team"} · ingevuld formulier (alleen-lezen)
            </p>
          </div>
          <div className="text-right shrink-0">
            <div className="text-3xl font-bold tabular-nums text-pitch">
              +{grandTotal}
            </div>
            <div className="text-xs text-muted">totaal pt</div>
          </div>
        </div>

        {/* ── Groepsfase ── */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Groepsfase</h2>
            <span className="text-sm font-semibold text-pitch tabular-nums">
              +{groupTotalPts} pt
            </span>
          </div>

          {sortedGroups.map(([group, ms]) => (
            <div
              key={group}
              className="bg-surface border border-border rounded-lg overflow-hidden"
            >
              <div className="px-4 sm:px-5 py-3 border-b border-border bg-bg/50 text-sm font-bold">
                Groep {group.replace("GROUP_", "")}
              </div>
              {/* Desktop header */}
              <div className="hidden sm:grid grid-cols-[1fr_5rem_8rem_3rem] gap-2 px-4 py-2 border-b border-border text-xs text-muted uppercase tracking-wide bg-bg/30">
                <div>Wedstrijd</div>
                <div className="text-center">Uitslag</div>
                <div className="text-center">Voorspelling</div>
                <div className="text-right">Pt</div>
              </div>
              <ul className="divide-y divide-border">
                {ms.map((m) => {
                  const pred = predByMatch.get(m.id);
                  const finished =
                    m.status === "FINISHED" &&
                    m.home_score != null &&
                    m.away_score != null;
                  const pts =
                    finished && pred
                      ? scoreGroupPrediction(pred, {
                          id: m.id,
                          home_score: m.home_score!,
                          away_score: m.away_score!,
                        })
                      : null;
                  const hasScore = pred && pred.home_score != null && pred.away_score != null;
                  const toto = pred ? (pred.toto_pick ??
                    (hasScore
                      ? pred.home_score! > pred.away_score! ? "1"
                        : pred.home_score! < pred.away_score! ? "2"
                        : "X"
                      : null)) : null;
                  return (
                    <li
                      key={m.id}
                      className="px-3 sm:px-4 py-2.5 sm:grid sm:grid-cols-[1fr_5rem_8rem_3rem] sm:gap-2 sm:items-center"
                    >
                      <div>
                        <div className="flex items-center gap-1.5 font-medium text-xs flex-wrap">
                          <span>{flagEmoji(m.home_team ?? "")}</span>
                          <span className="text-muted">
                            {teamName.get(m.home_team ?? "") ?? m.home_team}
                          </span>
                          <span className="text-muted mx-0.5">vs</span>
                          <span className="text-muted">
                            {teamName.get(m.away_team ?? "") ?? m.away_team}
                          </span>
                          <span>{flagEmoji(m.away_team ?? "")}</span>
                        </div>
                        <div className="text-[10px] text-muted mt-0.5">
                          {fmt(m.kickoff_at)}
                        </div>
                      </div>
                      {/* Mobile: één regel met labels; Desktop: aparte kolommen */}
                      <div className="flex items-center justify-between gap-3 mt-2 sm:mt-0 sm:contents">
                        <div className="sm:text-center tabular-nums font-bold text-sm">
                          <span className="sm:hidden text-[10px] text-muted font-normal mr-1">Uitslag:</span>
                          {finished ? (
                            <span>{m.home_score}–{m.away_score}</span>
                          ) : (
                            <span className="text-muted font-normal">—</span>
                          )}
                        </div>
                        <div className="sm:text-center tabular-nums text-sm">
                          <span className="sm:hidden text-[10px] text-muted font-normal mr-1">Voorsp:</span>
                          {pred ? (
                            <span className="inline-flex items-center gap-1.5">
                              {hasScore && (
                                <span className="font-semibold">{pred.home_score}–{pred.away_score}</span>
                              )}
                              {toto && (
                                <span className="inline-block bg-brand text-white rounded px-1.5 py-0.5 text-xs font-bold">{toto}</span>
                              )}
                            </span>
                          ) : (
                            <span className="text-muted italic text-xs">—</span>
                          )}
                        </div>
                        <div className="sm:text-right">
                          {pts == null ? (
                            <span className="text-muted text-xs">—</span>
                          ) : (
                            <PtsChip pts={pts} />
                          )}
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
            <span className="text-sm font-semibold text-pitch tabular-nums">
              +{koTotalPts} pt
            </span>
          </div>

          {ROUNDS.map((round) => {
            const picks = picksByRound.get(round.key) ?? new Set<string>();
            const survs = survivors[round.key];
            const hasData = !!(survs?.size);
            const pts = hasData
              ? Array.from(picks).filter((c) => survs.has(c)).length *
                round.points
              : null;
            return (
              <div
                key={round.key}
                className="bg-surface border border-border rounded-lg overflow-hidden"
              >
                <div className="px-5 py-3 border-b border-border bg-bg/50 flex items-center justify-between">
                  <span className="text-sm font-bold">{round.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-pitch-soft text-pitch px-1.5 py-0.5 rounded font-semibold">
                      {round.points} pt/team
                    </span>
                    {pts != null && (
                      <span className="text-sm font-bold text-pitch tabular-nums">
                        +{pts}
                      </span>
                    )}
                  </div>
                </div>
                {picks.size === 0 ? (
                  <p className="px-5 py-3 text-sm text-muted italic">
                    Niet ingevuld
                  </p>
                ) : (
                  <div className="p-3 flex flex-wrap gap-1.5">
                    {Array.from(picks)
                      .sort()
                      .map((code) => {
                        const correct = hasData && survs.has(code);
                        const wrong = hasData && !survs.has(code);
                        return (
                          <span
                            key={code}
                            className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded border font-medium ${
                              correct
                                ? "bg-pitch-soft border-pitch/30 text-pitch"
                                : wrong
                                ? "bg-brand-soft border-brand/30 text-brand line-through"
                                : "bg-surface border-border text-ink"
                            }`}
                          >
                            {flagEmoji(code)}{" "}
                            {teamName.get(code) ?? code}
                            {round.key === "LAST_32" && teamGroup.get(code) && (
                              <span className="ml-0.5 text-[9px] font-bold opacity-50">
                                {teamGroup.get(code)}
                              </span>
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
          <h2 className="text-xl font-bold">Bonus</h2>
          <div className="bg-surface border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted uppercase tracking-wide bg-bg/30">
                  <th className="px-4 py-2 text-left">Vraag</th>
                  <th className="px-4 py-2 text-left">Antwoord</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border">
                  <td className="px-4 py-3 text-muted">Topscorer</td>
                  <td className="px-4 py-3 font-medium">
                    {bonusRow?.top_scorer || (
                      <span className="text-muted italic text-xs">
                        niet ingevuld
                      </span>
                    )}
                  </td>
                </tr>
                <tr className="border-b border-border">
                  <td className="px-4 py-3 text-muted">Gele kaarten</td>
                  <td className="px-4 py-3 tabular-nums font-medium">
                    {bonusRow?.total_yellow_cards_tiebreak ?? (
                      <span className="text-muted italic text-xs">
                        niet ingevuld
                      </span>
                    )}
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-muted">
                    Doelpunten{" "}
                    <span className="text-[10px] text-amber-600">(beslisser)</span>
                  </td>
                  <td className="px-4 py-3 tabular-nums font-medium">
                    {bonusRow?.total_goals_tiebreak ?? (
                      <span className="text-muted italic text-xs">
                        niet ingevuld
                      </span>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

    </div>
  );
}
