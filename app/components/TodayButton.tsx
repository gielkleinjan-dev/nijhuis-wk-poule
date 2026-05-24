"use client";

import { useEffect, useState } from "react";

/**
 * Floating knop rechtsonder die scrollt naar de wedstrijd-rij van vandaag.
 * Werkt op pagina's met match-rijen die een data-kickoff attribuut hebben
 * met een ISO-date string (bv. "2026-06-15T15:00:00Z").
 *
 * Logica:
 *  - Vindt eerste rij met kickoff-datum gelijk aan vandaag (Europe/Amsterdam)
 *  - Geen match vandaag? Scroll naar eerstvolgende toekomstige match.
 *  - Alle matches voorbij? Scroll naar laatste match (eind toernooi).
 *
 * Gele highlight: rijen met data-kickoff op vandaag krijgen automatisch
 * een `data-today="true"` attribuut zodat CSS ze kan accentueren.
 */
export default function TodayButton({ label = "Vandaag" }: { label?: string }) {
  const [hint, setHint] = useState<string>("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    markTodayRows();
    updateHint();
  }, []);

  function dayKey(d: Date): string {
    // Datum-key in Europe/Amsterdam tijdzone (yyyy-mm-dd)
    const fmt = new Intl.DateTimeFormat("nl-NL", {
      timeZone: "Europe/Amsterdam",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const parts = fmt.formatToParts(d).reduce<Record<string, string>>((acc, p) => {
      acc[p.type] = p.value;
      return acc;
    }, {});
    return `${parts.year}-${parts.month}-${parts.day}`;
  }

  function findRows(): HTMLElement[] {
    return Array.from(document.querySelectorAll<HTMLElement>("[data-kickoff]"));
  }

  function markTodayRows() {
    const today = dayKey(new Date());
    for (const row of findRows()) {
      const k = row.dataset.kickoff;
      if (!k) continue;
      const matchDay = dayKey(new Date(k));
      row.dataset.today = matchDay === today ? "true" : "false";
    }
  }

  function updateHint() {
    const today = dayKey(new Date());
    const todayRows = findRows().filter((r) => {
      const k = r.dataset.kickoff;
      return k && dayKey(new Date(k)) === today;
    });
    if (todayRows.length > 0) {
      setHint(`${todayRows.length} wedstrijd${todayRows.length === 1 ? "" : "en"} vandaag`);
    } else {
      // Vind eerstvolgende
      const now = Date.now();
      const upcoming = findRows()
        .map((r) => ({ row: r, ts: r.dataset.kickoff ? new Date(r.dataset.kickoff).getTime() : 0 }))
        .filter(({ ts }) => ts > now)
        .sort((a, b) => a.ts - b.ts);
      if (upcoming.length > 0) {
        const ts = upcoming[0].ts;
        const dateStr = new Date(ts).toLocaleDateString("nl-NL", {
          weekday: "long",
          day: "numeric",
          month: "short",
        });
        setHint(`Eerstvolgende: ${dateStr}`);
      } else {
        setHint("Toernooi voorbij");
      }
    }
  }

  function scrollToToday() {
    const today = dayKey(new Date());
    const rows = findRows();

    // 1. Probeer wedstrijd vandaag
    let target = rows.find((r) => {
      const k = r.dataset.kickoff;
      return k && dayKey(new Date(k)) === today;
    });

    // 2. Anders: eerstvolgende toekomstig
    if (!target) {
      const now = Date.now();
      target = rows
        .filter((r) => {
          const k = r.dataset.kickoff;
          return k && new Date(k).getTime() > now;
        })
        .sort((a, b) => {
          return new Date(a.dataset.kickoff!).getTime() - new Date(b.dataset.kickoff!).getTime();
        })[0];
    }

    // 3. Anders: laatste match (toernooi voorbij)
    if (!target && rows.length > 0) {
      target = rows[rows.length - 1];
    }

    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  if (!mounted) return null;

  return (
    <button
      type="button"
      onClick={scrollToToday}
      title={hint || label}
      aria-label="Scroll naar wedstrijd van vandaag"
      className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 inline-flex items-center gap-2 bg-brand text-white rounded-full pl-3 pr-4 py-2.5 shadow-lg hover:opacity-95 transition active:scale-95"
    >
      <svg
        aria-hidden
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 10h18" />
        <path d="M8 3v4" />
        <path d="M16 3v4" />
        <circle cx="12" cy="15" r="1.5" fill="currentColor" />
      </svg>
      <span className="font-semibold text-sm whitespace-nowrap">{label}</span>
    </button>
  );
}
