import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { DEPARTMENTS } from "@/lib/departments";
import { isAdmin } from "@/lib/admin";
import MainNav from "@/app/components/MainNav";
import BrandLogo from "@/app/components/BrandLogo";
import UserHeader from "@/app/components/UserHeader";
import LockCountdown from "@/app/components/LockCountdown";
import IndividualLeaderboard from "./IndividualLeaderboard";

export default async function RanglijstPage({
  searchParams,
}: {
  searchParams: Promise<{ afdeling?: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { afdeling } = await searchParams;

  const [{ data: leaderboard }, { data: settings }, { data: teamSnapshots }] = await Promise.all([
    supabase
      .from("leaderboard")
      .select("user_id, display_name, department, secondary_department, total_points, rank, rank_prev")
      .order("rank", { ascending: true }),
    supabase.from("settings").select("lock_at").eq("id", 1).single(),
    supabase
      .from("team_rank_snapshots")
      .select("department, rank")
      .eq("snapped_at", new Date(Date.now() - 86400000).toISOString().slice(0, 10)),
  ]);

  const rows = leaderboard ?? [];

  // Teamleiders kunnen in 2 teams meetellen (department + secondary_department).
  // inTeam() checkt of een rij bij een team hoort, ongeacht welke van de twee.
  const inTeam = (r: { department: string | null; secondary_department: string | null }, dep: string) =>
    r.department === dep || r.secondary_department === dep;

  const filtered = afdeling
    ? rows.filter((r) => inTeam(r, afdeling))
    : rows;

  // Team standings: average points per member. Dual-team leden tellen in beide teams mee.
  const teamStandings = DEPARTMENTS.map((dep) => {
    const members = rows.filter((r) => inTeam(r, dep));
    const totalPoints = members.reduce((s, r) => s + (r.total_points ?? 0), 0);
    const avg = members.length > 0 ? totalPoints / members.length : 0;
    return { dep, count: members.length, totalPoints, avg };
  })
    .filter((t) => t.count > 0)
    .sort((a, b) => b.avg - a.avg || b.totalPoints - a.totalPoints);

  const me = rows.find((r) => r.user_id === user.id);
  const myDeps = [me?.department, me?.secondary_department].filter(Boolean) as string[];

  // Individual movement: delta = rank_prev - rank (positive = climbed)
  const withDelta = rows.map((r) => ({
    ...r,
    delta: r.rank_prev != null ? r.rank_prev - r.rank : null,
  }));
  const hasMovement = withDelta.some((r) => r.delta != null);
  // Top-3 risers: 🚀🚀🚀 / 🚀🚀 / 🚀 — top-3 fallers: 🪂🪂🪂 / 🪂🪂 / 🪂
  const risers = withDelta.filter((r) => (r.delta ?? 0) > 0).sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0)).slice(0, 3);
  const fallers = withDelta.filter((r) => (r.delta ?? 0) < 0).sort((a, b) => (a.delta ?? 0) - (b.delta ?? 0)).slice(0, 3);
  const rocketMap = new Map(risers.map((r, i) => [r.user_id, 3 - i]));
  const chuteMap  = new Map(fallers.map((r, i) => [r.user_id, 3 - i]));

  // Team movement
  const teamPrevRank = new Map((teamSnapshots ?? []).map((s) => [s.department, s.rank]));
  const teamStandingsWithDelta = teamStandings.map((t, i) => {
    const prev = teamPrevRank.get(t.dep);
    return { ...t, delta: prev != null ? prev - (i + 1) : null };
  });
  const hasTeamMovement = teamStandingsWithDelta.some((t) => t.delta != null);
  // Team ranglijst is klein — alleen de allergrootste stijger en daler markeren, beide met 3 emoji's.
  const teamTopRiser = teamStandingsWithDelta.filter((t) => (t.delta ?? 0) > 0).sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0))[0];
  const teamTopFaller = teamStandingsWithDelta.filter((t) => (t.delta ?? 0) < 0).sort((a, b) => (a.delta ?? 0) - (b.delta ?? 0))[0];
  const rocketDepMap = new Map(teamTopRiser ? [[teamTopRiser.dep, 3]] : []);
  const chuteDepMap  = new Map(teamTopFaller ? [[teamTopFaller.dep, 3]] : []);

  const lockAt = settings?.lock_at ?? "2026-06-10T15:00:00Z";
  const isLocked = new Date(lockAt) <= new Date();
  const userIsAdmin = isAdmin(user.email);
  const tournamentStarted = new Date() >= new Date("2026-06-11T19:00:00Z");

  return (
    <main className="min-h-screen">
      <LockCountdown lockAt={lockAt} />
      <header className="border-b border-border bg-surface">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 py-4 flex items-center justify-between gap-3 sm:gap-4">
          <BrandLogo href="/invullen" />
          <UserHeader
            displayName={user.user_metadata?.display_name || user.email || ""}
            isAdmin={userIsAdmin}
            isLocked={isLocked}
            lockAt={lockAt}
          />
        </div>
      </header>

      <MainNav isAdmin={userIsAdmin} isLocked={isLocked} lockAt={lockAt} maxWidth="max-w-4xl" />

      <div className="mx-auto max-w-4xl px-6 py-8 space-y-4">

        {/* Filter pills — volle breedte boven beide kolommen */}
        <div>
          <p className="text-xs text-muted mb-2">Filteren op team:</p>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/ranglijst"
              prefetch={false}
              className={`px-3 py-1 rounded-full text-sm border transition ${
                !afdeling
                  ? "bg-brand text-white border-brand"
                  : "bg-surface border-border text-muted hover:border-brand"
              }`}
            >
              Alle
            </Link>
            {DEPARTMENTS.map((dep) => (
              <Link
                key={dep}
                href={`/ranglijst?afdeling=${encodeURIComponent(dep)}`}
                prefetch={false}
                className={`px-3 py-1 rounded-full text-sm border transition ${
                  afdeling === dep
                    ? "bg-brand text-white border-brand"
                    : "bg-surface border-border text-muted hover:border-brand"
                }`}
              >
                {dep}
              </Link>
            ))}
          </div>
        </div>

        {/*
          2×2 grid: headers in row 1 (both stretch to the same height),
          tables in row 2 — so the tables always start at the same Y.
          On mobile (flex-col) we use order-* to keep each column together.
        */}
        <div className="flex flex-col lg:grid lg:grid-cols-[1fr_17rem] gap-6">

          {/* ── Individueel header ── row 1 col 1 */}
          <div className="order-1 lg:col-start-1 lg:row-start-1 tab-hero bg-surface border border-border rounded-lg p-5">
            <h1 className="text-2xl font-bold mb-1">Individueel klassement</h1>
            <p className="text-sm text-muted">
              {tournamentStarted
                ? `${rows.length} deelnemers · punten worden automatisch bijgewerkt`
                : `${rows.length} deelnemers · punten worden bijgewerkt zodra het toernooi begint`}
            </p>
            {hasMovement && (
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                <span>🚀🚀🚀 hardste stijger &nbsp;·&nbsp; 🚀🚀 tweede &nbsp;·&nbsp; 🚀 derde</span>
                <span>🪂🪂🪂 hardste daler &nbsp;·&nbsp; 🪂🪂 tweede &nbsp;·&nbsp; 🪂 derde</span>
              </div>
            )}
          </div>

          {/* ── Team header ── row 1 col 2 (desktop) / after ind-table on mobile */}
          <div className="order-4 lg:col-start-2 lg:row-start-1 tab-hero bg-surface border border-border rounded-lg p-5">
            <h2 className="text-2xl font-bold mb-1">Team klassement</h2>
            <p className="text-sm text-muted">
              Gemiddeld aantal punten per teamlid.
            </p>
            {hasTeamMovement && (teamTopRiser || teamTopFaller) && (
              <p className="text-xs text-muted mt-2">
                🚀🚀🚀 grootste stijger &nbsp;·&nbsp; 🪂🪂🪂 grootste daler
              </p>
            )}
          </div>

          {/* ── Individueel: zoekbalk (rij 2) + tabel (rij 3) ── kolom 1.
              De component levert twee grid-cellen aan zodat de teamtabel
              hieronder gelijk meeschuift en op dezelfde hoogte uitlijnt. */}
          <IndividualLeaderboard
            showMedals={!afdeling}
            hasMovement={hasMovement}
            afdeling={afdeling}
            rows={withDelta
              .filter((r) => !afdeling || inTeam(r, afdeling))
              .map((row) => ({
                userId: row.user_id,
                rank: row.rank,
                displayName: row.display_name,
                depLabel: [row.department, row.secondary_department].filter(Boolean).join(" · ") || "—",
                totalPoints: row.total_points ?? 0,
                delta: row.delta,
                isMe: row.user_id === user.id,
                rockets: rocketMap.get(row.user_id) ?? 0,
                chutes: chuteMap.get(row.user_id) ?? 0,
              }))}
          />

          {/* ── Team table ── rij 3 col 2 (lijnt uit met de individuele tabel) */}
          <div className="order-5 lg:col-start-2 lg:row-start-3 lg:sticky lg:top-6 lg:self-start space-y-4">
            <div className="bg-surface border border-border rounded-lg overflow-hidden">
              {teamStandingsWithDelta.length === 0 ? (
                <p className="p-6 text-muted text-sm text-center">
                  Nog geen teams met leden.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-bg/50 text-left text-xs font-semibold text-muted uppercase tracking-wide">
                      <th className="px-3 py-3 w-8">#</th>
                      <th className="px-3 py-3">Team</th>
                      {hasTeamMovement && <th className="px-2 py-3 text-center w-10 whitespace-nowrap">+/−</th>}
                      <th className="px-3 py-3 text-right whitespace-nowrap">Gem.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamStandingsWithDelta.map((t, i) => {
                      const isMyTeam = myDeps.includes(t.dep);
                      const d = t.delta;
                      return (
                        <tr
                          key={t.dep}
                          className={`border-b border-border last:border-0 ${
                            isMyTeam ? "bg-brand-soft" : i % 2 === 0 ? "bg-surface" : "bg-bg/30"
                          }`}
                        >
                          <td className="px-3 py-3 tabular-nums font-medium">
                            {i === 0 ? (
                              <span className="text-lg">🥇</span>
                            ) : i === 1 ? (
                              <span className="text-lg">🥈</span>
                            ) : i === 2 ? (
                              <span className="text-lg">🥉</span>
                            ) : (
                              <span className="text-muted">{i + 1}</span>
                            )}
                          </td>
                          <td className="px-3 py-3 font-medium text-sm leading-tight">
                            <span className="inline-flex items-center gap-1 flex-wrap">
                              {t.dep.replace("Team ", "")}
                              {isMyTeam && <span className="text-xs text-brand font-normal">(jij)</span>}
                              {rocketDepMap.has(t.dep) && <span title="Stijger">{"🚀".repeat(rocketDepMap.get(t.dep)!)}</span>}
                              {chuteDepMap.has(t.dep)  && <span title="Daler">{"🪂".repeat(chuteDepMap.get(t.dep)!)}</span>}
                            </span>
                            <div className="text-xs text-muted font-normal">{t.count} leden</div>
                          </td>
                          {hasTeamMovement && (
                            <td className="px-2 py-3 text-center tabular-nums text-xs font-semibold">
                              {d == null ? (
                                <span className="text-muted">—</span>
                              ) : d > 0 ? (
                                <span className="text-green-600">▲{d}</span>
                              ) : d < 0 ? (
                                <span className="text-brand">▼{Math.abs(d)}</span>
                              ) : (
                                <span className="text-blue-400">=</span>
                              )}
                            </td>
                          )}
                          <td className="px-3 py-3 text-right tabular-nums font-bold whitespace-nowrap">
                            {t.avg.toFixed(1)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

        </div>
      </div>
    </main>
  );
}
