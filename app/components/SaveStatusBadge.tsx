"use client";

import { useEffect, useState } from "react";

export type SaveState = "idle" | "saving" | "saved" | "error";

/**
 * Toont de gecombineerde save-status van een formulier. Gevoed met een
 * Record<key, SaveState> (zoals useDebouncedSave teruggeeft) leidt 'm
 * automatisch de juiste boodschap af:
 *
 *   - één of meer keys "saving"  -> "opslaan…"
 *   - één of meer keys "error"   -> "opslaan mislukt — probeer opnieuw"
 *   - alle keys "saved" of "idle" + er was net een save -> ✓ Opgeslagen
 *     (pulse-animatie, blijft 1.5s, daarna verborgen)
 *   - alles idle vanaf begin     -> niets
 *
 * Idee: gelijktrekken met de per-veld save-flash in Groepsfase, zonder de
 * forms te hoeven refactoren naar per-veld tracking.
 */
export default function SaveStatusBadge({
  saveStates,
  className = "",
}: {
  saveStates: Record<string, SaveState>;
  className?: string;
}) {
  // We tracken intern of er ooit een save bezig is geweest. Pas dán mag
  // de "Opgeslagen" badge verschijnen. Anders flikkert 'ie soms even bij
  // mount voor een veld dat nooit save'de.
  const [hasSaved, setHasSaved] = useState(false);
  const [recentlySavedTick, setRecentlySavedTick] = useState(0);

  const anySaving = Object.values(saveStates).some((s) => s === "saving");
  const anyError = Object.values(saveStates).some((s) => s === "error");
  const anySaved = Object.values(saveStates).some((s) => s === "saved");

  // Trigger het "saved"-moment opnieuw zodra een nieuwe key naar saved gaat.
  // useDebouncedSave clear't naar idle na 1800ms, dus we volgen die window.
  useEffect(() => {
    if (anySaved) {
      setHasSaved(true);
      setRecentlySavedTick((t) => t + 1);
    }
  }, [anySaved]);

  if (anyError) {
    return (
      <span className={`text-xs text-brand font-semibold ${className}`}>
        opslaan mislukt — probeer opnieuw
      </span>
    );
  }

  if (anySaving) {
    return (
      <span className={`text-xs text-muted ${className}`}>opslaan…</span>
    );
  }

  if (anySaved && hasSaved) {
    return (
      <span
        // key forceert React om de span opnieuw te mounten en de
        // CSS-animatie opnieuw te starten bij elke nieuwe save.
        key={recentlySavedTick}
        className={`save-flash inline-flex items-center gap-1 text-xs font-semibold text-pitch ${className}`}
      >
        <span
          aria-hidden
          className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-pitch text-white text-[10px] font-bold leading-none"
        >
          ✓
        </span>
        Opgeslagen
      </span>
    );
  }

  return null;
}
