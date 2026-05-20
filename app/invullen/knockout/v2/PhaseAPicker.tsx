"use client";

import { flagEmoji } from "@/lib/flags";
import { GROUP_CODES, type GroupCode } from "@/lib/bracket/types";
import type { PhaseA } from "@/lib/bracket/cascade";

type TeamLite = { code: string; name: string };

const RANK_BADGE: Record<1 | 2, { label: string; bg: string; text: string; border: string }> = {
  1: { label: "1e", bg: "bg-pitch", text: "text-white", border: "border-pitch" },
  2: { label: "2e", bg: "bg-pitch/70", text: "text-white", border: "border-pitch/70" },
};

export function PhaseAPicker({
  teamsByGroup,
  phaseA,
  isLocked,
  onSetRank,
  nextFreeRank,
}: {
  teamsByGroup: ReadonlyMap<GroupCode, TeamLite[]>;
  phaseA: PhaseA;
  isLocked: boolean;
  onSetRank: (group: GroupCode, rank: 1 | 2, teamCode: string | undefined) => void;
  nextFreeRank: (group: GroupCode) => 1 | 2 | null;
}) {
  function rankOf(group: GroupCode, code: string): 1 | 2 | null {
    const e = phaseA[group] ?? {};
    if (e.rank1 === code) return 1;
    if (e.rank2 === code) return 2;
    return null;
  }

  function handleClick(group: GroupCode, code: string) {
    const cur = rankOf(group, code);
    if (cur != null) {
      onSetRank(group, cur, undefined);
      return;
    }
    const next = nextFreeRank(group);
    if (next == null) return;
    onSetRank(group, next, code);
  }

  return (
    <div className="p-3 space-y-3">
      <p className="text-xs text-muted px-1">
        Per poule: tik eerst je nummer 1 aan (<span className="font-semibold text-pitch">donkergroen</span>), daarna je nummer 2
        (<span className="font-semibold text-pitch/80">lichter groen</span>). Fout? Tik nogmaals op het land om te wissen.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {GROUP_CODES.map((g) => {
          const teams = teamsByGroup.get(g) ?? [];
          const e = phaseA[g] ?? {};
          const ranks = (e.rank1 ? 1 : 0) + (e.rank2 ? 1 : 0);
          return (
            <div key={g} className="border border-border rounded-md p-3 bg-bg/30">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-bold text-sm">Poule {g}</h4>
                <span className="text-[10px] tabular-nums text-muted">{ranks}/2</span>
              </div>
              <div className="grid grid-cols-1 gap-1.5">
                {teams.map((t) => {
                  const r = rankOf(g, t.code);
                  const badge = r ? RANK_BADGE[r] : null;
                  return (
                    <button
                      key={t.code}
                      type="button"
                      disabled={isLocked}
                      onClick={() => handleClick(g, t.code)}
                      className={`flex items-center gap-2 px-2 py-2 rounded text-sm border transition text-left ${
                        badge
                          ? `${badge.bg} ${badge.text} ${badge.border} font-semibold`
                          : "bg-surface border-border hover:border-pitch"
                      } ${isLocked ? "cursor-not-allowed opacity-70" : ""}`}
                    >
                      {badge && (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-white/30 text-xs font-bold shrink-0">
                          {badge.label}
                        </span>
                      )}
                      <span className="text-base leading-none" aria-hidden>{flagEmoji(t.code)}</span>
                      <span className="truncate flex-1">{t.name}</span>
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
