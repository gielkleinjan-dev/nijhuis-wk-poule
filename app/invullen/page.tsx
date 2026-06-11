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

  // ── Actieve wedstrijd: eerste LIVE, anders eerste SCHEDULED/TIMED op datum ─
  const allMatches = matchesRaw ?? [];
  const activeMatch =
    allMatches.find((m) => m.status === "LIVE") ??
    allMatches
      .filter((m) => m.status !== "FINISHED")
      .sort((a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime())[0] ??
    null;

  // Haal collega-voorspellingen op voor de actieve wedstrijd (alleen post-lock)
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

  const profileMap = new Map(
    (profilesRaw ?? [])
      .filter((p) => p.department !== "__LOADTEST__" && p.department !== "__SCORING_TEST__")
      .map((p) => [p.id, p])
  );
  const activePredMap = new Map((activePredsRaw ?? []).map((p) => [p.user_id, p]));
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

  return (
    <div className="space-y-6">
      {/* ── Collega-voorspellingen actieve wedstrijd ── */}
      {isLocked && activeMatch && colleagueRows.length > 0 && (
        <div className="bg-surface border border-border rounded-lg px-4 py-3">
          <ActiveMatchWidget
            rows={colleagueRows}
            actualHomeScore={activeMatch.home_score ?? null}
            actualAwayScore={activeMatch.away_score ?? null}
            homeName={teams.get(activeMatch.home_team ?? "") ?? activeMatch.home_team ?? "?"}
            homeCode={activeMatch.home_team ?? ""}
            awayName={teams.get(activeMatch.away_team ?? "") ?? activeMatch.away_team ?? "?"}
            awayCode={activeMatch.away_team ?? ""}
            kickoffAt={activeMatch.kickoff_at}
            isLive={activeMatch.status === "LIVE"}
          />
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
