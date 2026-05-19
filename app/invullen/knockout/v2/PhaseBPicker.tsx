"use client";

import { flagEmoji } from "@/lib/flags";
import { GROUP_CODES, type GroupCode } from "@/lib/bracket/types";
import type { PhaseA } from "@/lib/bracket/cascade";

type TeamLite = { code: string; name: string };

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
  // Voor elke groep: de teams die NIET nr1 of nr2 zijn → kandidaten voor "beste nr3"
  const candidatesByGroup: Array<[GroupCode, TeamLite[]]> = GROUP_CODES.map((g) => {
    const teams = teamsByGroup.get(g) ?? [];
    const top2 = phaseA[g];
    const rest = teams.filter((t) => t.code !== top2?.rank1 && t.code !== top2?.rank2);
    return [g, rest];
  });

  const atMax = phaseB.size >= 8;

  return (
    <div className="p-3 space-y-3">
      <div className="text-xs text-muted">
        Selectie {phaseB.size}/8 · klik om een land toe te voegen of te verwijderen.
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {candidatesByGroup.map(([g, teams]) => (
          <div key={g} className="border border-border rounded-md p-2 bg-bg/30">
            <p className="text-[10px] uppercase tracking-wide text-muted mb-1.5 px-1">Poule {g}</p>
            <div className="grid grid-cols-1 gap-1.5">
              {teams.length === 0 ? (
                <div className="text-[11px] text-muted italic px-1">
                  Vul eerst nr 1 + 2 van deze poule
                </div>
              ) : (
                teams.map((t) => {
                  const selected = phaseB.has(t.code);
                  const blocked = !selected && atMax;
                  return (
                    <button
                      key={t.code}
                      type="button"
                      disabled={isLocked || blocked}
                      onClick={() => onToggle(t.code)}
                      className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-xs border transition text-left ${
                        selected
                          ? "bg-brand text-white border-brand font-semibold"
                          : blocked
                          ? "bg-bg border-border text-muted opacity-40 cursor-not-allowed"
                          : "bg-surface border-border hover:border-brand"
                      }`}
                    >
                      <span className="text-sm leading-none" aria-hidden>{flagEmoji(t.code)}</span>
                      <span className="truncate flex-1">{t.name}</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
