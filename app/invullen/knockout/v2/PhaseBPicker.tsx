"use client";

import { flagEmoji } from "@/lib/flags";
import { GROUP_CODES, type GroupCode } from "@/lib/bracket/types";
import type { PhaseA } from "@/lib/bracket/cascade";

type TeamLite = { code: string; name: string };

// Phase B — "3e doorgaande" markering. Same click-UX als Phase A:
// per groep zie je dezelfde 4 landen. De rank-1 en rank-2 zijn disabled
// (al gekozen in stap 1). Klikken op een ander land → markeer als "3e".
// Per groep max 1 markering, totaal max 8 over alle groepen.
export function PhaseBPicker({
  teamsByGroup,
  phaseA,
  phaseB,
  isLocked,
  onToggle,
}: {
  teamsByGroup: ReadonlyMap<GroupCode, TeamLite[]>;
  phaseA: PhaseA;
  phaseB: ReadonlySet<string>;
  isLocked: boolean;
  onToggle: (teamCode: string) => void;
}) {
  const atMax = phaseB.size >= 8;

  return (
    <div className="p-3 space-y-3">
      <p className="text-xs text-muted px-1">
        Markeer in 8 poules het land dat als beste nummer 3 doorgaat. Tik op een land dat in stap 1 geen 1 of 2 was — het krijgt een
        <span className="font-semibold text-amber-600"> oranje badge</span>.
      </p>

      <div className="flex items-center justify-between px-1">
        <div className="text-sm font-semibold tabular-nums">Geselecteerd: {phaseB.size}/8</div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {GROUP_CODES.map((g) => {
          const teams = teamsByGroup.get(g) ?? [];
          const e = phaseA[g] ?? {};
          const top2Filled = !!(e.rank1 && e.rank2);
          return (
            <div key={g} className="border border-border rounded-md p-3 bg-bg/30">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-bold text-sm">Poule {g}</h4>
                {!top2Filled && (
                  <span className="text-[10px] text-yellow-700 bg-yellow-50 border border-yellow-300 rounded px-1.5 py-0.5">
                    vul eerst stap 1
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 gap-1.5">
                {teams.map((t) => {
                  const isTop2 = e.rank1 === t.code || e.rank2 === t.code;
                  const isMarked = phaseB.has(t.code);
                  const blocked = !isMarked && (atMax || isTop2);
                  return (
                    <button
                      key={t.code}
                      type="button"
                      disabled={isLocked || isTop2 || (atMax && !isMarked)}
                      onClick={() => onToggle(t.code)}
                      className={`flex items-center gap-2 px-2 py-2 rounded text-sm border transition text-left ${
                        isMarked
                          ? "bg-amber-500 text-white border-amber-500 font-semibold"
                          : isTop2
                          ? "bg-bg border-border text-muted opacity-40 line-through cursor-not-allowed"
                          : blocked
                          ? "bg-bg border-border text-muted opacity-40 cursor-not-allowed"
                          : "bg-surface border-border hover:border-amber-500"
                      }`}
                    >
                      {isMarked && (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-white/30 text-xs font-bold shrink-0">
                          3e
                        </span>
                      )}
                      <span className="text-base leading-none" aria-hidden>{flagEmoji(t.code)}</span>
                      <span className="truncate flex-1">{t.name}</span>
                      {isTop2 && (
                        <span className="text-[10px] text-muted shrink-0">
                          {e.rank1 === t.code ? "1e in stap 1" : "2e in stap 1"}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
