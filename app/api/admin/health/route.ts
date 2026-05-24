import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Admin-only health-check endpoint. Geeft één blik op de hele app-state:
 * - hoeveel deelnemers, hoeveel die volledig hebben ingevuld
 * - laatste cron-run timestamp + aantal FINISHED matches
 * - totaal aantal picks per fase (groepsfase / knock-out / bonus)
 * - punten-tabel grootte
 *
 * Doel: bij twijfel ("draait de boel nog?") in 5 seconden zekerheid.
 * Bedoeld voor admin-handmatig + later eventueel voor monitoring-tools.
 */

type Stat = { label: string; value: number | string; warn?: boolean };

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const now = Date.now();
  const [
    { count: profileCount },
    { count: predictionCount },
    { count: bracketPickCount },
    { count: bonusPickCount },
    { count: pointRowCount },
    { count: matchesTotal },
    { count: matchesFinished },
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
    supabase
      .from("matches")
      .select("id, status, kickoff_at")
      .order("kickoff_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("settings").select("lock_at").eq("id", 1).maybeSingle(),
  ]);

  const lockAt = settings?.lock_at ? new Date(settings.lock_at) : null;
  const isLocked = lockAt ? lockAt.getTime() <= now : false;
  const msToLock = lockAt ? lockAt.getTime() - now : null;
  const finishedFrac = (matchesTotal ?? 0) === 0 ? 0 : (matchesFinished ?? 0) / (matchesTotal ?? 1);

  // Per-deelnemer-gemiddeldes — handig voor 'is iedereen aan het invullen?'
  const users = profileCount ?? 0;
  const avg = (n: number | null | undefined) => (users > 0 ? Math.round(((n ?? 0) / users) * 10) / 10 : 0);

  // Heuristieken voor warning-flags
  const stats: Stat[] = [
    { label: "Deelnemers", value: users },
    { label: "Predictions totaal", value: predictionCount ?? 0 },
    { label: "Predictions gem./user", value: `${avg(predictionCount)}/72` },
    { label: "Bracket-picks totaal", value: bracketPickCount ?? 0 },
    { label: "Bracket-picks gem./user", value: `${avg(bracketPickCount)}/63` },
    { label: "Bonus-picks rijen", value: bonusPickCount ?? 0 },
    { label: "Punten-rijen", value: pointRowCount ?? 0 },
    { label: "Matches totaal", value: matchesTotal ?? 0, warn: (matchesTotal ?? 0) === 0 },
    { label: "Matches FINISHED", value: `${matchesFinished ?? 0} (${Math.round(finishedFrac * 100)}%)` },
    {
      label: "Lock",
      value: lockAt
        ? isLocked
          ? `gesloten sinds ${lockAt.toLocaleString("nl-NL")}`
          : `over ${Math.ceil((msToLock ?? 0) / (1000 * 60 * 60))}u`
        : "niet ingesteld",
      warn: !lockAt,
    },
    {
      label: "Laatste match in DB",
      value: lastMatch?.kickoff_at
        ? `${new Date(lastMatch.kickoff_at).toLocaleDateString("nl-NL")} (${lastMatch.status})`
        : "—",
    },
  ];

  return NextResponse.json(
    {
      ok: true,
      checkedAt: new Date().toISOString(),
      summary: {
        users,
        ready: users > 0 && (matchesTotal ?? 0) > 0,
      },
      stats,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
