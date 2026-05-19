"use client";

import { flagEmoji } from "@/lib/flags";
import { GROUP_CODES, type GroupCode } from "@/lib/bracket/types";
import type { PhaseA } from "@/lib/bracket/cascade";

type TeamLite = { code: string; name: string };

export function PhaseAPicker({
  teamsByGroup,
  phaseA,
  isLocked,
  onSet,
}: {
  teamsByGroup: ReadonlyMap<GroupCode, TeamLite[]>;
  phaseA: PhaseA;
  isLocked: boolean;
  onSet: (group: GroupCode, rank: 1 | 2, teamCode: string | undefined) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3">
      {GROUP_CODES.map((g) => {
        const teams = teamsByGroup.get(g) ?? [];
        const entry = phaseA[g] ?? {};
        const rank1 = entry.rank1;
        const rank2 = entry.rank2;
        return (
          <div key={g} className="border border-border rounded-md p-3 bg-bg/30">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-bold text-sm">Poule {g}</h4>
              <span className="text-[10px] text-muted">
                {(rank1 ? 1 : 0) + (rank2 ? 1 : 0)}/2
              </span>
            </div>

            <RankRow
              label="1e plaats"
              rank={1}
              group={g}
              teams={teams}
              selected={rank1}
              otherSelected={rank2}
              isLocked={isLocked}
              onSet={onSet}
            />
            <div className="mt-2">
              <RankRow
                label="2e plaats"
                rank={2}
                group={g}
                teams={teams}
                selected={rank2}
                otherSelected={rank1}
                isLocked={isLocked}
                onSet={onSet}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RankRow({
  label, rank, group, teams, selected, otherSelected, isLocked, onSet,
}: {
  label: string;
  rank: 1 | 2;
  group: GroupCode;
  teams: TeamLite[];
  selected: string | undefined;
  otherSelected: string | undefined;
  isLocked: boolean;
  onSet: (group: GroupCode, rank: 1 | 2, teamCode: string | undefined) => void;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted mb-1">{label}</p>
      <div className="grid grid-cols-2 gap-1.5">
        {teams.map((t) => {
          const isSelected = selected === t.code;
          const blocked = !isSelected && otherSelected === t.code;
          return (
            <button
              key={t.code}
              type="button"
              disabled={isLocked || blocked}
              onClick={() => onSet(group, rank, isSelected ? undefined : t.code)}
              className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-xs border transition text-left ${
                isSelected
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
        })}
      </div>
    </div>
  );
}
