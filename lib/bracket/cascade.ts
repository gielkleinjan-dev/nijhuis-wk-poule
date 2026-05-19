// Smart-clear cascade logica voor de 3-fasen knock-out flow.
//
// Doel: na een wijziging in Fase A (nr1/nr2 per groep), Fase B (welke 8 nrs3
// doorgaan) of binnen Fase C zelf (winnaar van een match), de bracket-keuzes
// downstream valideren. Ongeldige keuzes wissen, geldige keuzes laten staan.
//
// Definitie "ongeldig": een match-keuze X is ongeldig als X niet (meer) een
// kandidaat is voor die match volgens de huidige cascade-state.
//
// Voor R32-matches: kandidaten zijn de 2 landen die volgens slot-definities
// (fixed seed of FIFA 3rd-place-routing) in die match staan.
// Voor R16+: kandidaten zijn de winnaars van de twee parent-matches volgens
// de gebruikers bracket-keuzes.

import { BRACKET_GRAPH, ALL_MATCH_IDS, MATCH_IDS_BY_ROUND, descendantMatches } from "./bracket-graph";
import { getThirdsRouting } from "./fifa-thirds-table";
import type { GroupCode, MatchId } from "./types";

export type PhaseA = Partial<Record<GroupCode, { rank1?: string; rank2?: string }>>;
export type PhaseB = ReadonlySet<string>;        // 8 team-codes
export type Bracket = Partial<Record<MatchId, string>>;
export type TeamGroupMap = ReadonlyMap<string, GroupCode>; // team-code → groep waarin team speelt

// Returnt voor elke R32-match welke 2 landen erin staan op basis van phaseA + phaseB.
// home/away kunnen undefined zijn als de gebruiker zijn keuzes nog niet compleet heeft.
export function computeR32Slots(
  phaseA: PhaseA,
  phaseB: PhaseB,
  teamGroupMap: TeamGroupMap,
): Partial<Record<MatchId, { home?: string; away?: string }>> {
  const result: Partial<Record<MatchId, { home?: string; away?: string }>> = {};

  // Stap 1: figure out welk 3rd-place team in welk slot komt — als phaseB
  // exact 8 teams heeft. Met minder dan 8 kunnen we (nog) geen FIFA-routing
  // berekenen.
  const phaseBGroups: GroupCode[] = [];
  const groupToTeam = new Map<GroupCode, string>();
  for (const team of phaseB) {
    const group = teamGroupMap.get(team);
    if (group) {
      phaseBGroups.push(group);
      groupToTeam.set(group, team);
    }
  }

  const fifaRouting = phaseBGroups.length === 8 && new Set(phaseBGroups).size === 8
    ? getThirdsRouting(phaseBGroups)
    : undefined;

  // Stap 2: per R32-match home + away invullen
  for (const matchId of MATCH_IDS_BY_ROUND.LAST_32) {
    const node = BRACKET_GRAPH[matchId];
    if (node.round !== "LAST_32") continue;

    const homeSlot = node.home;
    const awaySlot = node.away;
    const entry: { home?: string; away?: string } = {};

    if (homeSlot.kind === "fixed") {
      entry.home = teamFromSeed(homeSlot.seed, phaseA);
    } else if (fifaRouting) {
      // Vind welke groep deze slot vult
      for (const g of homeSlot.from) {
        const r = fifaRouting[g];
        if (r && r.match === matchId && r.side === "home") {
          entry.home = groupToTeam.get(g);
          break;
        }
      }
    }

    if (awaySlot.kind === "fixed") {
      entry.away = teamFromSeed(awaySlot.seed, phaseA);
    } else if (fifaRouting) {
      for (const g of awaySlot.from) {
        const r = fifaRouting[g];
        if (r && r.match === matchId && r.side === "away") {
          entry.away = groupToTeam.get(g);
          break;
        }
      }
    }

    result[matchId] = entry;
  }

  return result;
}

function teamFromSeed(seed: string, phaseA: PhaseA): string | undefined {
  const rank = Number(seed[0]) as 1 | 2;
  const group = seed[1] as GroupCode;
  return rank === 1 ? phaseA[group]?.rank1 : phaseA[group]?.rank2;
}

// Voor een specifieke match: welke landen kunnen erin staan? Voor R32 zijn dat
// home + away (uit computeR32Slots). Voor R16+ zijn dat de gebruiker's bracket-
// keuzes van de twee parent-matches.
export function getCandidatesForMatch(
  matchId: MatchId,
  r32Slots: Partial<Record<MatchId, { home?: string; away?: string }>>,
  bracket: Bracket,
): string[] {
  const node = BRACKET_GRAPH[matchId];
  if (node.round === "LAST_32") {
    const slot = r32Slots[matchId];
    const cands: string[] = [];
    if (slot?.home) cands.push(slot.home);
    if (slot?.away) cands.push(slot.away);
    return cands;
  }
  const cands: string[] = [];
  const homeWinner = bracket[node.homeFromMatch];
  const awayWinner = bracket[node.awayFromMatch];
  if (homeWinner) cands.push(homeWinner);
  if (awayWinner) cands.push(awayWinner);
  return cands;
}

// Loop top-down door de bracket; identificeer welke ingevulde matches een
// keuze hebben die niet (meer) een geldige kandidaat is. Geeft het lijstje
// in dezelfde traversal-volgorde (R32 → R16 → QF → SF → F) zodat downstream
// matches gewist worden zodra hun parent gewist is.
export function findInvalidMatches(
  bracket: Bracket,
  phaseA: PhaseA,
  phaseB: PhaseB,
  teamGroupMap: TeamGroupMap,
): MatchId[] {
  const r32Slots = computeR32Slots(phaseA, phaseB, teamGroupMap);
  const invalid: MatchId[] = [];

  // Effective bracket — wat de winnaar zou zijn na deze cascade
  const effective: Bracket = { ...bracket };

  for (const matchId of ALL_MATCH_IDS) {
    const choice = effective[matchId];
    if (choice == null) continue;

    const cands = getCandidatesForMatch(matchId, r32Slots, effective);
    if (!cands.includes(choice)) {
      invalid.push(matchId);
      effective[matchId] = undefined;
    }
  }

  return invalid;
}

// Wrapper: smart-clear na fase-A/B wijziging of na een bracket-match wijziging.
// Returns: nieuwe bracket-state + lijst gewiste matches (voor toast/feedback).
export function smartClear(
  bracket: Bracket,
  phaseA: PhaseA,
  phaseB: PhaseB,
  teamGroupMap: TeamGroupMap,
): { bracket: Bracket; cleared: MatchId[] } {
  const invalid = findInvalidMatches(bracket, phaseA, phaseB, teamGroupMap);
  const newBracket: Bracket = { ...bracket };
  for (const id of invalid) {
    delete newBracket[id];
  }
  return { bracket: newBracket, cleared: invalid };
}

// Smart-clear specifiek na een bracket-match wijziging in match X:
// alleen X's descendants kunnen ongeldig worden, niet X zelf (die wordt vervangen).
// Returns lijst gewiste descendant-matches.
export function smartClearAfterMatchChange(
  matchId: MatchId,
  newWinner: string | undefined,
  bracket: Bracket,
  phaseA: PhaseA,
  phaseB: PhaseB,
  teamGroupMap: TeamGroupMap,
): { bracket: Bracket; cleared: MatchId[] } {
  const updated: Bracket = { ...bracket };
  if (newWinner == null) {
    delete updated[matchId];
  } else {
    updated[matchId] = newWinner;
  }

  // Alleen descendants checken (niet bracket-breed)
  const r32Slots = computeR32Slots(phaseA, phaseB, teamGroupMap);
  const descs = descendantMatches(matchId);
  const cleared: MatchId[] = [];

  for (const d of descs) {
    const choice = updated[d];
    if (choice == null) continue;
    const cands = getCandidatesForMatch(d, r32Slots, updated);
    if (!cands.includes(choice)) {
      cleared.push(d);
      delete updated[d];
    }
  }

  return { bracket: updated, cleared };
}
