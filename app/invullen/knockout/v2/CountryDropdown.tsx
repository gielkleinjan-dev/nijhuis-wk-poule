"use client";

import { useEffect, useRef, useState } from "react";
import { flagEmoji } from "@/lib/flags";

type TeamLite = { code: string; name: string };

// Mini-dropdown voor het kiezen van een ander land. Toont een lijst met
// Twemoji-vlaggen en landennaam. Sluit bij click-outside of Escape.
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
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
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

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={triggerClassName ?? "flex items-center justify-center px-1.5 cursor-pointer border-l border-border hover:bg-bg/60 h-full"}
      >
        <span className={triggerLabelClassName ?? "text-xs leading-none text-muted"}>▾</span>
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 top-full mt-1 z-30 bg-surface border border-border rounded-md shadow-lg max-h-72 w-56 overflow-y-auto py-1"
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
                  isSelected ? "bg-brand-soft text-brand font-semibold" : "text-fg"
                }`}
              >
                <span className="text-base leading-none shrink-0" aria-hidden>{flagEmoji(t.code)}</span>
                <span className="truncate flex-1">{t.name}</span>
                {isSelected && <span className="text-xs shrink-0">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
