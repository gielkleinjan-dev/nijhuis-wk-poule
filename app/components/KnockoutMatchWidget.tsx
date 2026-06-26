"use client";

import { useMemo, useState } from "react";
import { flagEmoji } from "@/lib/flags";

export type KoPickRow = {
  userId: string;
  displayName: string;
  department: string | null;
  secondaryDepartment: string | null;
  pickedCode: string; // het land dat deze collega voorspelde door te gaan
  pickedName: string;
};

const fmtDate = (kickoff: string) =>
  new Intl.DateTimeFormat("nl-NL", {
    timeZone: "Europe/Amsterdam",
    weekday: "short", day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(kickoff));

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export default function KnockoutMatchWidget({
  roundLabel,
  homeName,
  homeCode,
  awayName,
  awayCode,
  kickoffAt,
  isLive,
  finished,
  advancerCode,
  rows,
}: {
  roundLabel: string;
  homeName: string | null;
  homeCode: string | null;
  awayName: string | null;
  awayCode: string | null;
  kickoffAt: string;
  isLive: boolean;
  finished: boolean;
  advancerCode: string | null;
  rows: KoPickRow[];
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Groepeer collega's op hun voorspelde doorgaande land, gesorteerd op populariteit.
  const groups = useMemo(() => {
    const q = norm(search.trim());
    const filtered = q ? rows.filter((r) => norm(r.displayName).includes(q)) : rows;
    const byCode = new Map<string, { code: string; name: string; members: KoPickRow[] }>();
    for (const r of filtered) {
      if (!byCode.has(r.pickedCode)) byCode.set(r.pickedCode, { code: r.pickedCode, name: r.pickedName, members: [] });
      byCode.get(r.pickedCode)!.members.push(r);
    }
    return Array.from(byCode.values()).sort((a, b) => {
      // Het doorgegane land bovenaan, dan op aantal, dan op naam.
      if (advancerCode) {
        if (a.code === advancerCode && b.code !== advancerCode) return -1;
        if (b.code === advancerCode && a.code !== advancerCode) return 1;
      }
      if (b.members.length !== a.members.length) return b.members.length - a.members.length;
      return a.name.localeCompare(b.name, "nl");
    });
  }, [rows, search, advancerCode]);

  const totalPicks = rows.length;

  const Side = ({ name, code, side }: { name: string | null; code: string | null; side: "home" | "away" }) => {
    const through = finished && advancerCode != null && code === advancerCode;
    const out = finished && advancerCode != null && code !== advancerCode && code != null;
    return (
      <div className={`flex items-center gap-1.5 flex-1 min-w-0 ${side === "away" ? "justify-end flex-row-reverse" : ""}`}>
        <span className="flag-emoji text-lg leading-none shrink-0" aria-hidden>{code ? flagEmoji(code) : "🏳️"}</span>
        <span className={`font-semibold text-sm truncate ${out ? "text-muted line-through" : through ? "text-pitch" : ""}`}>
          {name ?? "nog te bepalen"}
        </span>
        {through && <span className="shrink-0 text-pitch" title="Door">✓</span>}
      </div>
    );
  };

  return (
    <div>
      {/* Regel 1: thuis | status | uit */}
      <div className="flex items-center gap-1">
        <Side name={homeName} code={homeCode} side="home" />
        <div className="shrink-0 text-center w-12 sm:w-16">
          {finished ? (
            <span className="text-[11px] text-muted uppercase tracking-wide">door</span>
          ) : isLive ? (
            <span className="text-red-600 text-xs font-semibold">live</span>
          ) : (
            <span className="text-muted text-sm">vs</span>
          )}
        </div>
        <Side name={awayName} code={awayCode} side="away" />
      </div>

      {/* Regel 2: ronde + datum links · knop rechts */}
      <div className="flex items-center justify-between gap-2 mt-2">
        <div className="text-xs text-muted flex items-center gap-1.5 min-w-0">
          <span className="font-semibold uppercase tracking-wide shrink-0">{roundLabel}</span>
          <span className="opacity-60 shrink-0">·</span>
          <span className="uppercase tracking-wide truncate">{fmtDate(kickoffAt)}</span>
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition ${
            open ? "bg-brand text-white border-brand" : "bg-surface border-border text-muted hover:border-brand hover:text-brand"
          }`}
        >
          <span>👥</span>
          <span>{totalPicks} collega&apos;s</span>
          <span className="text-[11px] opacity-70">{open ? "▲" : "▼"}</span>
        </button>
      </div>

      {open && (
        <div className="mt-3 pt-3 border-t border-border space-y-3">
          <input
            type="search"
            placeholder="Zoek op naam…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
          />
          {groups.length === 0 ? (
            <p className="text-sm text-muted text-center py-2">Geen collega&apos;s gevonden.</p>
          ) : (
            <ul className="space-y-2">
              {groups.map((g) => {
                const isThrough = finished && g.code === advancerCode;
                return (
                  <li key={g.code} className={`rounded-lg border px-3 py-2 ${isThrough ? "border-pitch/40 bg-pitch/5" : "border-border bg-surface"}`}>
                    <div className="flex items-center gap-2">
                      <span className="flag-emoji text-base leading-none shrink-0" aria-hidden>{flagEmoji(g.code)}</span>
                      <span className="font-medium text-sm">{g.name}</span>
                      {isThrough && <span className="text-[10px] text-pitch font-semibold uppercase tracking-wide">door ✓</span>}
                      <span className="ml-auto text-xs text-muted tabular-nums">{g.members.length}×</span>
                    </div>
                    <div className="mt-1 text-xs text-muted leading-relaxed">
                      {g.members.map((m) => m.displayName).sort((a, b) => a.localeCompare(b, "nl")).join(" · ")}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
