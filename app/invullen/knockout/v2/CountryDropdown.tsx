"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { flagEmoji } from "@/lib/flags";

type TeamLite = { code: string; name: string };

// Mini-dropdown voor het kiezen van een ander land. Toont een lijst met
// Twemoji-vlaggen en landennaam. Sluit bij click-outside of Escape.
// Popup wordt via React-portal naar document.body gerenderd, zodat hij
// niet door overflow-hidden van een ouder geclipped wordt.
export function CountryDropdown({
  teams,
  selectedCode,
  onPick,
  triggerClassName,
  triggerLabelClassName,
}: {
  teams: ReadonlyArray<TeamLite>;
  selectedCode: string | undefined;
  onPick: (code: string) => void;
  triggerClassName?: string;
  triggerLabelClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const r = triggerRef.current?.getBoundingClientRect();
      if (!r) return;
      const POPUP_W = 224;
      // Standaard onder, rechts-uitgelijnd op trigger
      let top = r.bottom + 4;
      let left = r.right - POPUP_W;
      // Niet onder viewport: flip naar boven
      const POPUP_MAX_H = 288;
      if (top + POPUP_MAX_H > window.innerHeight && r.top > POPUP_MAX_H) {
        top = r.top - POPUP_MAX_H - 4;
      }
      // Niet links uit beeld
      if (left < 8) left = 8;
      setCoords({ top, left, width: POPUP_W });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      const target = e.target as Node;
      if (
        triggerRef.current && triggerRef.current.contains(target)
      ) return;
      if (
        popupRef.current && popupRef.current.contains(target)
      ) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const popup = (
    <div
      ref={popupRef}
      role="listbox"
      className="fixed z-50 bg-surface border border-border rounded-md shadow-lg max-h-72 overflow-y-auto py-1"
      style={coords ? { top: coords.top, left: coords.left, width: coords.width } : { visibility: "hidden" }}
    >
      {teams.map((t) => {
        const isSelected = t.code === selectedCode;
        return (
          <button
            key={t.code}
            type="button"
            role="option"
            aria-selected={isSelected}
            onClick={() => {
              onPick(t.code);
              setOpen(false);
            }}
            className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-bg/60 ${
              isSelected ? "bg-pitch-soft text-pitch font-semibold" : "text-fg"
            }`}
          >
            <span className="text-base leading-none shrink-0" aria-hidden>{flagEmoji(t.code)}</span>
            <span className="truncate flex-1">{t.name}</span>
            {isSelected && <span className="text-xs shrink-0">✓</span>}
          </button>
        );
      })}
    </div>
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={triggerClassName ?? "flex items-center justify-center px-3 cursor-pointer border-l border-border hover:bg-bg/60 h-full"}
      >
        <span className={triggerLabelClassName ?? "text-xs leading-none text-muted"}>▾</span>
      </button>
      {open && mounted && createPortal(popup, document.body)}
    </>
  );
}
