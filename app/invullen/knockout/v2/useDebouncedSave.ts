"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SaveState = "idle" | "saving" | "saved" | "error";

// Debounced save-hook met per-key state. Roept `save(key, payload)` aan na
// `delayMs` rust. Houdt per key bij wat de laatste payload was, zodat snel
// achter elkaar wijzigen geen verloren updates oplevert.
export function useDebouncedSave<Payload>(
  save: (key: string, payload: Payload) => Promise<{ ok: boolean }>,
  delayMs = 600,
) {
  const [states, setStates] = useState<Record<string, SaveState>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const pending = useRef<Record<string, Payload>>({});

  useEffect(() => {
    return () => {
      for (const t of Object.values(timers.current)) clearTimeout(t);
    };
  }, []);

  const schedule = useCallback(
    (key: string, payload: Payload) => {
      pending.current[key] = payload;
      if (timers.current[key]) clearTimeout(timers.current[key]);
      timers.current[key] = setTimeout(async () => {
        const p = pending.current[key];
        setStates((s) => ({ ...s, [key]: "saving" }));
        const res = await save(key, p);
        setStates((s) => ({ ...s, [key]: res.ok ? "saved" : "error" }));
        if (res.ok) {
          setTimeout(() => {
            setStates((s) => (s[key] === "saved" ? { ...s, [key]: "idle" } : s));
          }, 1800);
        }
      }, delayMs);
    },
    [save, delayMs],
  );

  return { states, schedule };
}
