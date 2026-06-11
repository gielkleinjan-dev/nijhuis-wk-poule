"use client";

import { useState } from "react";
import MatchPredictionsClient from "@/app/components/MatchPredictionsClient";

type Row = {
  userId: string;
  displayName: string;
  department: string | null;
  secondaryDepartment: string | null;
  homePred: number | null;
  awayPred: number | null;
  totoPick: string | null;
};

export default function ActiveMatchWidget({
  rows,
  actualHomeScore,
  actualAwayScore,
}: {
  rows: Row[];
  actualHomeScore: number | null;
  actualAwayScore: number | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border transition ${
          open
            ? "bg-brand text-white border-brand"
            : "bg-surface border-border text-muted hover:border-brand hover:text-brand"
        }`}
      >
        <span>👥</span>
        <span>
          {rows.length} collega-voorspellingen
        </span>
        <span className="text-[11px] opacity-70">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="mt-4">
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
