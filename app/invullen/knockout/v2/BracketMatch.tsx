"use client";

import { flagEmoji } from "@/lib/flags";
import type { MatchId } from "@/lib/bracket/types";

type TeamLite = { code: string; name: string };

export function BracketMatch({
  matchId,
  label,
  candidates, // 0..2 team-codes
  winner,     // selected winner
  isLocked,
  teamsByCode,
  onPick,
}: {
  matchId: MatchId;
  label: string;
  candidates: string[];
  winner: string | undefined;
  isLocked: boolean;
  teamsByCode: ReadonlyMap<string, TeamLite>;
  onPick: (winner: string | undefined) => void;
}) {
  const pickable = candidates.length === 2;

  return (
    <div className="bg-surface border border-border rounded-md p-2 flex flex-col gap-1">
      <div className="flex items-center justify-between text-[10px] text-muted px-1">
        <span className="font-mono">{matchId}</span>
        <span>{label}</span>
      </div>
      {!pickable ? (
        <div className="text-xs text-muted italic px-2 py-3 text-center">
          Vul eerst de vorige ronde in
        </div>
      ) : (
        candidates.map((code) => {
          const t = teamsByCode.get(code);
          const isWinner = winner === code;
          return (
            <button
              key={code}
              type="button"
              disabled={isLocked}
              onClick={() => onPick(isWinner ? undefined : code)}
              className={`flex items-center gap-2 px-2 py-1.5 rounded text-sm border transition text-left ${
                isWinner
                  ? "bg-brand text-white border-brand font-semibold"
                  : "bg-bg border-border hover:border-brand"
              } ${isLocked ? "cursor-not-allowed opacity-70" : ""}`}
            >
              <span className="text-base leading-none" aria-hidden>{flagEmoji(code)}</span>
              <span className="truncate flex-1">{t?.name ?? code}</span>
            </button>
          );
        })
      )}
    </div>
  );
}
