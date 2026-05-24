"use client";

import { useEffect, useState } from "react";

type Phase = "far" | "soon" | "warn" | "urgent" | "past";

function phaseOf(ms: number): Phase {
  if (ms <= 0) return "past";
  const h = ms / (60 * 60 * 1000);
  if (h < 6) return "urgent";       // < 6u: pulserend brand-kleur
  if (h < 72) return "warn";        // < 3d: amber
  if (h < 14 * 24) return "soon";   // < 14d: brand-soft
  return "far";                     // > 14d: muted
}

function diff(ms: number): { d: number; h: number; m: number } {
  const totalMin = Math.max(0, Math.floor(ms / 60000));
  const d = Math.floor(totalMin / (60 * 24));
  const h = Math.floor((totalMin % (60 * 24)) / 60);
  const m = totalMin % 60;
  return { d, h, m };
}

function formatRemaining(d: number, h: number, m: number): string {
  if (d > 0) return `${d} ${d === 1 ? "dag" : "dagen"} ${h} uur`;
  if (h > 0) return `${h} uur ${m} min`;
  return `${m} min`;
}

export default function LockCountdown({ lockAt }: { lockAt: string }) {
  // Start met de SSR-tijd; useEffect synct daarna meteen naar de echte tijd
  // van de bezoeker. Voorkomt hydration-mismatch.
  const [now, setNow] = useState(() => new Date(lockAt).getTime() - 30 * 24 * 60 * 60 * 1000);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    setMounted(true);
    // Eens per 30s ticken is genoeg voor minutenprecisie zonder battery-drain
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  const target = new Date(lockAt).getTime();
  const ms = target - now;
  const phase = phaseOf(ms);
  const { d, h, m } = diff(ms);

  const closeDate = new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(lockAt));

  if (phase === "past") {
    return (
      <div className="bg-brand text-white border-b border-brand-dark">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-2 flex items-center justify-center gap-2 text-xs sm:text-sm">
          <span aria-hidden>🔒</span>
          <span className="font-bold">De poule is gesloten</span>
          <span className="hidden sm:inline text-white/85">— alle voorspellingen staan vast</span>
        </div>
      </div>
    );
  }

  const baseClass = "border-b transition-colors";
  const phaseClass: Record<Exclude<Phase, "past">, string> = {
    far:    "bg-bg text-muted border-border",
    soon:   "bg-brand-soft text-brand border-brand/25",
    warn:   "bg-amber-50 text-amber-900 border-amber-300",
    urgent: "bg-brand text-white border-brand-dark",
  };

  const labelForPhase: Record<Exclude<Phase, "past">, string> = {
    far:    "tot sluiting",
    soon:   "tot sluiting",
    warn:   "tot sluiting · laatste dagen!",
    urgent: "tot sluiting · laatste uren!",
  };

  return (
    <div className={`${baseClass} ${phaseClass[phase]}`}>
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-1.5 sm:py-2 flex items-center justify-between gap-3 text-[11px] sm:text-sm">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          {/* Inline SVG i.p.v. ⏱-emoji — die werd door Twemoji clip-art op desktop. */}
          <svg
            aria-hidden
            className={`shrink-0 ${phase === "urgent" ? "animate-pulse" : ""}`}
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="13" r="8" />
            <path d="M12 9v4l2.5 2" />
            <path d="M9 2h6" />
            <path d="M12 2v3" />
          </svg>
          <span
            className={`font-bold tabular-nums ${phase === "urgent" ? "animate-pulse" : ""}`}
            // Verberg tot na mount om SSR-flicker te voorkomen — toon dan
            // direct het echte aantal
            style={{ opacity: mounted ? 1 : 0 }}
          >
            Nog {formatRemaining(d, h, m)}
          </span>
          <span className="hidden sm:inline opacity-80 truncate">
            {labelForPhase[phase]}
          </span>
        </div>
        <span className="shrink-0 opacity-80 text-[10px] sm:text-xs">
          sluit {closeDate}
        </span>
      </div>
    </div>
  );
}
