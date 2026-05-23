"use client";

import { useEffect, useState } from "react";

/**
 * Eenmalig verschijnende tip-bubbel voor nieuwe gebruikers. Toont op de
 * eerste render een uitleg-bubbel; na het klikken op × verdwijnt 'ie voor
 * altijd voor die specifieke gebruiker (localStorage per id).
 *
 * Bedoeld voor concrete interactie-uitleg die tekst alleen niet vertelt
 * — bv. "tik op een land om te selecteren, nog eens om te wissen".
 *
 * Tijdens SSR/hydration onzichtbaar (mounted=false) om flicker te voorkomen.
 */
export default function OnboardingTip({
  id,
  children,
  className = "",
}: {
  /** Unieke key voor localStorage, bv. "ko-step-a". */
  id: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem(`onboarding:${id}`);
      setDismissed(stored === "1");
    } catch {
      // localStorage geblokkeerd (private mode etc.) — tip toch tonen,
      // dismissal is dan niet persistent.
      setDismissed(false);
    }
  }, [id]);

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(`onboarding:${id}`, "1");
    } catch {
      // Stil falen — tip verdwijnt in elk geval voor deze sessie.
    }
  }

  if (!mounted || dismissed) return null;

  return (
    <div
      role="note"
      className={`bg-amber-50 border border-amber-300 text-amber-900 rounded-lg px-4 py-3 text-sm flex items-start gap-3 ${className}`}
    >
      <span aria-hidden className="text-lg leading-none shrink-0 mt-0.5">💡</span>
      <div className="flex-1 min-w-0 leading-relaxed">{children}</div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Tip sluiten"
        className="shrink-0 -mr-1 -mt-1 w-7 h-7 rounded-full hover:bg-amber-100 inline-flex items-center justify-center text-amber-700 text-base font-bold transition"
      >
        ✕
      </button>
    </div>
  );
}
