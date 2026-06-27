import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import GroupStageForm, { type Match, type Prediction } from "./GroupStageForm";
import ActiveMatchWidget from "@/app/components/ActiveMatchWidget";
import KnockoutMatchWidget, { type KoPickRow } from "@/app/components/KnockoutMatchWidget";
import { BRACKET_GRAPH, ALL_MATCH_IDS } from "@/lib/bracket/bracket-graph";
import type { MatchId } from "@/lib/bracket/types";

export default async function InvullenPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null; // layout handles redirect

  // Zodra de knock-out gestart is (R32-landen geplaatst) wordt "Mijn poule"
  // standaard de knock-out — behalve als je expliciet de Groepsfase-subtab
  // koos (?tab=groep). Zo kom je na de poulefase meteen bij de KO-wedstrijden.
  const { tab } = await searchParams;
  if (tab !== "groep") {
    const { count: koPlaced } = await supabase
      .from("matches")
      .select("id", { count: "exact", head: true })
      .in("stage", ["LAST_32", "LAST_16", "QUARTER_FINALS", "SEMI_FINALS", "FINAL"])
      .not("home_team", "is", null);
    if ((koPlaced ?? 0) > 0) redirect("/invullen/knockout");
  }

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

  // ── Knock-out: dagelijkse "landen geselecteerd / landen door"-widget ──────────
  // Niet op uitslagen maar op landen: per knock-outduel welk land collega's
  // voorspelden door te gaan (bracket_picks-winnaarkeuze), en welk land doorgaat.
  const KO_STAGES = ["LAST_32", "LAST_16", "QUARTER_FINALS", "SEMI_FINALS", "FINAL"];
  const ROUND_LABEL: Record<string, string> = {
    LAST_32: "1/16 finale", LAST_16: "1/8 finale", QUARTER_FINALS: "kwartfinale",
    SEMI_FINALS: "halve finale", FINAL: "finale",
  };
  const fifaToMatchId = new Map<number, MatchId>();
  for (const id of ALL_MATCH_IDS) fifaToMatchId.set(BRACKET_GRAPH[id].fifaMatchNo, id);
  const matchIdToRoundSlot = (id: MatchId): { round: string; slot: number } => {
    if (id.startsWith("R32-")) return { round: "LAST_32", slot: Number(id.slice(4)) };
    if (id.startsWith("R16-")) return { round: "LAST_16", slot: Number(id.slice(4)) };
    if (id.startsWith("QF-")) return { round: "QUARTER_FINALS", slot: Number(id.slice(3)) };
    if (id.startsWith("SF-")) return { round: "SEMI_FINALS", slot: Number(id.slice(3)) };
    return { round: "FINAL", slot: 1 };
  };

  type KoMatch = { id: number; stage: string; home_team: string | null; away_team: string | null; kickoff_at: string; status: string; home_score: number | null; away_score: number | null };
  type KoWidget = {
    key: number; roundLabel: string;
    homeName: string | null; homeCode: string | null;
    awayName: string | null; awayCode: string | null;
    kickoffAt: string; isLive: boolean; finished: boolean;
    advancerCode: string | null; rows: KoPickRow[];
  };
  let koWidgets: KoWidget[] = [];

  if (isLocked) {
    const { data: koMatchesRaw } = await supabase
      .from("matches")
      .select("id, stage, home_team, away_team, kickoff_at, status, home_score, away_score")
      .in("stage", KO_STAGES)
      .order("kickoff_at", { ascending: true });
    const koMatches = (koMatchesRaw ?? []) as KoMatch[];
    const koByFifa = new Map<number, { home_team: string | null; away_team: string | null }>();
    for (const m of koMatches) koByFifa.set(m.id, { home_team: m.home_team, away_team: m.away_team });

    const koToday = koMatches.filter((m) => nlDayKey(new Date(m.kickoff_at)) === todayKey);
    const koNext = koMatches.find((m) => m.status === "LIVE")
      ?? koMatches.filter((m) => m.status !== "FINISHED")[0];
    // Tijdens de groepsfase leidt de groeps-widget; de knock-out-widget verschijnt
    // zodra er een KO-duel vandaag is, of zodra de groepsfase voorbij is
    // (geen komende groepswedstrijd meer = nextUpcoming undefined).
    const groupStageOver = !nextUpcoming;
    const koFeatured = koToday.length > 0 ? koToday : (groupStageOver && koNext ? [koNext] : []);

    if (koFeatured.length > 0) {
      const neededRounds = Array.from(new Set(
        koFeatured.map((m) => {
          const mid = fifaToMatchId.get(m.id);
          return mid ? matchIdToRoundSlot(mid).round : null;
        }).filter((r): r is string => r !== null),
      ));

      const picks: Array<{ user_id: string; round: string; slot: number | null; team_code: string | null }> = [];
      for (let from = 0; neededRounds.length > 0; from += 1000) {
        const { data, error } = await supabase
          .from("bracket_picks")
          .select("user_id, round, slot, team_code")
          .in("round", neededRounds)
          .range(from, from + 999);
        if (error) break;
        const batch = data ?? [];
        picks.push(...batch);
        if (batch.length < 1000) break;
      }
      const picksByRoundSlot = new Map<string, Array<{ user_id: string; team_code: string }>>();
      for (const p of picks) {
        if (!p.team_code || p.slot == null) continue;
        const key = `${p.round}:${p.slot}`;
        if (!picksByRoundSlot.has(key)) picksByRoundSlot.set(key, []);
        picksByRoundSlot.get(key)!.push({ user_id: p.user_id, team_code: p.team_code });
      }

      const { data: koProfilesRaw } = await supabase
        .from("profiles")
        .select("id, display_name, department, secondary_department");
      const koProfileMap = new Map(
        (koProfilesRaw ?? [])
          .filter((p) => p.department !== "__LOADTEST__" && p.department !== "__SCORING_TEST__")
          .map((p) => [p.id, p]),
      );

      const advancerOf = (m: KoMatch): string | null => {
        if (m.status !== "FINISHED") return null;
        const mid = fifaToMatchId.get(m.id);
        if (mid) {
          const node = BRACKET_GRAPH[mid];
          if (node.round !== "FINAL" && node.child) {
            const child = koByFifa.get(BRACKET_GRAPH[node.child].fifaMatchNo);
            if (child) {
              if (m.home_team && (child.home_team === m.home_team || child.away_team === m.home_team)) return m.home_team;
              if (m.away_team && (child.home_team === m.away_team || child.away_team === m.away_team)) return m.away_team;
            }
          }
        }
        if (m.home_score != null && m.away_score != null && m.home_score !== m.away_score) {
          return m.home_score > m.away_score ? m.home_team : m.away_team;
        }
        return null;
      };

      koWidgets = koFeatured.map((m) => {
        const mid = fifaToMatchId.get(m.id);
        const rs = mid ? matchIdToRoundSlot(mid) : null;
        const rows: KoPickRow[] = rs
          ? (picksByRoundSlot.get(`${rs.round}:${rs.slot}`) ?? [])
              .map((pk) => {
                const prof = koProfileMap.get(pk.user_id);
                if (!prof) return null;
                return {
                  userId: pk.user_id,
                  displayName: prof.display_name ?? "Onbekend",
                  department: prof.department ?? null,
                  secondaryDepartment: prof.secondary_department ?? null,
                  pickedCode: pk.team_code,
                  pickedName: teams.get(pk.team_code) ?? pk.team_code,
                } satisfies KoPickRow;
              })
              .filter((r): r is KoPickRow => r !== null)
          : [];
        return {
          key: m.id,
          roundLabel: rs ? ROUND_LABEL[rs.round] : "knock-out",
          homeName: m.home_team ? (teams.get(m.home_team) ?? m.home_team) : null,
          homeCode: m.home_team,
          awayName: m.away_team ? (teams.get(m.away_team) ?? m.away_team) : null,
          awayCode: m.away_team,
          kickoffAt: m.kickoff_at,
          isLive: m.status === "LIVE",
          finished: m.status === "FINISHED",
          advancerCode: advancerOf(m),
          rows,
        } satisfies KoWidget;
      });
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Knock-out: landen geselecteerd / landen door ── */}
      {koWidgets.length > 0 && (
        <div className="space-y-3">
          {koWidgets.map((w) => (
            <div key={w.key} className="bg-surface border border-border rounded-lg px-4 py-3">
              <KnockoutMatchWidget
                roundLabel={w.roundLabel}
                homeName={w.homeName}
                homeCode={w.homeCode}
                awayName={w.awayName}
                awayCode={w.awayCode}
                kickoffAt={w.kickoffAt}
                isLive={w.isLive}
                finished={w.finished}
                advancerCode={w.advancerCode}
                rows={w.rows}
              />
            </div>
          ))}
        </div>
      )}

      {/* ── Collega-voorspellingen: alle wedstrijden van vandaag ── */}
      {isLocked && featuredWidgets.length > 0 && (
        <div className="space-y-3">
          {featuredWidgets.map(({ m, rows }) => (
            <div key={m.id} className="bg-surface border border-border rounded-lg px-4 py-3">
              <ActiveMatchWidget
                rows={rows}
                actualHomeScore={m.status === "FINISHED" ? (m.home_score ?? null) : null}
                actualAwayScore={m.status === "FINISHED" ? (m.away_score ?? null) : null}
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
