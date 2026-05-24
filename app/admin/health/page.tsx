import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { redirect } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

/**
 * Visueel health-dashboard voor admins. Doel: in 5 sec zien of de app
 * gezond draait, met expliciete checks (✓ / ⚠) per onderdeel.
 *
 * Niet alleen cijfers - elk getal krijgt een verdict.
 */

type CheckStatus = "ok" | "warn" | "info";

type Check = {
  label: string;
  value: string;
  status: CheckStatus;
  hint?: string;
};

function StatusIcon({ status }: { status: CheckStatus }) {
  if (status === "ok") {
    return (
      <span
        aria-label="OK"
        className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-pitch text-white text-sm font-bold shrink-0"
      >
        ✓
      </span>
    );
  }
  if (status === "warn") {
    return (
      <span
        aria-label="Waarschuwing"
        className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-500 text-white text-sm font-bold shrink-0"
      >
        !
      </span>
    );
  }
  return (
    <span
      aria-label="Info"
      className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-border text-muted text-sm font-bold shrink-0"
    >
      i
    </span>
  );
}

function CheckRow({ check }: { check: Check }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3 border-b border-border last:border-0">
      <StatusIcon status={check.status} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <span className="font-medium text-sm">{check.label}</span>
          <span className="text-sm font-semibold tabular-nums text-right">{check.value}</span>
        </div>
        {check.hint && <div className="text-xs text-muted mt-0.5">{check.hint}</div>}
      </div>
    </div>
  );
}

export default async function HealthPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!isAdmin(user.email)) redirect("/ranglijst");

  const now = Date.now();
  const [
    { count: profileCount },
    { count: predictionCount },
    { count: bracketPickCount },
    { count: bonusPickCount },
    { count: pointRowCount },
    { count: matchesTotal },
    { count: matchesFinished },
    { count: loadtestCount },
    { data: settings },
  ] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("predictions").select("user_id", { count: "exact", head: true }),
    supabase.from("bracket_picks").select("user_id", { count: "exact", head: true }),
    supabase.from("bonus_picks").select("user_id", { count: "exact", head: true }),
    supabase.from("points").select("user_id", { count: "exact", head: true }),
    supabase.from("matches").select("id", { count: "exact", head: true }),
    supabase.from("matches").select("id", { count: "exact", head: true }).eq("status", "FINISHED"),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("department", "__LOADTEST__"),
    supabase.from("settings").select("lock_at").eq("id", 1).maybeSingle(),
  ]);

  const users = profileCount ?? 0;
  const realUsers = users - (loadtestCount ?? 0);
  const lockAt = settings?.lock_at ? new Date(settings.lock_at) : null;
  const isLocked = lockAt ? lockAt.getTime() <= now : false;
  const msToLock = lockAt ? lockAt.getTime() - now : null;
  const tournamentStarted = (matchesFinished ?? 0) > 0;

  function timeUntilLock(): string {
    if (!msToLock) return "—";
    if (msToLock <= 0) return "verstreken";
    const totalMin = Math.floor(msToLock / 60000);
    const d = Math.floor(totalMin / (60 * 24));
    const h = Math.floor((totalMin % (60 * 24)) / 60);
    if (d > 0) return `${d}d ${h}u`;
    return `${h}u ${totalMin % 60}m`;
  }

  function avg(n: number | null | undefined, total: number): string {
    if (realUsers === 0) return `0/${total}`;
    const a = Math.round(((n ?? 0) / realUsers) * 10) / 10;
    return `${a}/${total}`;
  }

  // ── Checks samenstellen ──
  const checks: Check[] = [
    // Lock
    {
      label: "Lock-datum ingesteld",
      value: lockAt ? lockAt.toLocaleString("nl-NL") : "niet ingesteld",
      status: lockAt ? "ok" : "warn",
      hint: !lockAt ? "Stel lock-datum in via /admin" : undefined,
    },
    {
      label: "Lock-status",
      value: isLocked ? "Gesloten" : "Open",
      status: "info",
      hint: !isLocked && msToLock ? `Nog ${timeUntilLock()} tot sluiting` : undefined,
    },
    // Deelnemers
    {
      label: "Geregistreerde deelnemers",
      value: String(realUsers),
      status: realUsers > 0 ? "ok" : "warn",
      hint: realUsers === 0 ? "Nog niemand ingeschreven" : undefined,
    },
    {
      label: "Loadtest-data opgeruimd",
      value: (loadtestCount ?? 0) === 0 ? "Schoon" : `${loadtestCount} test-users aanwezig`,
      status: (loadtestCount ?? 0) === 0 ? "ok" : "warn",
      hint: (loadtestCount ?? 0) > 0 ? "→ npm run loadtest:cleanup -- --confirm" : undefined,
    },
    // Wedstrijden
    {
      label: "Matches geïmporteerd",
      value: `${matchesTotal ?? 0} / 104`,
      status: (matchesTotal ?? 0) >= 104 ? "ok" : (matchesTotal ?? 0) >= 100 ? "info" : "warn",
      hint: (matchesTotal ?? 0) < 100 ? "Verwacht: 104 wedstrijden" : undefined,
    },
    {
      label: "FINISHED-wedstrijden",
      value: `${matchesFinished ?? 0}${(matchesTotal ?? 0) > 0 ? ` (${Math.round(((matchesFinished ?? 0) / (matchesTotal ?? 1)) * 100)}%)` : ""}`,
      status: tournamentStarted ? "ok" : "info",
      hint: !tournamentStarted ? "Toernooi nog niet begonnen" : undefined,
    },
    // Invul-niveau
    {
      label: "Groepsfase ingevuld",
      value: `${predictionCount ?? 0} picks · gem ${avg(predictionCount, 72)} per user`,
      status: realUsers === 0 ? "info" : (predictionCount ?? 0) > 0 ? "ok" : "warn",
    },
    {
      label: "Knock-out ingevuld",
      value: `${bracketPickCount ?? 0} picks · gem ${avg(bracketPickCount, 63)} per user`,
      status: realUsers === 0 ? "info" : (bracketPickCount ?? 0) > 0 ? "ok" : "warn",
    },
    {
      label: "Bonus ingevuld",
      value: `${bonusPickCount ?? 0} / ${realUsers} deelnemers`,
      status: realUsers === 0 ? "info" : (bonusPickCount ?? 0) > 0 ? "ok" : "warn",
    },
    // Scoring
    {
      label: "Punten berekend",
      value: pointRowCount ?? 0 === 0 ? "Nog geen punten" : `${pointRowCount} rijen`,
      status: !tournamentStarted ? "info" : (pointRowCount ?? 0) > 0 ? "ok" : "warn",
      hint: !tournamentStarted ? "Punten komen na eerste FINISHED-match" : undefined,
    },
  ];

  const warnCount = checks.filter((c) => c.status === "warn").length;
  const okCount = checks.filter((c) => c.status === "ok").length;

  return (
    <div className="space-y-6">
      {/* Overall verdict-banner */}
      <div
        className={`tab-hero bg-surface border rounded-lg p-5 ${
          warnCount === 0 ? "border-pitch/40" : "border-amber-400"
        }`}
      >
        <div className="flex items-center gap-4">
          <span
            className={`inline-flex items-center justify-center w-14 h-14 rounded-full text-3xl font-bold shrink-0 ${
              warnCount === 0 ? "bg-pitch text-white" : "bg-amber-500 text-white"
            }`}
          >
            {warnCount === 0 ? "✓" : "!"}
          </span>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold leading-tight">
              {warnCount === 0 ? "Alles in orde" : `${warnCount} waarschuwing${warnCount === 1 ? "" : "en"}`}
            </h1>
            <p className="text-sm text-muted mt-0.5">
              {okCount} van {checks.length} checks groen
              {warnCount > 0 ? " — bekijk de geel/oranje rijen hieronder" : ""}
            </p>
          </div>
          <Link
            href="/api/admin/health"
            className="text-xs text-muted hover:text-fg underline shrink-0 whitespace-nowrap"
          >
            JSON
          </Link>
        </div>
      </div>

      {/* Check-list */}
      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        {checks.map((c, i) => (
          <CheckRow key={i} check={c} />
        ))}
      </div>

      <div className="text-xs text-muted">
        Geüpdatet: {new Date().toLocaleString("nl-NL")} · Hard refresh voor verse cijfers.
      </div>
    </div>
  );
}
