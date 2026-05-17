import { createSupabaseServerClient } from "@/lib/supabase/server";
import KnockoutForm from "./KnockoutForm";
import { ROUNDS, type Team, type Picks } from "./rounds";
import { deriveSurvivors } from "@/lib/scoring";

export default async function KnockoutPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: teamsRaw }, { data: picksRaw }, { data: settings }, { data: groupMatches }, { data: koMatchesRaw }, { data: pointRows }] =
    await Promise.all([
      supabase.from("teams").select("code, name").order("name"),
      supabase
        .from("bracket_picks")
        .select("round, team_code")
        .eq("user_id", user.id),
      supabase.from("settings").select("lock_at").eq("id", 1).single(),
      supabase
        .from("matches")
        .select("home_team, away_team, group_name")
        .eq("stage", "GROUP_STAGE")
        .not("group_name", "is", null),
      supabase
        .from("matches")
        .select("id, stage, status, home_team, away_team, home_score, away_score")
        .in("stage", ["LAST_32", "LAST_16", "QUARTER_FINALS", "SEMI_FINALS", "FINAL"]),
      supabase.from("points").select("points").eq("user_id", user.id).eq("source", "knockout"),
    ]);

  const totalPoints = (pointRows ?? []).reduce((s, r) => s + (r.points ?? 0), 0);

  // Build code → group_name map from group stage fixtures
  const teamGroup = new Map<string, string>();
  for (const m of groupMatches ?? []) {
    if (m.home_team && m.group_name) teamGroup.set(m.home_team, m.group_name);
    if (m.away_team && m.group_name) teamGroup.set(m.away_team, m.group_name);
  }

  const teams: Team[] = (teamsRaw || []).map((t) => ({
    code: t.code,
    name: t.name,
    group: teamGroup.get(t.code) ?? "UNKNOWN",
  }));

  const picks: Picks = {};
  for (const r of ROUNDS) picks[r.key] = new Set();
  for (const p of picksRaw || []) {
    if (picks[p.round]) picks[p.round].add(p.team_code);
  }

  const lockAt = settings?.lock_at ?? "2026-06-11T17:00:00Z";
  const isLocked = new Date(lockAt) <= new Date();

  const koMatchesForSurvivors = koMatchesRaw ?? [];
  const winnerByMatchId = new Map<number, string>();
  for (const m of koMatchesForSurvivors) {
    if (m.status !== "FINISHED" || m.home_score == null || m.away_score == null) continue;
    if (m.home_score === m.away_score) continue; // penalty data missing, skip
    const winner = m.home_score > m.away_score ? m.home_team : m.away_team;
    if (winner) winnerByMatchId.set(m.id, winner);
  }
  const survivors = deriveSurvivors(koMatchesForSurvivors, winnerByMatchId);

  return (
    <KnockoutForm
      userId={user.id}
      teams={teams}
      initial={picks}
      isLocked={isLocked}
      survivors={survivors}
      totalPoints={totalPoints}
    />
  );
}
