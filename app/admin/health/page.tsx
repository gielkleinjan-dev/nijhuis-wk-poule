import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { redirect } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

/**
 * Visueel health-dashboard voor admins. Toont in één oogopslag:
 *  - hoeveel deelnemers, gem. invul-niveau per fase
 *  - aantal FINISHED matches t.o.v. totaal
 *  - lock-status + tijd tot lock
 *  - link naar de raw JSON-endpoint voor extern monitoring
 *
 * Bedoeld voor handmatige check vóór en tijdens het toernooi.
 */

type Stat = {
  label: string;
  value: string;
  hint?: string;
  tone?: "ok" | "warn" | "info";
};

function StatCard({ label, value, hint, tone = "info" }: Stat) {
  const toneClass =
    tone === "ok"
      ? "border-pitch/30"
      : tone === "warn"
      ? "border-amber-300 bg-amber-50/40"
      : "border-border";
  return (
    <div className={`bg-surface border rounded-lg p-4 ${toneClass}`}>
      <div className="text-xs text-muted uppercase tracking-wider font-semibold">{label}</div>
      <div className="text-2xl font-bold tabular-nums mt-1">{value}</div>
      {hint && <div className="text-xs text-muted mt-1">{hint}</div>}
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
    { data: lastMatch },
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
    supabase
      .from("matches")
      .select("id, status, kickoff_at")
      .order("kickoff_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("settings").select("lock_at").eq("id", 1).maybeSingle(),
  ]);

  const users = profileCount ?? 0;
  const realUsers = users - (loadtestCount ?? 0);
  const lockAt = settings?.lock_at ? new Date(settings.lock_at) : null;
  const isLocked = lockAt ? lockAt.getTime() <= now : false;
  const msToLock = lockAt ? lockAt.getTime() - now : null;
  const finishedPct =
    (matchesTotal ?? 0) === 0 ? 0 : Math.round(((matchesFinished ?? 0) / (matchesTotal ?? 1)) * 100);

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

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="tab-hero bg-surface border border-border rounded-lg p-5">
        <div className="flex items-baseline justify-between gap-3 mb-1">
          <h1 className="text-2xl font-bold leading-tight">Health dashboard</h1>
          <Link href="/api/admin/health" className="text-xs text-muted hover:text-fg underline shrink-0">
            JSON-endpoint
          </Link>
        </div>
        <p className="text-sm text-muted">
          Eén blik op de hele app-state — bij twijfel of de boel draait, hier eerst kijken.
          Auto-refresh om de 60 seconden niet ingebouwd: hard refresh (Cmd/Ctrl+R) of klik de
          tab opnieuw aan om verse cijfers te halen.
        </p>
      </div>

      {/* Lock-status */}
      <section>
        <h2 className="text-lg font-bold mb-3">Lock</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            label="Status"
            value={isLocked ? "Gesloten" : "Open"}
            tone={isLocked ? "ok" : "info"}
            hint={lockAt ? lockAt.toLocaleString("nl-NL") : "niet ingesteld"}
          />
          <StatCard
            label="Tijd tot lock"
            value={timeUntilLock()}
            tone={msToLock !== null && msToLock < 6 * 60 * 60 * 1000 && msToLock > 0 ? "warn" : "info"}
          />
          <StatCard
            label="Deelnemers"
            value={String(realUsers)}
            hint={loadtestCount && loadtestCount > 0 ? `+ ${loadtestCount} loadtest` : undefined}
          />
          <StatCard
            label="Loadtest-data?"
            value={loadtestCount && loadtestCount > 0 ? "Aanwezig" : "Schoon"}
            tone={loadtestCount && loadtestCount > 0 ? "warn" : "ok"}
            hint={loadtestCount && loadtestCount > 0 ? "→ npm run loadtest:cleanup -- --confirm" : undefined}
          />
        </div>
      </section>

      {/* Invul-niveau per fase */}
      <section>
        <h2 className="text-lg font-bold mb-3">Invul-niveau</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            label="Groepsfase totaal"
            value={String(predictionCount ?? 0)}
            hint={`gem. ${avg(predictionCount, 72)} per user`}
          />
          <StatCard
            label="Knock-out totaal"
            value={String(bracketPickCount ?? 0)}
            hint={`gem. ${avg(bracketPickCount, 63)} per user`}
          />
          <StatCard
            label="Bonus totaal"
            value={String(bonusPickCount ?? 0)}
            hint={`${realUsers > 0 ? Math.round(((bonusPickCount ?? 0) / realUsers) * 100) : 0}% deelnemers`}
          />
          <StatCard
            label="Punten-rijen"
            value={String(pointRowCount ?? 0)}
            hint={pointRowCount === 0 ? "nog geen uitslagen" : undefined}
          />
        </div>
      </section>

      {/* Matches + cron */}
      <section>
        <h2 className="text-lg font-bold mb-3">Wedstrijden & cron</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            label="Matches in DB"
            value={String(matchesTotal ?? 0)}
            tone={(matchesTotal ?? 0) === 0 ? "warn" : "info"}
            hint={(matchesTotal ?? 0) === 0 ? "matches-tabel is leeg!" : undefined}
          />
          <StatCard
            label="FINISHED"
            value={`${matchesFinished ?? 0} (${finishedPct}%)`}
            tone={finishedPct > 0 ? "ok" : "info"}
          />
          <StatCard
            label="Laatste match in DB"
            value={lastMatch?.kickoff_at ? new Date(lastMatch.kickoff_at).toLocaleDateString("nl-NL") : "—"}
            hint={lastMatch?.status ?? undefined}
          />
          <StatCard
            label="Match-import"
            value={(matchesTotal ?? 0) >= 100 ? "Compleet" : "Onvolledig"}
            tone={(matchesTotal ?? 0) >= 100 ? "ok" : "warn"}
            hint="104 wedstrijden verwacht"
          />
        </div>
      </section>

      <div className="text-xs text-muted">
        Geüpdatet: {new Date().toLocaleString("nl-NL")} · Dit dashboard refresht alleen bij page-reload.
      </div>
    </div>
  );
}
