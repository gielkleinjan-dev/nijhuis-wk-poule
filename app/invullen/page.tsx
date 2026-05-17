import { createSupabaseServerClient } from "@/lib/supabase/server";
import GroupStageForm, { type Match, type Prediction } from "./GroupStageForm";

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

  const lockAt = settings?.lock_at ?? "2026-06-11T17:00:00Z";
  const isLocked = new Date(lockAt) <= new Date();

  return (
    <GroupStageForm
      userId={user.id}
      matches={matches}
      initial={predictions}
      isLocked={isLocked}
      totalPoints={totalPoints}
    />
  );
}
