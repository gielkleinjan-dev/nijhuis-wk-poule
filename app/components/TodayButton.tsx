"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type TodayInfo = {
  kind: "today" | "upcoming" | "past" | "none";
  stage: string | null;
  href: string | null;
  kickoff: string | null;
};

/**
 * Floating knop rechtsonder die naar de wedstrijd van vandaag scrollt of
 * navigeert. Werkt cross-page: als vandaag's wedstrijd op een andere tab
 * staat (bv. jij zit op /invullen maar vandaag is een knock-out match),
 * navigeert hij naar de juiste tab en scrollt daar.
 *
 * Mechanisme:
 *   - Bij mount fetched /api/today-stage → krijgt back { href, kickoff, kind }
 *   - Klik:
 *       a) Als href == current path → scroll naar [data-kickoff] op vandaag
 *       b) Anders → router.push(href) → de target-page heeft een eigen
 *          TodayButton die op mount ook /api/today-stage fetcht en scrollt
 *
 * data-today="true" wordt op rij gezet zodat CSS highlight aanslaat.
 */
export default function TodayButton({ label = "Vandaag" }: { label?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [info, setInfo] = useState<TodayInfo | null>(null);

  useEffect(() => {
    setMounted(true);
    fetch("/api/today-stage")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: TodayInfo | null) => {
        if (data) setInfo(data);
        markTodayRows();
      })
      .catch(() => {
        // Stil falen — knop blijft werken voor in-page scroll
        markTodayRows();
      });
  }, []);

  // Re-mark today rows after route changes (zodat de andere pagina ook
  // gehighlight wordt na navigatie naar /invullen of /invullen/knockout)
  useEffect(() => {
    if (mounted) {
      // Kleine timeout zodat de DOM na navigation klaar is
      const t = setTimeout(markTodayRows, 100);
      return () => clearTimeout(t);
    }
  }, [pathname, mounted]);

  function dayKey(d: Date): string {
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
      row.dataset.today = dayKey(new Date(k)) === today ? "true" : "false";
    }
  }

  function scrollToTargetInDOM(): boolean {
    const today = dayKey(new Date());
    const rows = findRows();

    // 1. Probeer wedstrijd vandaag
    let target = rows.find((r) => {
      const k = r.dataset.kickoff;
      return k && dayKey(new Date(k)) === today;
    });

    // 2. Anders: eerstvolgende toekomstig op deze pagina
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

    // 3. Anders: laatste op deze pagina
    if (!target && rows.length > 0) {
      target = rows[rows.length - 1];
    }

    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      return true;
    }
    return false;
  }

  function handleClick() {
    // Eerst proberen op huidige pagina te scrollen — als 'r een match
    // vandaag staat (data-kickoff matched today), is dat genoeg.
    const today = dayKey(new Date());
    const todayRowExists = findRows().some(
      (r) => r.dataset.kickoff && dayKey(new Date(r.dataset.kickoff)) === today,
    );
    if (todayRowExists) {
      scrollToTargetInDOM();
      return;
    }

    // Geen match vandaag op deze pagina. Als API zegt dat 'ie elders staat:
    // navigeer daarheen. Op de doelpagina mount een eigen TodayButton die
    // bij arrival opnieuw scrollt naar today's row.
    if (info?.href && info.href !== pathname) {
      router.push(info.href);
      return;
    }

    // Anders: doe wat we kunnen op deze pagina (eerstvolgende / laatste)
    scrollToTargetInDOM();
  }

  // Compose hint-tekst voor tooltip + label-overlay
  let hint = label;
  if (info?.kind === "today") {
    hint = "Wedstrijd van vandaag";
  } else if (info?.kind === "upcoming" && info.kickoff) {
    const dateStr = new Date(info.kickoff).toLocaleDateString("nl-NL", {
      weekday: "long",
      day: "numeric",
      month: "short",
    });
    hint = `Eerstvolgende: ${dateStr}`;
  } else if (info?.kind === "past") {
    hint = "Toernooi voorbij";
  }

  if (!mounted) return null;

  return (
    <button
      type="button"
      onClick={handleClick}
      title={hint}
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
