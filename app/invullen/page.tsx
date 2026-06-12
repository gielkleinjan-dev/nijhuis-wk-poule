import { createSupabaseServerClient } from "@/lib/supabase/server";
import GroupStageForm, { type Match, type Prediction } from "./GroupStageForm";
import ActiveMatchWidget from "@/app/components/ActiveMatchWidget";

export default async function InvullenPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null; // layout handles redirect

  const [{ data: matchesRaw }, { data: teamsRaw }, { data: predictionsRaw }, { data: settings }, { data: pointRows }] =
    await Promise.all([
      supabase
        .from("matches")
        .select("id, stage, group_name, home_team, away_team, kickoff_at, home_score, away_score, status")
        .eq("stage", "GROUP_STAGE")
        .order("kickoff_at", { ascending: true }),
      supabase.from("teams").select("code, name"),
      supabase
        .from("predictions")
        .select("match_id, home_score, away_score, toto_pick")
        .eq("user_id", user.id),
      supabase.from("settings").select("lock_at").eq("id", 1).single(),
      supabase.from("points").select("points").eq("user_id", user.id).eq("source", "group"),
    ]);

  const totalPoints = (pointRows ?? []).reduce((s, r) => s + (r.points ?? 0), 0);

  const teams = new Map<string, string>(
    (teamsRaw || []).map((t) => [t.code, t.name])
  );
  const matches: Match[] = (matchesRaw || []).map((m) => ({
    id: m.id,
    group: m.group_name!,
    kickoff: m.kickoff_at,
    home: { code: m.home_team!, name: teams.get(m.home_team!) || m.home_team! },
    away: { code: m.away_team!, name: teams.get(m.away_team!) || m.away_team! },
    actual: m.status === "FINISHED" && m.home_score != null && m.away_score != null
      ? { home: m.home_score, away: m.away_score }
      : undefined,
  }));
  const predictions: Record<number, Prediction> = {};
  for (const p of predictionsRaw || []) {
    predictions[p.match_id] = { home: p.home_score, away: p.away_score, toto: p.toto_pick };
  }

  const lockAt = settings?.lock_at ?? "2026-06-10T15:00:00Z";
  const isLocked = new Date(lockAt) <= new Date();

  // ── Wedstrijden bovenin: alle duels van VANDAAG (NL-tijd) — ook al gespeeld.
  // Geen wedstrijd vandaag? Val terug op de eerstvolgende (live/komende) wedstrijd.
  const allMatches = matchesRaw ?? [];
  const nlDayKey = (d: Date) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Amsterdam",
      year: "numeric", month: "2-digit", day: "2-digit",
    }).format(d);
  const todayKey = nlDayKey(new Date());
  // Sorteer: live eerst, dan komende, dan al gespeelde — elk op tijdstip.
  const matchRank = (m: { status: string }) =>
    m.status === "LIVE" ? 0 : m.status !== "FINISHED" ? 1 : 2;
  const byRankThenTime = (a: typeof allMatches[number], b: typeof allMatches[number]) =>
    matchRank(a) - matchRank(b) ||
    new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime();

  const todaysMatches = allMatches
    .filter((m) => nlDayKey(new Date(m.kickoff_at)) === todayKey)
    .sort(byRankThenTime);
  const nextUpcoming =
    allMatches.find((m) => m.status === "LIVE") ??
    allMatches
      .filter((m) => m.status !== "FINISHED")
      .sort((a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime())[0];
  const featuredMatches =
    todaysMatches.length > 0 ? todaysMatches : nextUpcoming ? [nextUpcoming] : [];

  // Haal collega-voorspellingen op voor alle uitgelichte wedstrijden (post-lock)
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

  const profileMap = new Map(
    (profilesRaw ?? [])
      .filter((p) => p.department !== "__LOADTEST__" && p.department !== "__SCORING_TEST__")
      .map((p) => [p.id, p])
  );
  // Voorspellingen per wedstrijd: match_id → (user_id → voorspelling)
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

  return (
    <div className="space-y-6">
      {/* ── Collega-voorspellingen: alle wedstrijden van vandaag ── */}
      {isLocked && featuredWidgets.length > 0 && (
        <div className="space-y-3">
          {featuredWidgets.map(({ m, rows }) => (
            <div key={m.id} className="bg-surface border border-border rounded-lg px-4 py-3">
              <ActiveMatchWidget
                rows={rows}
                actualHomeScore={m.home_score ?? null}
                actualAwayScore={m.away_score ?? null}
                homeName={teams.get(m.home_team ?? "") ?? m.home_team ?? "?"}
                homeCode={m.home_team ?? ""}
                awayName={teams.get(m.away_team ?? "") ?? m.away_team ?? "?"}
                awayCode={m.away_team ?? ""}
                kickoffAt={m.kickoff_at}
                isLive={m.status === "LIVE"}
              />
            </div>
          ))}
        </div>
      )}

      <GroupStageForm
        userId={user.id}
        matches={matches}
        initial={predictions}
        isLocked={isLocked}
        totalPoints={totalPoints}
      />
    </div>
  );
}
