"use client";

import { useState } from "react";
import MatchPredictionsClient from "@/app/components/MatchPredictionsClient";
import { flagEmoji } from "@/lib/flags";

type Row = {
  userId: string;
  displayName: string;
  department: string | null;
  secondaryDepartment: string | null;
  homePred: number | null;
  awayPred: number | null;
  totoPick: string | null;
};

const fmtDate = (kickoff: string) =>
  new Intl.DateTimeFormat("nl-NL", {
    weekday: "short", day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(kickoff));

export default function ActiveMatchWidget({
  rows,
  actualHomeScore,
  actualAwayScore,
  homeName,
  homeCode,
  awayName,
  awayCode,
  kickoffAt,
  isLive,
}: {
  rows: Row[];
  actualHomeScore: number | null;
  actualAwayScore: number | null;
  homeName: string;
  homeCode: string;
  awayName: string;
  awayCode: string;
  kickoffAt: string;
  isLive: boolean;
}) {
  const [open, setOpen] = useState(false);
  const finished = actualHomeScore != null && actualAwayScore != null;

  return (
    <div>
      {/* Compacte één-regel header: datum · teams · knop */}
      <div className="flex items-center gap-2 sm:gap-3 flex-wrap">

        {/* Datum (+ optionele Live-indicator) */}
        <div className="flex items-center gap-1 text-xs text-muted shrink-0">
          {isLive ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-red-600 font-semibold uppercase tracking-wide">Live</span>
              <span className="text-muted">·</span>
            </>
          ) : null}
          <span className="uppercase tracking-wide">{fmtDate(kickoffAt)}</span>
        </div>

        {/* Teams */}
        <div className="flex items-center gap-1 sm:gap-1.5 font-semibold text-sm flex-1 min-w-0">
          <span className="flag-emoji text-base leading-none shrink-0" aria-hidden>{flagEmoji(homeCode)}</span>
          <span className="truncate">{homeName}</span>
          {finished ? (
            <span className="tabular-nums text-pitch font-bold mx-0.5 shrink-0">
              {actualHomeScore}–{actualAwayScore}
            </span>
          ) : (
            <span className="text-muted font-normal mx-0.5 shrink-0">vs</span>
          )}
          <span className="flag-emoji text-base leading-none shrink-0" aria-hidden>{flagEmoji(awayCode)}</span>
          <span className="truncate">{awayName}</span>
        </div>

        {/* Collega-toggle knop */}
        <button
          onClick={() => setOpen((v) => !v)}
          className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition ${
            open
              ? "bg-brand text-white border-brand"
              : "bg-surface border-border text-muted hover:border-brand hover:text-brand"
          }`}
        >
          <span>👥</span>
          <span>{rows.length}</span>
          <span className="text-[11px] opacity-70">{open ? "▲" : "▼"}</span>
        </button>
      </div>

      {/* Uitklap-panel */}
      {open && (
        <div className="mt-3 pt-3 border-t border-border">
          <MatchPredictionsClient
            rows={rows}
            actualHomeScore={actualHomeScore}
            actualAwayScore={actualAwayScore}
          />
        </div>
      )}
    </div>
  );
}
