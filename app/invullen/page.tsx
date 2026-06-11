import { createSupabaseServerClient } from "@/lib/supabase/server";
import GroupStageForm, { type Match, type Prediction } from "./GroupStageForm";
import ActiveMatchWidget from "@/app/components/ActiveMatchWidget";
import { flagEmoji } from "@/lib/flags";

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

  const fmt = (kickoff: string) =>
    new Intl.DateTimeFormat("nl-NL", {
      weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
    }).format(new Date(kickoff));

  return (
    <div className="space-y-6">
      {/* ── Collega-voorspellingen actieve wedstrijd ── */}
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
                <span>{teams.get(activeMatch.home_team ?? "") ?? activeMatch.home_team ?? "?"}</span>
                <span className="text-muted font-normal">vs</span>
                <span>{teams.get(activeMatch.away_team ?? "") ?? activeMatch.away_team ?? "?"}</span>
                {activeMatch.away_team && (
                  <span className="flag-emoji" aria-hidden>{flagEmoji(activeMatch.away_team)}</span>
                )}
              </div>
              <div className="text-xs text-muted mt-0.5">{fmt(activeMatch.kickoff_at)}</div>
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
