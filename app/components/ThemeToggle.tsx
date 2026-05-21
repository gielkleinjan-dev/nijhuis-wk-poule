"use client";

import { useEffect, useState } from "react";

type ThemeName = "nijhuis" | "scorito";

function readTheme(): ThemeName {
  if (typeof document === "undefined") return "nijhuis";
  const attr = document.documentElement.getAttribute("data-theme");
  return attr === "scorito" ? "scorito" : "nijhuis";
}

function writeTheme(t: ThemeName) {
  document.documentElement.setAttribute("data-theme", t);
  // 1 jaar persistent, path=/ zodat hij overal mee gaat, SameSite=Lax voor normale navigatie.
  document.cookie = `theme=${t}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`;
}

export default function ThemeToggle() {
  // Start met "nijhuis" zodat SSR-output en eerste client-render matchen;
  // useEffect hieronder synchroniseert direct met het echte data-theme.
  const [theme, setTheme] = useState<ThemeName>("nijhuis");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTheme(readTheme());
    setMounted(true);
  }, []);

  function toggle() {
    const next: ThemeName = theme === "nijhuis" ? "scorito" : "nijhuis";
    setTheme(next);
    writeTheme(next);
  }

  const isScorito = theme === "scorito";

  return (
    <button
      type="button"
      onClick={toggle}
      title={isScorito ? "Wissel naar Nijhuis-thema" : "Wissel naar Scorito-thema"}
      aria-label="Wissel thema"
      aria-pressed={isScorito}
      className="relative inline-flex items-center gap-1.5 h-8 px-2 rounded-full border border-border bg-surface text-muted hover:text-ink hover:border-ink/40 transition shrink-0"
      // Voorkom layout-shift voor mount: render dezelfde structuur, even disabled.
      disabled={!mounted}
    >
      <span
        aria-hidden
        className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[13px] leading-none transition ${
          isScorito ? "bg-transparent" : "bg-brand text-white"
        }`}
      >
        N
      </span>
      <span
        aria-hidden
        className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[13px] leading-none transition ${
          isScorito ? "bg-[#0073ff] text-white" : "bg-transparent"
        }`}
      >
        ⚽
      </span>
    </button>
  );
}
