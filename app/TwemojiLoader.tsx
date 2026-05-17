"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Vervangt alle Unicode-emoji's (incl. vlaggen) door SVG-plaatjes via Twemoji.
// Reden: Windows rendert landenvlaggen niet uit de standaard emoji-font.
declare global {
  interface Window {
    twemoji?: { parse: (node: HTMLElement, opts?: object) => void };
  }
}

export default function TwemojiLoader() {
  const pathname = usePathname();

  useEffect(() => {
    function run() {
      if (typeof window === "undefined" || !window.twemoji) return;
      window.twemoji.parse(document.body, {
        folder: "svg",
        ext: ".svg",
        base: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/",
      });
    }

    if (window.twemoji) {
      run();
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-twemoji-loader="1"]',
    );
    if (existing) {
      existing.addEventListener("load", run, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/twemoji@14.0.2/dist/twemoji.min.js";
    script.async = true;
    script.dataset.twemojiLoader = "1";
    script.addEventListener("load", run, { once: true });
    document.head.appendChild(script);
  }, [pathname]);

  return null;
}
