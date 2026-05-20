"use client";

import { useMemo } from "react";
import { BRACKET_GRAPH, MATCH_IDS_BY_ROUND } from "@/lib/bracket/bracket-graph";
import { computeR32Slots, type PhaseA, type Bracket } from "@/lib/bracket/cascade";
import type { GroupCode, MatchId, Round } from "@/lib/bracket/types";
import { BracketMatch } from "./BracketMatch";

type TeamLite = { code: string; name: string };

const ROUND_META: Record<Round, { title: string; hint: string; points: number }> = {
  LAST_32: {
    title: "1/16e finale",
    hint: "De 32 geplaatste landen spelen 16 wedstrijden. Kies in elke wedstrijd de winnaar.",
    points: 4,
  },
  LAST_16: {
    title: "1/8e finale",
    hint: "De 16 overgebleven landen spelen 8 wedstrijden. Kies in elke wedstrijd de winnaar.",
    points: 7,
  },
  QUARTER_FINALS: {
    title: "Kwartfinale",
    hint: "Vier wedstrijden tussen de 8 landen die de 1/8e finale overleven. Kies de winnaars.",
    points: 12,
  },
  SEMI_FINALS: {
    title: "Halve finale",
    hint: "De 4 kwartfinalewinnaars spelen 2 wedstrijden. De winnaars staan in de finale.",
    points: 18,
  },
  FINAL: {
    title: "Finale",
    hint: "De winnaar van deze wedstrijd wordt wereldkampioen.",
    points: 28,
  },
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
    <div className="space-y-4">
      {ROUNDS_ORDER.map((round) => {
        const meta = ROUND_META[round];
        const ids = MATCH_IDS_BY_ROUND[round];
        const filled = ids.filter((id) => bracket[id]).length;
        return (
          <section key={round} className="bg-surface border border-border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-bg/50 gap-4">
              <div className="min-w-0">
                <h2 className="text-lg font-bold flex items-center gap-2 flex-wrap">
                  {meta.title}
                  <span className="bg-pitch-soft text-pitch text-xs font-semibold px-1.5 py-0.5 rounded">{meta.points} pt</span>
                </h2>
                <p className="text-xs text-muted mt-0.5">{meta.hint}</p>
              </div>
              <div className="text-right shrink-0">
                <div className="text-2xl font-bold tabular-nums">
                  {filled}<span className="text-base text-muted font-normal">/{ids.length}</span>
                </div>
                <div className="text-xs text-muted">ingevuld</div>
              </div>
            </div>
            <ul>
              {(() => {
                // Bereken per match home + away (cascade voor R32, parent-winnaars voor R16+).
                // Verzamel daarna alle landen die binnen deze ronde "in" de bracket staan
                // (home, away of winnaar). Een land mag maar in 1 wedstrijd per ronde voorkomen,
                // dus filter dat uit de dropdown van álle andere wedstrijden.
                type MatchSlots = { id: MatchId; node: typeof BRACKET_GRAPH[MatchId]; home?: string; away?: string };
                const matchSlots: MatchSlots[] = ids.map((id) => {
                  const node = BRACKET_GRAPH[id];
                  if (node.round === "LAST_32") {
                    const s = r32Slots[id];
                    return { id, node, home: s?.home, away: s?.away };
                  }
                  return { id, node, home: bracket[node.homeFromMatch], away: bracket[node.awayFromMatch] };
                });
                const takenByMatch = new Map<MatchId, Set<string>>();
                for (const ms of matchSlots) {
                  const set = new Set<string>();
                  if (ms.home) set.add(ms.home);
                  if (ms.away) set.add(ms.away);
                  const w = bracket[ms.id];
                  if (w) set.add(w);
                  takenByMatch.set(ms.id, set);
                }
                return matchSlots.map(({ id, node, home, away }) => {
                  // Dropdown-landen voor deze wedstrijd: alle teams MIN alles wat in
                  // andere wedstrijden van deze ronde is opgenomen. Eigen home/away/winner
                  // blijft uiteraard staan.
                  const own = takenByMatch.get(id) ?? new Set<string>();
                  const taken = new Set<string>();
                  for (const [mid, codes] of takenByMatch) {
                    if (mid === id) continue;
                    for (const c of codes) taken.add(c);
                  }
                  const allowedTeams = allTeams.filter((t) => own.has(t.code) || !taken.has(t.code));
                  return (
                    <BracketMatch
                      key={id}
                      matchId={id}
                      fifaMatchNo={node.fifaMatchNo}
                      homeCand={home}
                      awayCand={away}
                      kickoff={matchDatesByFifaNo.get(node.fifaMatchNo)}
                      winner={bracket[id]}
                      allTeams={allowedTeams}
                      isLocked={isLocked}
                      teamsByCode={teamsByCode}
                      onPick={(w) => onPick(id, w)}
                    />
                  );
                });
              })()}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
