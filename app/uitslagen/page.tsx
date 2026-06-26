import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { flagEmoji } from "@/lib/flags";
import { scoreGroupPrediction, deriveSurvivors, type BracketRound } from "@/lib/scoring";
import { PLACEMENT_HALF } from "@/lib/scoring-knockout";
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
  { key: "LAST_32",         label: "1/16e finale",     points: PLACEMENT_HALF.LAST_32 },
  { key: "LAST_16",         label: "1/8e finale",      points: PLACEMENT_HALF.LAST_16 },
  { key: "QUARTER_FINALS",  label: "Kwartfinale",      points: PLACEMENT_HALF.QUARTER_FINALS },
  { key: "SEMI_FINALS",     label: "Halve finale",     points: PLACEMENT_HALF.SEMI_FINALS },
  { key: "FINAL",           label: "Finale",           points: PLACEMENT_HALF.FINAL },
];
import MainNav from "@/app/components/MainNav";
import BrandLogo from "@/app/components/BrandLogo";
import LockCountdown from "@/app/components/LockCountdown";
import TodayButton from "@/app/components/TodayButton";
import ActiveMatchWidget from "@/app/components/ActiveMatchWidget";
import GroupSortToggle, { type GroupSort } from "@/app/components/GroupSortToggle";
import { isTodayNL } from "@/lib/today";

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

export default async function UitslagenPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Groepsfase-sortering: standaard op datum/tijd (fijner om terug te kijken),
  // optioneel op poule via ?sort=poule.
  const { sort: sortParam } = await searchParams;
  const sort: GroupSort = sortParam === "poule" ? "poule" : "datum";

  const [
    { data: settings },
    { data: matchesRaw },
    { data: predictionsRaw },
    { data: bracketPicksRaw },
    { data: bonusRow },
    { data: pointsRows },
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
    // Bron-van-waarheid voor de eigen totalen: de toegekende punten per bron.
    // Zo is het getoonde totaal per definitie gelijk aan de ranglijst.
    supabase.from("points").select("source, points").eq("user_id", user.id),
  ]);

  const sumSource = (src: string) =>
    (pointsRows ?? []).filter((r) => r.source === src).reduce((s, r) => s + (r.points ?? 0), 0);

  const lockAt = settings?.lock_at ?? "2026-06-10T15:00:00Z";
  const isLocked = new Date(lockAt) <= new Date();
  const userIsAdmin = isAdmin(user.email);

  // ── Wedstrijden bovenin: alle duels van VANDAAG (NL-tijd) — ook al gespeeld.
  // Geen wedstrijd vandaag? Val terug op de eerstvolgende (live/komende) wedstrijd.
  const allMatches = matchesRaw ?? [];
  const nlDayKey = (d: Date) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Amsterdam",
      year: "numeric", month: "2-digit", day: "2-digit",
    }).format(d);
  const todayKey = nlDayKey(new Date());
  // Chronologisch: vroegste aftrap eerst (ook al gespeelde wedstrijden staan
  // dan op hun eigen tijdstip, niet achteraan).
  const todaysMatches = allMatches
    .filter((m) => nlDayKey(new Date(m.kickoff_at)) === todayKey)
    .sort((a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime());
  const nextUpcoming =
    allMatches.find((m) => m.status === "LIVE") ??
    allMatches
      .filter((m) => m.status !== "FINISHED")
      .sort((a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime())[0];
  const featuredMatches =
    todaysMatches.length > 0 ? todaysMatches : nextUpcoming ? [nextUpcoming] : [];

  // Haal voorspellingen op voor alle uitgelichte wedstrijden (+ profielen),
  // maar alleen als de poule gesloten is (anders mag je andermans voorspelling
  // nog niet zien).
  const featuredIds = featuredMatches.map((m) => m.id);
  const [{ data: activePredsRaw }, { data: profilesRaw }] =
    isLocked && featuredIds.length > 0
      ? await Promise.all([
          supabase
            .from("predictions")
            .select("match_id, user_id, home_score, away_score, toto_pick")
            .in("match_id", featuredIds),
          supabase
            .from("profiles")
            .select("id, display_name, department, secondary_department"),
        ])
      : [{ data: null }, { data: null }];

  // Bouw rijen per wedstrijd: alleen deelnemers met een ingevulde voorspelling
  const profileMap = new Map(
    (profilesRaw ?? [])
      .filter(
        (p) =>
          p.department !== "__LOADTEST__" &&
          p.department !== "__SCORING_TEST__"
      )
      .map((p) => [p.id, p])
  );
  type ActivePred = { match_id: number; user_id: string; home_score: number | null; away_score: number | null; toto_pick: string | null };
  const predsByMatch = new Map<number, Map<string, ActivePred>>();
  for (const p of (activePredsRaw ?? []) as ActivePred[]) {
    if (!predsByMatch.has(p.match_id)) predsByMatch.set(p.match_id, new Map());
    predsByMatch.get(p.match_id)!.set(p.user_id, p);
  }
  const buildRows = (matchId: number) => {
    const pm = predsByMatch.get(matchId) ?? new Map();
    return Array.from(profileMap.values())
      .map((p) => {
        const pred = pm.get(p.id);
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
  };
  const featuredWidgets = featuredMatches
    .map((m) => ({ m, rows: buildRows(m.id) }))
    .filter((w) => w.rows.length > 0);

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
  // Chronologische volgorde voor de datum-sortering.
  const groupMatchesByDate = [...groupMatches].sort(
    (a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime()
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

  // Totalen uit de toegekende punten (gelijk aan de ranglijst). De per-ronde
  // KO-tabel hieronder blijft een "wie leeft nog"-overzicht; het exacte per-
  // vakje totaal staat op de bracket-detailpagina.
  const koTotalPts = sumSource("knockout");
  const bonusTotalPts = sumSource("bonus");

  const grandTotal = groupTotalPts + koTotalPts + bonusTotalPts;

  const fmt = (kickoff: string) =>
    new Intl.DateTimeFormat("nl-NL", {
      timeZone: "Europe/Amsterdam",
      weekday: "short", day: "numeric", month: "short",
      hour: "2-digit", minute: "2-digit",
    }).format(new Date(kickoff));

  // Gedeelde tabelkop voor beide sorteringen.
  const groupThead = (
    <thead>
      <tr className="border-b border-border text-xs text-muted uppercase tracking-wide bg-bg/30">
        <th className="px-4 py-2 text-left">Wedstrijd</th>
        <th className="px-4 py-2 text-center">Uitslag</th>
        <th className="px-4 py-2 text-center">Toto</th>
        <th className="px-4 py-2 text-center">Jouw voorspelling</th>
        <th className="px-4 py-2 text-right">Punten</th>
      </tr>
    </thead>
  );

  // Eén wedstrijdrij. `showGroup` toont subtiel de poule-letter (handig in de
  // datum-sortering waar de groep-context anders wegvalt).
  const renderGroupRow = (m: (typeof groupMatches)[number], showGroup: boolean) => {
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
      <tr key={m.id} data-kickoff={m.kickoff_at} data-today={isTodayNL(m.kickoff_at) ? "true" : "false"} className="border-b border-border last:border-0">
        <td className="px-4 py-3">
          <div className="flex items-center gap-1.5 font-medium">
            {showGroup && (
              <span
                className="inline-flex items-center justify-center w-5 h-5 rounded bg-bg border border-border text-[10px] font-bold text-muted shrink-0"
                title={`Poule ${(m.group_name ?? "?").replace("GROUP_", "")}`}
              >
                {(m.group_name ?? "?").replace("GROUP_", "")}
              </span>
            )}
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
  };

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
                  timeZone: "Europe/Amsterdam",
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

        {/* ── Wedstrijden van vandaag — collega-voorspellingen ── */}
        {isLocked && featuredWidgets.length > 0 && (
          <div className="space-y-3">
            {featuredWidgets.map(({ m, rows }) => (
              <div key={m.id} className="bg-surface border border-border rounded-lg px-4 py-3">
                <ActiveMatchWidget
                  rows={rows}
                  actualHomeScore={m.status === "FINISHED" ? (m.home_score ?? null) : null}
                  actualAwayScore={m.status === "FINISHED" ? (m.away_score ?? null) : null}
                  homeName={teamName.get(m.home_team ?? "") ?? m.home_team ?? "?"}
                  homeCode={m.home_team ?? ""}
                  awayName={teamName.get(m.away_team ?? "") ?? m.away_team ?? "?"}
                  awayCode={m.away_team ?? ""}
                  kickoffAt={m.kickoff_at}
                  isLive={m.status === "LIVE"}
                />
              </div>
            ))}
          </div>
        )}

        {/* ── Groepsfase ── */}
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-xl font-bold">Groepsfase</h2>
            <div className="flex items-center gap-3">
              <GroupSortToggle basePath="/uitslagen" current={sort} />
              <span className="text-sm font-semibold text-pitch tabular-nums">+{groupTotalPts} pt</span>
            </div>
          </div>

          {sort === "datum" ? (
            <div className="bg-surface border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                {groupThead}
                <tbody>{groupMatchesByDate.map((m) => renderGroupRow(m, true))}</tbody>
              </table>
            </div>
          ) : (
            sortedGroups.map(([group, ms]) => (
              <div key={group} className="bg-surface border border-border rounded-lg overflow-hidden">
                <div className="px-5 py-3 border-b border-border bg-bg/50 text-sm font-bold">
                  Groep {group.replace("GROUP_", "")}
                </div>
                <table className="w-full text-sm">
                  {groupThead}
                  <tbody>{ms.map((m) => renderGroupRow(m, false))}</tbody>
                </table>
              </div>
            ))
          )}
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
