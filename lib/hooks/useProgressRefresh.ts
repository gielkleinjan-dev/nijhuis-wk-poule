"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

/**
 * Debounced re-fetcher van de layout-server-components. Roep `schedule()` aan
 * na elke succesvolle save in een formulier; na `delayMs` van inactiviteit
 * wordt `router.refresh()` aangeroepen, wat de layout (incl. de ProgressBar
 * met X/Y-counts) opnieuw rendert.
 *
 * router.refresh() in App Router behoudt client-state — de form-inputs en
 * focus blijven dus intact. Alleen de server-components (zoals ProgressBar
 * met SQL-queries) krijgen verse data.
 */
export function useProgressRefresh(delayMs = 1500) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const schedule = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      router.refresh();
    }, delayMs);
  }, [router, delayMs]);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return schedule;
}
