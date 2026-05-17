// Thin wrapper around football-data.org v4 — fetches WC matches and transforms
// them into the shape our cron + scoring engine expect.

const API_URL = "https://api.football-data.org/v4/competitions/WC/matches";

export type FootballDataStatus =
  | "SCHEDULED"
  | "TIMED"
  | "IN_PLAY"
  | "PAUSED"
  | "FINISHED"
  | "SUSPENDED"
  | "POSTPONED"
  | "CANCELLED"
  | "AWARDED";

export type FootballDataMatch = {
  id: number;
  status: FootballDataStatus;
  stage: string;
  homeTeam: { tla: string | null };
  awayTeam: { tla: string | null };
  score: {
    winner: "HOME_TEAM" | "AWAY_TEAM" | "DRAW" | null;
    duration: "REGULAR" | "EXTRA_TIME" | "PENALTY_SHOOTOUT" | null;
    fullTime: { home: number | null; away: number | null };
  };
};

export type MatchUpdate = {
  external_id: number;
  home_score: number | null;
  away_score: number | null;
  status: string;
  // Voor knock-outwedstrijden vult football-data de teams pas in zodra de bracket
  // gezet is (groepsfase klaar). Null tot dat moment — cron-RPC gebruikt coalesce
  // zodat null nooit een bestaande waarde wist.
  home_team: string | null;
  away_team: string | null;
};

export async function fetchWcMatches(apiKey: string): Promise<FootballDataMatch[]> {
  const res = await fetch(API_URL, {
    headers: { "X-Auth-Token": apiKey },
    // Always fresh; cron handles caching cadence.
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`football-data ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as { matches: FootballDataMatch[] };
  return json.matches ?? [];
}

export function toMatchUpdates(matches: FootballDataMatch[]): MatchUpdate[] {
  return matches.map((m) => ({
    external_id: m.id,
    home_score: m.score.fullTime.home,
    away_score: m.score.fullTime.away,
    status: m.status,
    home_team: m.homeTeam.tla,
    away_team: m.awayTeam.tla,
  }));
}

// Build a winner map for knockout scoring. Uses score.winner (which respects
// extra time + penalty shoot-out) and resolves it to the team's TLA.
// Group matches are skipped (no winner concept for scoring).
export function buildWinnerMap(
  matches: FootballDataMatch[],
  externalIdToInternal: Map<number, number>,
): Map<number, string> {
  const winners = new Map<number, string>();
  for (const m of matches) {
    if (m.status !== "FINISHED") continue;
    const internalId = externalIdToInternal.get(m.id);
    if (!internalId) continue;
    const w = m.score.winner;
    if (w === "HOME_TEAM" && m.homeTeam.tla) winners.set(internalId, m.homeTeam.tla);
    else if (w === "AWAY_TEAM" && m.awayTeam.tla) winners.set(internalId, m.awayTeam.tla);
    // DRAW or null → no winner recorded (group stage or data missing).
  }
  return winners;
}
