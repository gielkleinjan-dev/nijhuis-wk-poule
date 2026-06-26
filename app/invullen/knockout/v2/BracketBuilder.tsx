"use client";

import { useMemo } from "react";
import { BRACKET_GRAPH, MATCH_IDS_BY_ROUND } from "@/lib/bracket/bracket-graph";
import { computeR32Slots, type PhaseA, type Bracket } from "@/lib/bracket/cascade";
import type { GroupCode, MatchId, Round } from "@/lib/bracket/types";
import { BracketMatch } from "./BracketMatch";
import type { MatchOverrides, Side } from "./useBracketState";
import { type OccupantMap, PLACEMENT_FULL, PLACEMENT_HALF, CHAMPION_POINTS } from "@/lib/scoring-knockout";

type TeamLite = { code: string; name: string };

// Punten komen rechtstreeks uit de score-engine (PLACEMENT_FULL/HALF +
// CHAMPION_POINTS), zodat deze pagina niet kan afwijken van de ranglijst.
const ROUND_META: Record<Round, { title: string; hint: string }> = {
  LAST_32: { title: "1/16e finale", hint: "32 landen, 16 wedstrijden. Kies per wedstrijd de winnaar." },
  LAST_16: { title: "1/8e finale", hint: "16 landen, 8 wedstrijden. Kies per wedstrijd de winnaar." },
  QUARTER_FINALS: { title: "Kwartfinale", hint: "8 landen, 4 wedstrijden. Kies per wedstrijd de winnaar." },
  SEMI_FINALS: { title: "Halve finale", hint: "4 landen, 2 wedstrijden. De winnaars spelen de finale." },
  FINAL: { title: "Finale", hint: "Eén wedstrijd. De winnaar is wereldkampioen." },
};

const ROUNDS_ORDER: Round[] = ["LAST_32", "LAST_16", "QUARTER_FINALS", "SEMI_FINALS", "FINAL"];

export function BracketBuilder({
  phaseA, phaseB, bracket, overrides, isLocked,
  teamsByCode, teamGroupMap, allTeams, matchDatesByFifaNo,
  actualBySlot, ptsBySlot,
  onPick, onSetOverride,
}: {
  phaseA: PhaseA;
  phaseB: ReadonlySet<string>;
  bracket: Bracket;
  overrides: MatchOverrides;
  isLocked: boolean;
  teamsByCode: ReadonlyMap<string, TeamLite>;
  teamGroupMap: ReadonlyMap<string, GroupCode>;
  allTeams: ReadonlyArray<TeamLite>;
  matchDatesByFifaNo: ReadonlyMap<number, Date>;
  actualBySlot: OccupantMap;
  ptsBySlot: ReadonlyMap<string, number>;
  onPick: (matchId: MatchId, winner: string | undefined) => void;
  onSetOverride: (matchId: MatchId, side: Side, teamCode: string | null) => void;
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
        const full = PLACEMENT_FULL[round as keyof typeof PLACEMENT_FULL] ?? 0;
        const half = PLACEMENT_HALF[round as keyof typeof PLACEMENT_HALF] ?? 0;
        const isFinal = round === "FINAL";
        return (
          <section key={round} className="bg-surface border border-border rounded-lg overflow-hidden">
            <div className="px-5 py-3 border-b border-border bg-bg/50">
              <div className="flex items-baseline justify-between gap-3 mb-0.5">
                <h2 className="text-lg font-bold leading-tight">{meta.title}</h2>
                <div className="shrink-0 text-right leading-tight">
                  <div className="text-xl font-bold tabular-nums">
                    {filled}<span className="text-sm text-muted font-normal">/{ids.length}</span>
                  </div>
                  <div className="text-[10px] text-muted">ingevuld</div>
                </div>
              </div>
              <p className="text-xs text-muted">{meta.hint}</p>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                <span className="bg-pitch text-white text-[11px] font-semibold px-1.5 py-0.5 rounded">
                  {full} pt {isFinal ? "juiste finalist op juiste plek" : "juiste land op juiste plek"}
                </span>
                {half > 0 && (
                  <span className="bg-amber-100 text-amber-800 border border-amber-200 text-[11px] font-semibold px-1.5 py-0.5 rounded">
                    {half} pt {isFinal ? "juiste finalist op verkeerde plek" : "juiste land op verkeerde plek"}
                  </span>
                )}
                {isFinal && (
                  <span className="bg-pitch text-white text-[11px] font-semibold px-1.5 py-0.5 rounded">
                    {CHAMPION_POINTS} pt wereldkampioen
                  </span>
                )}
              </div>
            </div>
            <ul>
              {(() => {
                // Bereken per match home + away. Cascade voor R32, parent-winnaars
                // voor R16+. Override per side mag de cascade overschrijven:
                // homeShown = overrides[id]?.home ?? cascade.home; idem away.
                type MatchSlots = {
                  id: MatchId;
                  node: typeof BRACKET_GRAPH[MatchId];
                  homeShown?: string;
                  awayShown?: string;
                };
                const matchSlots: MatchSlots[] = ids.map((id) => {
                  const node = BRACKET_GRAPH[id];
                  let baseHome: string | undefined;
                  let baseAway: string | undefined;
                  if (node.round === "LAST_32") {
                    const s = r32Slots[id];
                    baseHome = s?.home;
                    baseAway = s?.away;
                  } else {
                    baseHome = bracket[node.homeFromMatch];
                    baseAway = bracket[node.awayFromMatch];
                  }
                  const ov = overrides[id];
                  return {
                    id,
                    node,
                    homeShown: ov?.home ?? baseHome,
                    awayShown: ov?.away ?? baseAway,
                  };
                });
                // Dedupe-set: landen die ergens in deze ronde "in" zitten
                const takenByMatch = new Map<MatchId, Set<string>>();
                for (const ms of matchSlots) {
                  const set = new Set<string>();
                  if (ms.homeShown) set.add(ms.homeShown);
                  if (ms.awayShown) set.add(ms.awayShown);
                  const w = bracket[ms.id];
                  if (w) set.add(w);
                  takenByMatch.set(ms.id, set);
                }
                return matchSlots.map(({ id, node, homeShown, awayShown }) => {
                  const own = takenByMatch.get(id) ?? new Set<string>();
                  const taken = new Set<string>();
                  for (const [mid, codes] of takenByMatch) {
                    if (mid === id) continue;
                    for (const c of codes) taken.add(c);
                  }
                  const allowedTeams = allTeams.filter((t) => own.has(t.code) || !taken.has(t.code));
                  let homeEmptyLabel = "Vul stap 1+2 in";
                  let awayEmptyLabel = "Vul stap 1+2 in";
                  if (node.round !== "LAST_32") {
                    const ph = BRACKET_GRAPH[node.homeFromMatch];
                    const pa = BRACKET_GRAPH[node.awayFromMatch];
                    homeEmptyLabel = `Winnaar W${ph.fifaMatchNo}`;
                    awayEmptyLabel = `Winnaar W${pa.fifaMatchNo}`;
                  }
                  const ov = overrides[id];
                  const actual = actualBySlot.get(id);
                  return (
                    <BracketMatch
                      key={id}
                      matchId={id}
                      fifaMatchNo={node.fifaMatchNo}
                      homeShown={homeShown}
                      awayShown={awayShown}
                      homeIsOverride={!!ov?.home}
                      awayIsOverride={!!ov?.away}
                      homeEmptyLabel={homeEmptyLabel}
                      awayEmptyLabel={awayEmptyLabel}
                      kickoff={matchDatesByFifaNo.get(node.fifaMatchNo)}
                      winner={bracket[id]}
                      homeActual={actual?.home}
                      awayActual={actual?.away}
                      homeActualPts={ptsBySlot.get(`${id}:home`) ?? 0}
                      awayActualPts={ptsBySlot.get(`${id}:away`) ?? 0}
                      roundFull={full}
                      allTeams={allowedTeams}
                      isLocked={isLocked}
                      teamsByCode={teamsByCode}
                      onPick={(w) => onPick(id, w)}
                      onSetOverride={(side, code) => onSetOverride(id, side, code)}
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
