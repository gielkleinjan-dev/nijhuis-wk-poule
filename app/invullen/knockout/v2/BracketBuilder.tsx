"use client";

import { useMemo } from "react";
import { BRACKET_GRAPH, MATCH_IDS_BY_ROUND } from "@/lib/bracket/bracket-graph";
import { computeR32Slots, type PhaseA, type Bracket } from "@/lib/bracket/cascade";
import type { GroupCode, MatchId, Round } from "@/lib/bracket/types";
import { BracketMatch } from "./BracketMatch";

type TeamLite = { code: string; name: string };

const ROUND_LABELS: Record<Round, { title: string; points: number }> = {
  LAST_32: { title: "1/16e finale", points: 4 },
  LAST_16: { title: "1/8e finale", points: 7 },
  QUARTER_FINALS: { title: "Kwartfinale", points: 12 },
  SEMI_FINALS: { title: "Halve finale", points: 18 },
  FINAL: { title: "Finale", points: 28 },
};

const ROUNDS_ORDER: Round[] = ["LAST_32", "LAST_16", "QUARTER_FINALS", "SEMI_FINALS", "FINAL"];

export function BracketBuilder({
  phaseA, phaseB, bracket, isLocked,
  teamsByCode, teamGroupMap, allTeams, matchDatesByFifaNo,
  onPick,
}: {
  phaseA: PhaseA;
  phaseB: ReadonlySet<string>;
  bracket: Bracket;
  isLocked: boolean;
  teamsByCode: ReadonlyMap<string, TeamLite>;
  teamGroupMap: ReadonlyMap<string, GroupCode>;
  allTeams: ReadonlyArray<TeamLite>;
  matchDatesByFifaNo: ReadonlyMap<number, Date>;
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
              <div className="text-xs tabular-nums text-muted">{filled}/{ids.length}</div>
            </div>
            <div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {ids.map((id) => {
                const node = BRACKET_GRAPH[id];
                let home: string | undefined;
                let away: string | undefined;
                if (node.round === "LAST_32") {
                  const s = r32Slots[id];
                  home = s?.home;
                  away = s?.away;
                } else {
                  home = bracket[node.homeFromMatch];
                  away = bracket[node.awayFromMatch];
                }
                return (
                  <BracketMatch
                    key={id}
                    matchId={id}
                    fifaMatchNo={node.fifaMatchNo}
                    homeCand={home}
                    awayCand={away}
                    kickoff={matchDatesByFifaNo.get(node.fifaMatchNo)}
                    winner={bracket[id]}
                    allTeams={allTeams}
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
