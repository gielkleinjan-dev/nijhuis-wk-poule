import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Geeft terug naar welke invul-pagina de gebruiker moet voor de wedstrijd
 * van vandaag. Gebruikt door <TodayButton/> om cross-tab te navigeren.
 *
 * Logica:
 *  1. Eerst kijken naar wedstrijden vandaag in Europe/Amsterdam tijdzone
 *  2. Anders: eerstvolgende wedstrijd in de toekomst
 *  3. Anders: laatste wedstrijd (toernooi voorbij)
 *
 * Returns: { href: '/invullen' | '/invullen/knockout' | null,
 *            stage: string | null, kickoff: string | null }
 */

function hrefForStage(stage: string | null | undefined): string | null {
  if (!stage) return null;
  if (stage === "GROUP_STAGE") return "/invullen";
  if (["LAST_32", "LAST_16", "QUARTER_FINALS", "SEMI_FINALS", "FINAL"].includes(stage)) {
    return "/invullen/knockout";
  }
  return null;
}

function amsterdamDayBounds(): { start: Date; end: Date } {
  // 'Vandaag' in Europe/Amsterdam = van 00:00 tot 24:00 lokale tijd, in UTC.
  const now = new Date();
  const ymdInAmsterdam = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  // 'en-CA' geeft 'YYYY-MM-DD'
  // Bouw lokale start/end die in Amsterdam-tijd om 00:00 en 24:00 vallen.
  // Werkwijze: probeer UTC-start als die-datum-00:00:00Z; corrigeer met tz-offset.
  const startAsIfUtc = new Date(`${ymdInAmsterdam}T00:00:00.000Z`);
  // Wat geeft Amsterdam aan op exact dat UTC-moment?
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Amsterdam",
    year: "numeric", month: "numeric", day: "numeric",
    hour: "numeric", minute: "numeric", second: "numeric",
    hour12: false,
  });
  const parts = fmt.formatToParts(startAsIfUtc).reduce<Record<string, string>>((acc, p) => {
    if (p.type !== "literal") acc[p.type] = p.value;
    return acc;
  }, {});
  const tzMs = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  );
  const offsetMs = tzMs - startAsIfUtc.getTime();
  const start = new Date(startAsIfUtc.getTime() - offsetMs);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { start, end } = amsterdamDayBounds();

  // 1. Wedstrijden vandaag?
  const { data: today } = await supabase
    .from("matches")
    .select("id, stage, kickoff_at")
    .gte("kickoff_at", start.toISOString())
    .lt("kickoff_at", end.toISOString())
    .order("kickoff_at", { ascending: true })
    .limit(1);

  if (today && today.length > 0) {
    const m = today[0];
    return NextResponse.json({
      kind: "today",
      stage: m.stage,
      href: hrefForStage(m.stage),
      kickoff: m.kickoff_at,
    });
  }

  // 2. Eerstvolgende
  const { data: upcoming } = await supabase
    .from("matches")
    .select("id, stage, kickoff_at")
    .gt("kickoff_at", new Date().toISOString())
    .order("kickoff_at", { ascending: true })
    .limit(1);

  if (upcoming && upcoming.length > 0) {
    const m = upcoming[0];
    return NextResponse.json({
      kind: "upcoming",
      stage: m.stage,
      href: hrefForStage(m.stage),
      kickoff: m.kickoff_at,
    });
  }

  // 3. Laatste (toernooi voorbij)
  const { data: last } = await supabase
    .from("matches")
    .select("id, stage, kickoff_at")
    .order("kickoff_at", { ascending: false })
    .limit(1);

  if (last && last.length > 0) {
    const m = last[0];
    return NextResponse.json({
      kind: "past",
      stage: m.stage,
      href: hrefForStage(m.stage),
      kickoff: m.kickoff_at,
    });
  }

  return NextResponse.json({ kind: "none", stage: null, href: null, kickoff: null });
}
