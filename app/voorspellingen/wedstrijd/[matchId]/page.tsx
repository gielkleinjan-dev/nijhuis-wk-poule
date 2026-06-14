import { createSupabaseServerClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { flagEmoji } from "@/lib/flags";
import Link from "next/link";
import MatchPredictionsClient from "@/app/components/MatchPredictionsClient";

export default async function WedstrijdVoorspellingenPage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const { matchId } = await params;
  const mid = parseInt(matchId, 10);
  if (isNaN(mid)) notFound();

  const supabase = await createSupabaseServerClient();

  const [
    { data: match },
    { data: teamsRaw },
    { data: predictionsRaw },
    { data: profilesRaw },
  ] = await Promise.all([
    supabase
      .from("matches")
      .select(
        "id, stage, home_team, away_team, kickoff_at, status, home_score, away_score"
      )
      .eq("id", mid)
      .single(),
    supabase.from("teams").select("code, name"),
    supabase
      .from("predictions")
      .select("user_id, home_score, away_score, toto_pick")
      .eq("match_id", mid),
    supabase
      .from("profiles")
      .select("id, display_name, department, secondary_department"),
  ]);

  if (!match) notFound();

  const teamName = new Map((teamsRaw ?? []).map((t) => [t.code, t.name]));

  // Filter test-users en build een map
  const profiles = (profilesRaw ?? []).filter(
    (p) =>
      p.department !== "__LOADTEST__" && p.department !== "__SCORING_TEST__"
  );
  const predMap = new Map(
    (predictionsRaw ?? []).map((p) => [p.user_id, p])
  );

  // Alleen deelnemers die een voorspelling hebben ingevuld voor deze wedstrijd
  const rows = profiles
    .map((p) => {
      const pred = predMap.get(p.id);
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

  const homeTeamName =
    teamName.get(match.home_team ?? "") ?? match.home_team ?? "?";
  const awayTeamName =
    teamName.get(match.away_team ?? "") ?? match.away_team ?? "?";

  const isFinished =
    match.status === "FINISHED" &&
    match.home_score != null &&
    match.away_score != null;

  const fmt = new Intl.DateTimeFormat("nl-NL", {
    timeZone: "Europe/Amsterdam",
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(match.kickoff_at));

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <div>
        <Link
          href="/voorspellingen"
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink transition"
        >
          ← Alle deelnemers
        </Link>
      </div>

      <div className="tab-hero bg-surface border border-border rounded-lg p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold mb-1 flex items-center gap-2 flex-wrap">
              {match.home_team && (
                <span className="flag-emoji" aria-hidden>
                  {flagEmoji(match.home_team)}
                </span>
              )}
              <span>{homeTeamName}</span>
              <span className="text-muted font-normal text-base">vs</span>
              <span>{awayTeamName}</span>
              {match.away_team && (
                <span className="flag-emoji" aria-hidden>
                  {flagEmoji(match.away_team)}
                </span>
              )}
            </h1>
            <p className="text-sm text-muted capitalize">{fmt}</p>
          </div>
          {isFinished && (
            <div className="text-right shrink-0">
              <div className="text-3xl font-bold tabular-nums text-pitch">
                {match.home_score}–{match.away_score}
              </div>
              <div className="text-xs text-muted">eindstand</div>
            </div>
          )}
        </div>
        <p className="text-sm text-muted mt-3">
          <span className="font-semibold text-fg">{rows.length}</span>{" "}
          deelnemers hebben deze wedstrijd voorspeld.
        </p>
      </div>

      <MatchPredictionsClient
        rows={rows}
        actualHomeScore={match.home_score ?? null}
        actualAwayScore={match.away_score ?? null}
      />
    </div>
  );
}
