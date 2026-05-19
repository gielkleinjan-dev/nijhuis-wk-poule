"use client";

import { useMemo } from "react";
import { BRACKET_GRAPH, MATCH_IDS_BY_ROUND } from "@/lib/bracket/bracket-graph";
import { computeR32Slots, getCandidatesForMatch, type PhaseA, type Bracket } from "@/lib/bracket/cascade";
import type { GroupCode, MatchId, Round } from "@/lib/bracket/types";
import { BracketMatch } from "./BracketMatch";

type TeamLite = { code: string; name: string };

const ROUND_LABELS: Record<Round, { title: string; short: string; points: number }> = {
  LAST_32: { title: "1/16e finale", short: "1/16", points: 4 },
  LAST_16: { title: "1/8e finale", short: "1/8", points: 7 },
  QUARTER_FINALS: { title: "Kwartfinale", short: "KF", points: 12 },
  SEMI_FINALS: { title: "Halve finale", short: "HF", points: 18 },
  FINAL: { title: "Finale", short: "F", points: 28 },
};

const ROUNDS_ORDER: Round[] = ["LAST_32", "LAST_16", "QUARTER_FINALS", "SEMI_FINALS", "FINAL"];

export function BracketBuilder({
  phaseA, phaseB, bracket, isLocked,
  teamsByCode, teamGroupMap,
  onPick,
}: {
  phaseA: PhaseA;
  phaseB: ReadonlySet<string>;
  bracket: Bracket;
  isLocked: boolean;
  teamsByCode: ReadonlyMap<string, TeamLite>;
  teamGroupMap: ReadonlyMap<string, GroupCode>;
  onPick: (matchId: MatchId, winner: string | undefined) => void;
}) {
  const r32Slots = useMemo(
    () => computeR32Slots(phaseA, phaseB, teamGroupMap),
    [phaseA, phaseB, teamGroupMap],
  );

  return (
    <div className="space-y-6">
      {ROUNDS_ORDER.map((round) => {
        const meta = ROUND_LABELS[round];
        const ids = MATCH_IDS_BY_ROUND[round];
        const filled = ids.filter((id) => bracket[id]).length;
        return (
          <section key={round} className="bg-surface border border-border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-bg/50">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm">{meta.title}</h3>
                <span className="bg-pitch-soft text-pitch text-[10px] font-semibold px-1.5 py-0.5 rounded">{meta.points} pt</span>
              </div>
              <div className="text-xs tabular-nums text-muted">
                {filled}/{ids.length}
              </div>
            </div>
            <div className="p-2 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {ids.map((id) => {
                const cands = getCandidatesForMatch(id, r32Slots, bracket).filter(Boolean);
                const node = BRACKET_GRAPH[id];
                const label = describeMatchSources(node);
                return (
                  <BracketMatch
                    key={id}
                    matchId={id}
                    label={label}
                    candidates={cands}
                    winner={bracket[id]}
                    isLocked={isLocked}
                    teamsByCode={teamsByCode}
                    onPick={(w) => onPick(id, w)}
                  />
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function describeMatchSources(node: (typeof BRACKET_GRAPH)[MatchId]): string {
  if (node.round === "LAST_32") {
    const h = node.home.kind === "fixed" ? node.home.seed : `3e (${node.home.from.join("/")})`;
    const a = node.away.kind === "fixed" ? node.away.seed : `3e (${node.away.from.join("/")})`;
    return `${h} vs ${a}`;
  }
  return `${node.homeFromMatch} vs ${node.awayFromMatch}`;
}
