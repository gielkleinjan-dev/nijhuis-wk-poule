import { createSupabaseServerClient } from "@/lib/supabase/server";
import KnockoutFormV2 from "./v2/KnockoutFormV2";
import { type GroupCode, isGroupCode, type MatchId } from "@/lib/bracket/types";
import type { PhaseA, Bracket } from "@/lib/bracket/cascade";
import { ALL_MATCH_IDS } from "@/lib/bracket/bracket-graph";

export default async function KnockoutPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [
    { data: teamsRaw },
    { data: picksRaw },
    { data: settings },
    { data: groupMatches },
    { data: koMatchesRaw },
    { data: pointRows },
    { data: overridesRaw },
  ] = await Promise.all([
    supabase.from("teams").select("code, name").order("name"),
    supabase
      .from("bracket_picks")
      .select("round, slot, team_code")
      .eq("user_id", user.id),
    supabase.from("settings").select("lock_at").eq("id", 1).single(),
    supabase
      .from("matches")
      .select("home_team, away_team, group_name")
      .eq("stage", "GROUP_STAGE")
      .not("group_name", "is", null),
    supabase
      .from("matches")
      .select("id, kickoff_at")
      .in("stage", ["LAST_32", "LAST_16", "QUARTER_FINALS", "SEMI_FINALS", "FINAL"]),
    supabase.from("points").select("points").eq("user_id", user.id).eq("source", "knockout"),
    supabase
      .from("bracket_match_overrides")
      .select("match_id, side, team_code")
      .eq("user_id", user.id),
  ]);

  const totalPoints = (pointRows ?? []).reduce((s, r) => s + (r.points ?? 0), 0);

  const teamGroup = new Map<string, string>();
  for (const m of groupMatches ?? []) {
    if (m.home_team && m.group_name) teamGroup.set(m.home_team, m.group_name);
    if (m.away_team && m.group_name) teamGroup.set(m.away_team, m.group_name);
  }

  const lockAt = settings?.lock_at ?? "2026-06-11T17:00:00Z";
  const isLocked = new Date(lockAt) <= new Date();

  const teamsV2: { code: string; name: string; group: GroupCode }[] = [];
  for (const t of teamsRaw ?? []) {
    const raw = teamGroup.get(t.code) ?? "";
    const letter = raw.startsWith("GROUP_") ? raw.slice(6) : raw;
    if (!isGroupCode(letter)) continue;
    teamsV2.push({ code: t.code, name: t.name, group: letter });
  }

  const phaseA: PhaseA = {};
  const phaseB = new Set<string>();
  const bracket: Bracket = {};
  const validMatchIds = new Set<string>(ALL_MATCH_IDS);

  for (const p of picksRaw ?? []) {
    if (!p.team_code) continue;
    if (p.round === "GROUP_TOP_2") {
      // Slot-encoding: (rank-1)*12 + groupIdx (A=0..L=11)
      // → rank1: 0..11, rank2: 12..23, rank3: 24..35
      if (typeof p.slot !== "number") continue;
      const rank = Math.floor(p.slot / 12) + 1;
      const groupIdx = p.slot % 12;
      const g = String.fromCharCode("A".charCodeAt(0) + groupIdx);
      if (!isGroupCode(g)) continue;
      // Defensieve check: het team moet daadwerkelijk in deze poule spelen.
      // Voorkomt corrupte state als data ooit verkeerd is opgeslagen (bv.
      // overgang van oude naar nieuwe slot-encoding).
      const actualGroupRaw = teamGroup.get(p.team_code) ?? "";
      const actualGroup = actualGroupRaw.startsWith("GROUP_") ? actualGroupRaw.slice(6) : actualGroupRaw;
      if (actualGroup !== g) continue;
      phaseA[g] = phaseA[g] ?? {};
      if (rank === 1) phaseA[g]!.rank1 = p.team_code;
      else if (rank === 2) phaseA[g]!.rank2 = p.team_code;
      else if (rank === 3) phaseA[g]!.rank3 = p.team_code;
    } else if (p.round === "BEST_THIRDS") {
      phaseB.add(p.team_code);
    } else if (p.round === "LAST_32" && typeof p.slot === "number") {
      const id = `R32-${p.slot}`;
      if (validMatchIds.has(id)) bracket[id as MatchId] = p.team_code;
    } else if (p.round === "LAST_16" && typeof p.slot === "number") {
      const id = `R16-${p.slot}`;
      if (validMatchIds.has(id)) bracket[id as MatchId] = p.team_code;
    } else if (p.round === "QUARTER_FINALS" && typeof p.slot === "number") {
      const id = `QF-${p.slot}`;
      if (validMatchIds.has(id)) bracket[id as MatchId] = p.team_code;
    } else if (p.round === "SEMI_FINALS" && typeof p.slot === "number") {
      const id = `SF-${p.slot}`;
      if (validMatchIds.has(id)) bracket[id as MatchId] = p.team_code;
    } else if (p.round === "FINAL") {
      bracket["F-1"] = p.team_code;
    }
  }

  const matchDatesByFifaNo = new Map<number, Date>();
  for (const m of koMatchesRaw ?? []) {
    if (m.id && m.kickoff_at) matchDatesByFifaNo.set(m.id, new Date(m.kickoff_at));
  }

  // Overrides per match per side
  const overrides: Partial<Record<MatchId, { home?: string; away?: string }>> = {};
  for (const o of overridesRaw ?? []) {
    if (!validMatchIds.has(o.match_id)) continue;
    const m = o.match_id as MatchId;
    if (!overrides[m]) overrides[m] = {};
    if (o.side === "home") overrides[m]!.home = o.team_code;
    else if (o.side === "away") overrides[m]!.away = o.team_code;
  }

  return (
    <KnockoutFormV2
      teams={teamsV2}
      initial={{ phaseA, phaseB, bracket, overrides }}
      isLocked={isLocked}
      totalPoints={totalPoints}
      matchDatesByFifaNo={matchDatesByFifaNo}
    />
  );
}
