"use client";

import { useEffect, useRef, useState } from "react";
import { flagEmoji } from "@/lib/flags";
import { searchPlayers, type Player } from "@/lib/players";

export default function PlayerCombobox({
  value,
  disabled,
  onChange,
  name,
  placeholder = "Begin met typen…",
}: {
  value: string;
  disabled?: boolean;
  onChange?: (name: string) => void;
  // Als gezet: hidden input met deze naam → bruikbaar in <form action> server actions.
  name?: string;
  placeholder?: string;
}) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<Player[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    setQuery(q);
    const res = searchPlayers(q);
    setResults(res);
    setOpen(res.length > 0);
    setActiveIdx(-1);
    if (q === "") onChange?.("");
  }

  function select(p: Player) {
    setQuery(p.name);
    setResults([]);
    setOpen(false);
    onChange?.(p.name);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && activeIdx >= 0) {
      e.preventDefault();
      select(results[activeIdx]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  function handleBlur(e: React.FocusEvent) {
    if (!containerRef.current?.contains(e.relatedTarget as Node)) {
      setOpen(false);
      // Reset zichtbare tekst naar canonical waarde — voorkomt dat een halfje getikte
      // naam blijft staan terwijl de opgeslagen waarde iets anders is.
      if (query !== value) setQuery(value);
    }
  }

  return (
    <div ref={containerRef} className="relative" onBlur={handleBlur}>
      {name && <input type="hidden" name={name} value={value || ""} />}
      <input
        type="text"
        value={query}
        disabled={disabled}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (results.length > 0) setOpen(true);
        }}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full border border-border bg-surface rounded-md px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand disabled:opacity-50"
      />
      {open && (
        <ul className="absolute z-20 left-0 right-0 top-full mt-1 bg-surface border border-border rounded-md shadow-lg max-h-56 overflow-auto">
          {results.map((p, i) => (
            <li key={p.name}>
              <button
                type="button"
                tabIndex={0}
                onMouseDown={(e) => {
                  e.preventDefault();
                  select(p);
                }}
                className={`w-full text-left flex items-center gap-2 px-3 py-2 text-sm ${
                  i === activeIdx ? "bg-brand text-white" : "hover:bg-bg"
                }`}
              >
                <span className="text-base leading-none">{flagEmoji(p.tla)}</span>
                <span className="flex-1">{p.name}</span>
                <span className="text-[11px] text-muted font-mono shrink-0">{p.tla}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
