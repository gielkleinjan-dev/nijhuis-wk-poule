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
      {/* Regel 1: thuis | score/vs | uit — altijd eigen rij, volledige breedte */}
      <div className="flex items-center gap-1">
        <div className="flex items-center justify-start gap-1.5 flex-1 min-w-0">
          <span className="font-semibold text-sm truncate text-left">{homeName}</span>
          <span className="flag-emoji text-lg leading-none shrink-0" aria-hidden>{flagEmoji(homeCode)}</span>
        </div>
        <div className="shrink-0 text-center w-10 sm:w-14">
          {finished ? (
            <span className="font-bold tabular-nums text-pitch">{actualHomeScore}–{actualAwayScore}</span>
          ) : (
            <span className="text-muted text-sm">vs</span>
          )}
        </div>
        <div className="flex items-center justify-end gap-1.5 flex-1 min-w-0">
          <span className="flag-emoji text-lg leading-none shrink-0" aria-hidden>{flagEmoji(awayCode)}</span>
          <span className="font-semibold text-sm truncate text-right">{awayName}</span>
        </div>
      </div>

      {/* Regel 2: datum links · knop rechts */}
      <div className="flex items-center justify-between gap-2 mt-2">
        <div className="text-xs text-muted flex items-center gap-1.5">
          {isLive && (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-red-600 font-semibold uppercase tracking-wide">Live ·</span>
            </>
          )}
          <span className="uppercase tracking-wide">{fmtDate(kickoffAt)}</span>
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition ${
            open
              ? "bg-brand text-white border-brand"
              : "bg-surface border-border text-muted hover:border-brand hover:text-brand"
          }`}
        >
          <span>👥</span>
          <span>{rows.length} collega's</span>
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
