import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { flagEmoji } from "@/lib/flags";
import { scoreGroupPrediction, deriveSurvivors, KO_POINTS_HALF, type BracketRound } from "@/lib/scoring";
import { isAdmin } from "@/lib/admin";

// V2-aligned KO-rondes voor de /uitslagen-weergave. We gebruiken bewust de
// HALF-punten (= "team overleefde de ronde, maar je hebt 'm misschien niet
// als wedstrijd-winnaar gepickt") als veilige ondergrens. De canonical
// leaderboard combineert HALF + FULL via de scoring-engine in lib/scoring.ts
// en de cron — daar zit het echte totaal. Deze pagina toont een
// conservatieve "wat heb je nu in je picks dat zeker doorgaat"-schatting.
//
// Vóór deze fix verwees de pagina naar app/invullen/knockout/rounds.ts dat
// nog V1-puntenwaarden (4/7/12/18/28/40) en V1-rondes (incl. losse CHAMPION)
// bevatte. Daardoor zou /uitslagen straks andere totalen tonen dan
// /ranglijst zodra wedstrijden gespeeld worden.
const KO_ROUNDS_V2: ReadonlyArray<{ key: BracketRound; label: string; points: number }> = [
  { key: "LAST_32",         label: "1/16e finale",     points: KO_POINTS_HALF.LAST_32 },
  { key: "LAST_16",         label: "1/8e finale",      points: KO_POINTS_HALF.LAST_16 },
  { key: "QUARTER_FINALS",  label: "Kwartfinale",      points: KO_POINTS_HALF.QUARTER_FINALS },
  { key: "SEMI_FINALS",     label: "Halve finale",     points: KO_POINTS_HALF.SEMI_FINALS },
  { key: "FINAL",           label: "Finale",           points: KO_POINTS_HALF.FINAL },
];
import MainNav from "@/app/components/MainNav";
import BrandLogo from "@/app/components/BrandLogo";
import LockCountdown from "@/app/components/LockCountdown";
import TodayButton from "@/app/components/TodayButton";
import ActiveMatchWidget from "@/app/components/ActiveMatchWidget";

function PtsChip({ pts, label }: { pts: number; label?: string }) {
  const color =
    pts === 0 ? "text-brand" : pts <= 2 ? "text-amber-600" : "text-pitch";
  return (
    <span className={`font-semibold tabular-nums ${color}`}>
      {pts === 0 ? "0" : `+${pts}`}
      {label && <span className="text-muted font-normal ml-1 text-[10px]">{label}</span>}
    </span>
  );
}

export default async function UitslagenPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [
    { data: settings },
    { data: matchesRaw },
    { data: predictionsRaw },
    { data: bracketPicksRaw },
    { data: bonusRow },
  ] = await Promise.all([
    supabase.from("settings").select("lock_at").eq("id", 1).single(),
    supabase
      .from("matches")
      .select("id, stage, status, group_name, kickoff_at, home_team, away_team, home_score, away_score")
      .order("kickoff_at", { ascending: true }),
    supabase
      .from("predictions")
      .select("match_id, home_score, away_score, toto_pick")
      .eq("user_id", user.id),
    supabase
      .from("bracket_picks")
      .select("round, team_code")
      .eq("user_id", user.id),
    supabase
      .from("bonus_picks")
      .select("top_scorer, total_goals_tiebreak, total_yellow_cards_tiebreak")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const lockAt = settings?.lock_at ?? "2026-06-10T15:00:00Z";
  const isLocked = new Date(lockAt) <= new Date();
  const userIsAdmin = isAdmin(user.email);

  // ── Actieve wedstrijd: eerste LIVE, anders eerste SCHEDULED op datum ───────
  const allMatches = matchesRaw ?? [];
  const activeMatch =
    allMatches.find((m) => m.status === "LIVE") ??
    allMatches
      .filter((m) => m.status !== "FINISHED")
      .sort(
        (a, b) =>
          new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime()
      )[0] ??
    null;

  // Haal alle voorspellingen voor de actieve wedstrijd op (+ profielen),
  // maar alleen als de poule gesloten is (anders mag je andermans voorspelling
  // nog niet zien).
  const [{ data: activePredsRaw }, { data: profilesRaw }] =
    isLocked && activeMatch
      ? await Promise.all([
          supabase
            .from("predictions")
            .select("user_id, home_score, away_score, toto_pick")
            .eq("match_id", activeMatch.id),
          supabase
            .from("profiles")
            .select("id, display_name, department, secondary_department"),
        ])
      : [{ data: null }, { data: null }];

  // Bouw rijen: alleen deelnemers met een ingevulde voorspelling voor dit duel
  const profileMap = new Map(
    (profilesRaw ?? [])
      .filter(
        (p) =>
          p.department !== "__LOADTEST__" &&
          p.department !== "__SCORING_TEST__"
      )
      .map((p) => [p.id, p])
  );
  const activePredMap = new Map(
    (activePredsRaw ?? []).map((p) => [p.user_id, p])
  );
  const colleagueRows = Array.from(profileMap.values())
    .map((p) => {
      const pred = activePredMap.get(p.id);
      return {
        userId: p.id,
        displayName: p.display_name ?? "Onbekend",
        department: p.department ?? null,
        secondaryDepartment: p.secondary_department ?? null,
        homePred: pred?.home_score ?? null,
        awayPred: pred?.away_score ?? null,
        totoPick: pred?.toto_pick ?? null,
      };
    })
    .filter((r) => r.homePred !== null || r.awayPred !== null);

  // ── Teams map for display
  const { data: teamsRaw } = await supabase.from("teams").select("code, name");
  const teamName = new Map((teamsRaw ?? []).map((t) => [t.code, t.name]));

  const predByMatch = new Map(
    (predictionsRaw ?? []).map((p) => [p.match_id, p])
  );

  // ── Group stage ──────────────────────────────────────────────────────────
  const groupMatches = (matchesRaw ?? []).filter((m) => m.stage === "GROUP_STAGE");
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
    if (m.status !== "FINISHED" || m.home_score == null || m.away_score == null) return sum;
    const pred = predByMatch.get(m.id);
    if (!pred) return sum;
    return sum + scoreGroupPrediction(pred, { id: m.id, home_score: m.home_score, away_score: m.away_score });
  }, 0);

  // ── Knock-out ─────────────────────────────────────────────────────────────
  const koMatches = (matchesRaw ?? []).filter((m) =>
    ["LAST_32", "LAST_16", "QUARTER_FINALS", "SEMI_FINALS", "FINAL"].includes(m.stage)
  );
  const winnerByMatchId = new Map<number, string>();
  for (const m of koMatches) {
    if (m.status !== "FINISHED" || m.home_score == null || m.away_score == null) continue;
    if (m.home_score === m.away_score) continue;
    const w = m.home_score > m.away_score ? m.home_team : m.away_team;
    if (w) winnerByMatchId.set(m.id, w);
  }
  const survivors = deriveSurvivors(koMatches, winnerByMatchId);

  const picksByRound = new Map<string, Set<string>>();
  for (const p of bracketPicksRaw ?? []) {
    if (!picksByRound.has(p.round)) picksByRound.set(p.round, new Set());
    picksByRound.get(p.round)!.add(p.team_code);
  }

  const koTotalPts = KO_ROUNDS_V2.reduce((sum, r) => {
    const picks = picksByRound.get(r.key) ?? new Set<string>();
    const survs = survivors[r.key];
    if (!survs?.size) return sum;
    return sum + Array.from(picks).filter((c) => survs.has(c)).length * r.points;
  }, 0);

  // ── Bonus ─────────────────────────────────────────────────────────────────
  // Actual bonus results would come from settings/admin; placeholder for now
  const bonusTotalPts = 0; // filled in by cron when tournament ends

  const grandTotal = groupTotalPts + koTotalPts + bonusTotalPts;

  const fmt = (kickoff: string) =>
    new Intl.DateTimeFormat("nl-NL", {
      weekday: "short", day: "numeric", month: "short",
      hour: "2-digit", minute: "2-digit",
    }).format(new Date(kickoff));

  return (
    <main className="min-h-screen">
      <LockCountdown lockAt={lockAt} />
      <header className="border-b border-border bg-surface">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-4 flex items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3">
            <BrandLogo />
          </div>
          <div className="text-right text-xs">
            <div className="font-medium">
              {user.user_metadata?.display_name || user.email}
            </div>
            {isLocked ? (
              <div className="text-brand font-semibold">Gesloten</div>
            ) : (
              <div className="text-muted">
                Sluit{" "}
                {new Intl.DateTimeFormat("nl-NL", {
                  day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                }).format(new Date(lockAt))}
              </div>
            )}
          </div>
        </div>
      </header>

      <MainNav isAdmin={userIsAdmin} isLocked={isLocked} lockAt={lockAt} />

      <div className="mx-auto max-w-5xl px-6 py-8 space-y-10">

        {/* ── Totaal ── */}
        <div className="tab-hero bg-surface border border-border rounded-lg p-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-0.5">Jouw uitslagen</h1>
            <p className="text-sm text-muted">Overzicht van voorspellingen, uitslagen en behaalde punten.</p>
          </div>
          <div className="text-right shrink-0">
            <div className="text-3xl font-bold tabular-nums text-pitch">+{grandTotal}</div>
            <div className="text-xs text-muted">totaal pt</div>
          </div>
        </div>

        {/* ── Actieve wedstrijd — collega-voorspellingen ── */}
        {isLocked && activeMatch && colleagueRows.length > 0 && (
          <div className="bg-surface border border-border rounded-lg p-5 space-y-3">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="flex items-center gap-1.5 font-semibold flex-wrap">
                  {activeMatch.status === "LIVE" && (
                    <span className="inline-flex items-center gap-1 text-xs bg-red-100 text-red-600 border border-red-200 rounded-full px-2 py-0.5 font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                      Live
                    </span>
                  )}
                  {activeMatch.home_team && (
                    <span className="flag-emoji" aria-hidden>{flagEmoji(activeMatch.home_team)}</span>
                  )}
                  <span>{teamName.get(activeMatch.home_team ?? "") ?? activeMatch.home_team ?? "?"}</span>
                  <span className="text-muted font-normal">vs</span>
                  <span>{teamName.get(activeMatch.away_team ?? "") ?? activeMatch.away_team ?? "?"}</span>
                  {activeMatch.away_team && (
                    <span className="flag-emoji" aria-hidden>{flagEmoji(activeMatch.away_team)}</span>
                  )}
                </div>
                <div className="text-xs text-muted mt-0.5 capitalize">
                  {fmt(activeMatch.kickoff_at)}
                </div>
              </div>
              {activeMatch.status === "FINISHED" &&
                activeMatch.home_score != null &&
                activeMatch.away_score != null && (
                  <div className="text-right shrink-0">
                    <div className="text-xl font-bold tabular-nums text-pitch">
                      {activeMatch.home_score}–{activeMatch.away_score}
                    </div>
                    <div className="text-[10px] text-muted">eindstand</div>
                  </div>
                )}
            </div>
            <ActiveMatchWidget
              rows={colleagueRows}
              actualHomeScore={activeMatch.home_score ?? null}
              actualAwayScore={activeMatch.away_score ?? null}
            />
          </div>
        )}

        {/* ── Groepsfase ── */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Groepsfase</h2>
            <span className="text-sm font-semibold text-pitch tabular-nums">+{groupTotalPts} pt</span>
          </div>

          {sortedGroups.map(([group, ms]) => (
            <div key={group} className="bg-surface border border-border rounded-lg overflow-hidden">
              <div className="px-5 py-3 border-b border-border bg-bg/50 text-sm font-bold">
                Groep {group.replace("GROUP_", "")}
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted uppercase tracking-wide bg-bg/30">
                    <th className="px-4 py-2 text-left">Wedstrijd</th>
                    <th className="px-4 py-2 text-center">Uitslag</th>
                    <th className="px-4 py-2 text-center">Toto</th>
                    <th className="px-4 py-2 text-center">Jouw voorspelling</th>
                    <th className="px-4 py-2 text-right">Punten</th>
                  </tr>
                </thead>
                <tbody>
                  {ms.map((m) => {
                    const pred = predByMatch.get(m.id);
                    const finished = m.status === "FINISHED" && m.home_score != null && m.away_score != null;
                    const pts = finished && pred
                      ? scoreGroupPrediction(pred, { id: m.id, home_score: m.home_score!, away_score: m.away_score! })
                      : null;
                    const actualToto = finished
                      ? m.home_score! > m.away_score! ? "1" : m.home_score! < m.away_score! ? "2" : "X"
                      : null;
                    const predToto = pred?.home_score != null && pred?.away_score != null
                      ? pred.home_score > pred.away_score ? "1" : pred.home_score < pred.away_score ? "2" : "X"
                      : pred?.toto_pick ?? null;
                    return (
                      <tr key={m.id} data-kickoff={m.kickoff_at} className="border-b border-border last:border-0">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 font-medium">
                            <span className="flag-emoji" aria-hidden>{flagEmoji(m.home_team ?? "")}</span>
                            <span className="text-xs text-muted">{teamName.get(m.home_team ?? "") ?? m.home_team}</span>
                            <span className="text-muted mx-0.5">vs</span>
                            <span className="text-xs text-muted">{teamName.get(m.away_team ?? "") ?? m.away_team}</span>
                            <span className="flag-emoji" aria-hidden>{flagEmoji(m.away_team ?? "")}</span>
                          </div>
                          <div className="text-xs text-muted mt-0.5">{fmt(m.kickoff_at)}</div>
                        </td>
                        <td className="px-4 py-3 text-center tabular-nums font-bold">
                          {finished ? (
                            <span>{m.home_score}–{m.away_score}</span>
                          ) : (
                            <span className="text-muted font-normal">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {actualToto ? (
                            <span className="inline-block bg-bg border border-border rounded px-1.5 py-0.5 text-xs font-bold tabular-nums">{actualToto}</span>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center tabular-nums">
                          {pred?.home_score != null && pred?.away_score != null ? (
                            <span className="font-semibold">
                              {pred.home_score}–{pred.away_score}
                              <span className="ml-1 text-[10px] text-muted font-normal">({predToto})</span>
                            </span>
                          ) : pred?.toto_pick ? (
                            <span className="inline-block bg-brand text-white rounded px-1.5 py-0.5 text-xs font-bold">{pred.toto_pick}</span>
                          ) : (
                            <span className="text-muted italic text-xs">niet ingevuld</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {pts == null ? (
                            <span className="text-muted">—</span>
                          ) : (
                            <PtsChip pts={pts} />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </section>

        {/* ── Knock-out ── */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Knock-out</h2>
            <span className="text-sm font-semibold text-pitch tabular-nums">+{koTotalPts} pt</span>
          </div>

          {KO_ROUNDS_V2.map((round) => {
            const picks = picksByRound.get(round.key) ?? new Set<string>();
            const survs = survivors[round.key];
            const hasData = !!(survs?.size);
            return (
              <div key={round.key} className="bg-surface border border-border rounded-lg overflow-hidden">
                <div className="px-5 py-3 border-b border-border bg-bg/50 flex items-center justify-between">
                  <span className="text-sm font-bold">{round.label}</span>
                  <span className="text-xs bg-pitch-soft text-pitch px-1.5 py-0.5 rounded font-semibold">{round.points} pt/team</span>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs text-muted uppercase tracking-wide bg-bg/30">
                      <th className="px-4 py-2 text-left">Land</th>
                      <th className="px-4 py-2 text-center">Jouw keuze</th>
                      <th className="px-4 py-2 text-center">Doorgegaan</th>
                      <th className="px-4 py-2 text-right">Punten</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!hasData && picks.size === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-4 text-center text-muted text-xs italic">
                          Nog geen picks of resultaten beschikbaar.
                        </td>
                      </tr>
                    ) : (
                      // Show all picked teams + any survivors not picked
                      Array.from(new Set([...Array.from(picks), ...(hasData ? Array.from(survs) : [])])).sort().map((code) => {
                        const picked = picks.has(code);
                        const survived = hasData && survs.has(code);
                        const pts = picked && survived ? round.points : null;
                        return (
                          <tr key={code} className="border-b border-border last:border-0">
                            <td className="px-4 py-2.5">
                              <span className="flex items-center gap-2">
                                <span className="flag-emoji" aria-hidden>{flagEmoji(code)}</span>
                                <span>{teamName.get(code) ?? code}</span>
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              {picked ? <span className="text-pitch font-bold">✓</span> : <span className="text-muted">—</span>}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              {!hasData ? (
                                <span className="text-muted">—</span>
                              ) : survived ? (
                                <span className="text-pitch font-bold">✓</span>
                              ) : (
                                <span className="text-brand font-bold">✗</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              {pts == null ? (
                                <span className="text-muted">—</span>
                              ) : (
                                <PtsChip pts={pts} />
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
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
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted uppercase tracking-wide bg-bg/30">
                  <th className="px-4 py-2 text-left">Vraag</th>
                  <th className="px-4 py-2 text-center">Jouw antwoord</th>
                  <th className="px-4 py-2 text-center">Juist antwoord</th>
                  <th className="px-4 py-2 text-right">Punten</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border">
                  <td className="px-4 py-3">Topscorer van het toernooi</td>
                  <td className="px-4 py-3 text-center">{bonusRow?.top_scorer || <span className="text-muted italic text-xs">niet ingevuld</span>}</td>
                  <td className="px-4 py-3 text-center text-muted">—</td>
                  <td className="px-4 py-3 text-right text-muted">—</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="px-4 py-3">Totaal gele kaarten</td>
                  <td className="px-4 py-3 text-center tabular-nums">{bonusRow?.total_yellow_cards_tiebreak ?? <span className="text-muted italic text-xs">niet ingevuld</span>}</td>
                  <td className="px-4 py-3 text-center text-muted">—</td>
                  <td className="px-4 py-3 text-right text-muted">—</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">Totaal doelpunten <span className="text-xs text-amber-600 ml-1">(beslisser)</span></td>
                  <td className="px-4 py-3 text-center tabular-nums">{bonusRow?.total_goals_tiebreak ?? <span className="text-muted italic text-xs">niet ingevuld</span>}</td>
                  <td className="px-4 py-3 text-center text-muted">—</td>
                  <td className="px-4 py-3 text-right text-muted">—</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

      </div>
      <TodayButton />
    </main>
  );
}
