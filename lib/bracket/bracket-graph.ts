// De officiële bracket-graaf van WK 2026 conform FIFA Article 12.5-12.11 en
// Annex C van de "Regulations for the FIFA World Cup 26™" (mei 2026, FIFA digitalhub).
//
// FIFA's match-nummers M73..M104 zijn 1-op-1 gemapt naar onze interne MatchIds:
//   M73-M88 → R32-1 .. R32-16
//   M89-M96 → R16-1 .. R16-8
//   M97-M100 → QF-1 .. QF-4
//   M101 → SF-1, M102 → SF-2
//   M104 → F-1
// (M103 is de strijd om 3e plaats — die zit niet in onze bracket.)
//
// Pairings volgen Article 12.5 woordelijk. Belangrijk: pairings zijn NIET
// sequentieel. Bijvoorbeeld R16-1 (M89) = winnaar R32-2 vs winnaar R32-5.

import type { BracketGraph, GroupCode, MatchId, MatchNode, R32Slot, Round } from "./types";

function r32(n: number): MatchId { return `R32-${n}` as MatchId; }
function r16(n: number): MatchId { return `R16-${n}` as MatchId; }
function qf(n: number): MatchId { return `QF-${n}` as MatchId; }

// De 16 R32-wedstrijden zoals beschreven in Article 12.6.
// Voor wedstrijden met een 3rd-placed deelnemer: home = vaste group winner,
// away = third-placed (FIFA-tabel bepaalt wie precies).
// Voor matches zonder 3rd-placed: home + away beide vast.
const R32_DEFINITIONS: Array<{
  matchId: MatchId;
  fifaMatchNo: number;
  home: R32Slot;
  away: R32Slot;
}> = [
  // R32-1 (M73): 2A v 2B
  { matchId: r32(1), fifaMatchNo: 73,
    home: { kind: "fixed", seed: "2A" },
    away: { kind: "fixed", seed: "2B" } },

  // R32-2 (M74): 1E v Best 3rd of A,B,C,D,F
  { matchId: r32(2), fifaMatchNo: 74,
    home: { kind: "fixed", seed: "1E" },
    away: { kind: "third-placed", from: ["A","B","C","D","F"] } },

  // R32-3 (M75): 1F v 2C
  { matchId: r32(3), fifaMatchNo: 75,
    home: { kind: "fixed", seed: "1F" },
    away: { kind: "fixed", seed: "2C" } },

  // R32-4 (M76): 1C v 2F
  { matchId: r32(4), fifaMatchNo: 76,
    home: { kind: "fixed", seed: "1C" },
    away: { kind: "fixed", seed: "2F" } },

  // R32-5 (M77): 1I v Best 3rd of C,D,F,G,H
  { matchId: r32(5), fifaMatchNo: 77,
    home: { kind: "fixed", seed: "1I" },
    away: { kind: "third-placed", from: ["C","D","F","G","H"] } },

  // R32-6 (M78): 2E v 2I
  { matchId: r32(6), fifaMatchNo: 78,
    home: { kind: "fixed", seed: "2E" },
    away: { kind: "fixed", seed: "2I" } },

  // R32-7 (M79): 1A v Best 3rd of C,E,F,H,I
  { matchId: r32(7), fifaMatchNo: 79,
    home: { kind: "fixed", seed: "1A" },
    away: { kind: "third-placed", from: ["C","E","F","H","I"] } },

  // R32-8 (M80): 1L v Best 3rd of E,H,I,J,K
  { matchId: r32(8), fifaMatchNo: 80,
    home: { kind: "fixed", seed: "1L" },
    away: { kind: "third-placed", from: ["E","H","I","J","K"] } },

  // R32-9 (M81): 1D v Best 3rd of B,E,F,I,J
  { matchId: r32(9), fifaMatchNo: 81,
    home: { kind: "fixed", seed: "1D" },
    away: { kind: "third-placed", from: ["B","E","F","I","J"] } },

  // R32-10 (M82): 1G v Best 3rd of A,E,H,I,J
  { matchId: r32(10), fifaMatchNo: 82,
    home: { kind: "fixed", seed: "1G" },
    away: { kind: "third-placed", from: ["A","E","H","I","J"] } },

  // R32-11 (M83): 2K v 2L
  { matchId: r32(11), fifaMatchNo: 83,
    home: { kind: "fixed", seed: "2K" },
    away: { kind: "fixed", seed: "2L" } },

  // R32-12 (M84): 1H v 2J
  { matchId: r32(12), fifaMatchNo: 84,
    home: { kind: "fixed", seed: "1H" },
    away: { kind: "fixed", seed: "2J" } },

  // R32-13 (M85): 1B v Best 3rd of E,F,G,I,J
  { matchId: r32(13), fifaMatchNo: 85,
    home: { kind: "fixed", seed: "1B" },
    away: { kind: "third-placed", from: ["E","F","G","I","J"] } },

  // R32-14 (M86): 1J v 2H
  { matchId: r32(14), fifaMatchNo: 86,
    home: { kind: "fixed", seed: "1J" },
    away: { kind: "fixed", seed: "2H" } },

  // R32-15 (M87): 1K v Best 3rd of D,E,I,J,L
  { matchId: r32(15), fifaMatchNo: 87,
    home: { kind: "fixed", seed: "1K" },
    away: { kind: "third-placed", from: ["D","E","I","J","L"] } },

  // R32-16 (M88): 2D v 2G
  { matchId: r32(16), fifaMatchNo: 88,
    home: { kind: "fixed", seed: "2D" },
    away: { kind: "fixed", seed: "2G" } },
];

// R16 pairings per Article 12.7:
//   M89 = W74 v W77  →  R16-1 = R32-2 + R32-5
//   M90 = W73 v W75  →  R16-2 = R32-1 + R32-3
//   M91 = W76 v W78  →  R16-3 = R32-4 + R32-6
//   M92 = W79 v W80  →  R16-4 = R32-7 + R32-8
//   M93 = W83 v W84  →  R16-5 = R32-11 + R32-12
//   M94 = W81 v W82  →  R16-6 = R32-9 + R32-10
//   M95 = W86 v W88  →  R16-7 = R32-14 + R32-16
//   M96 = W85 v W87  →  R16-8 = R32-13 + R32-15
const R16_PAIRINGS: Array<[number, number, number]> = [
  // [r16-N, home-r32, away-r32], fifaMatchNo = 88 + r16-N
  [1, 2, 5],
  [2, 1, 3],
  [3, 4, 6],
  [4, 7, 8],
  [5, 11, 12],
  [6, 9, 10],
  [7, 14, 16],
  [8, 13, 15],
];

// QF pairings per Article 12.8:
//   M97  = W89 v W90  →  QF-1 = R16-1 + R16-2
//   M98  = W93 v W94  →  QF-2 = R16-5 + R16-6
//   M99  = W91 v W92  →  QF-3 = R16-3 + R16-4
//   M100 = W95 v W96  →  QF-4 = R16-7 + R16-8
const QF_PAIRINGS: Array<[number, number, number]> = [
  [1, 1, 2],
  [2, 5, 6],
  [3, 3, 4],
  [4, 7, 8],
];

export function buildStaticBracketGraph(): BracketGraph {
  const graph: BracketGraph = {} as BracketGraph;

  // R32 — pre-derived, child = R16 die hem oppikt (later gevuld na R16-bouw)
  for (const def of R32_DEFINITIONS) {
    graph[def.matchId] = {
      id: def.matchId,
      round: "LAST_32",
      home: def.home,
      away: def.away,
      // child wordt onder gezet zodra we R16 hebben opgebouwd
      child: "F-1" as MatchId, // placeholder, overschreven
      fifaMatchNo: def.fifaMatchNo,
    };
  }

  // R16 — FIFA pairings
  for (const [n, homeR32, awayR32] of R16_PAIRINGS) {
    const id = r16(n);
    const fifaNo = 88 + n;
    graph[id] = {
      id,
      round: "LAST_16",
      homeFromMatch: r32(homeR32),
      awayFromMatch: r32(awayR32),
      child: qf(Math.ceil(n / 2)), // R16-1+R16-2 → QF-1, etc. (later corrigeren via QF-pairings)
      fifaMatchNo: fifaNo,
    };
    // Update child-pointer van R32 → R16
    const home = graph[r32(homeR32)];
    const away = graph[r32(awayR32)];
    if (home.round === "LAST_32") home.child = id;
    if (away.round === "LAST_32") away.child = id;
  }

  // QF — FIFA pairings; corrigeer eventueel onjuiste R16-child-pointers
  for (const [n, homeR16, awayR16] of QF_PAIRINGS) {
    const id = qf(n);
    const fifaNo = 96 + n;
    graph[id] = {
      id,
      round: "QUARTER_FINALS",
      homeFromMatch: r16(homeR16),
      awayFromMatch: r16(awayR16),
      child: (n <= 2 ? "SF-1" : "SF-2") as MatchId,
      fifaMatchNo: fifaNo,
    };
    // Update child van R16 → QF
    const home = graph[r16(homeR16)];
    const away = graph[r16(awayR16)];
    if (home.round === "LAST_16") home.child = id;
    if (away.round === "LAST_16") away.child = id;
  }

  // SF — M101 = QF-1+QF-2, M102 = QF-3+QF-4
  graph["SF-1"] = {
    id: "SF-1",
    round: "SEMI_FINALS",
    homeFromMatch: qf(1),
    awayFromMatch: qf(2),
    child: "F-1",
    fifaMatchNo: 101,
  };
  graph["SF-2"] = {
    id: "SF-2",
    round: "SEMI_FINALS",
    homeFromMatch: qf(3),
    awayFromMatch: qf(4),
    child: "F-1",
    fifaMatchNo: 102,
  };

  // F-1 — M104
  graph["F-1"] = {
    id: "F-1",
    round: "FINAL",
    homeFromMatch: "SF-1",
    awayFromMatch: "SF-2",
    fifaMatchNo: 104,
  };

  return graph;
}

// Singleton — graaf is statisch en immutable na build.
export const BRACKET_GRAPH: BracketGraph = buildStaticBracketGraph();

// Alle MatchIds in volgorde per ronde
export const ALL_MATCH_IDS: readonly MatchId[] = (() => {
  const ids: MatchId[] = [];
  for (let n = 1; n <= 16; n++) ids.push(r32(n));
  for (let n = 1; n <= 8; n++) ids.push(r16(n));
  for (let n = 1; n <= 4; n++) ids.push(qf(n));
  ids.push("SF-1", "SF-2", "F-1");
  return ids;
})();

export const MATCH_IDS_BY_ROUND: Readonly<Record<Round, readonly MatchId[]>> = {
  LAST_32: ALL_MATCH_IDS.filter((id) => id.startsWith("R32-")),
  LAST_16: ALL_MATCH_IDS.filter((id) => id.startsWith("R16-")),
  QUARTER_FINALS: ALL_MATCH_IDS.filter((id) => id.startsWith("QF-")),
  SEMI_FINALS: ["SF-1", "SF-2"],
  FINAL: ["F-1"],
};

// Helper: lijst van descendant-matches (alle nakomelingen tot en met F-1).
export function descendantMatches(id: MatchId): MatchId[] {
  const result: MatchId[] = [];
  let current = BRACKET_GRAPH[id];
  while (current && "child" in current && current.child) {
    if (current.id === current.child) break; // safety: voorkomt selfloop bij placeholders
    result.push(current.child);
    current = BRACKET_GRAPH[current.child];
  }
  return result;
}

// Helper: parent-matches voor cascade-validatie.
export function parentMatches(id: MatchId): [MatchId, MatchId] | null {
  const node = BRACKET_GRAPH[id];
  if (!node || node.round === "LAST_32") return null;
  return [node.homeFromMatch, node.awayFromMatch];
}

// Helper: voor een given R32-match en gegeven phase-A picks, geef de set van
// mogelijke landcodes die op de gegeven kant (home/away) kunnen staan. Voor
// "fixed" slots is dat altijd één land; voor "third-placed" slots is het 0..1
// landen afhankelijk van of de gebruiker's fase B die specifieke 3rd-place
// heeft gekozen.
export function getR32SlotTeams(
  slot: R32Slot,
  phaseA: Record<GroupCode, { rank1?: string; rank2?: string }>,
  thirdPlacedTeams: Map<GroupCode, string>, // afgeleid: welke groep levert welk land voor 3rd
): string[] {
  if (slot.kind === "fixed") {
    const { rank, group } = parseSeed(slot.seed);
    const teamCode = rank === 1 ? phaseA[group]?.rank1 : phaseA[group]?.rank2;
    return teamCode ? [teamCode] : [];
  }
  // third-placed: de groep die volgens FIFA-tabel deze slot vult.
  // Wordt in cascade.ts gegeven via thirdPlacedTeams — hier alleen genereren we
  // de set van mogelijke groepen.
  const possible: string[] = [];
  for (const g of slot.from) {
    const team = thirdPlacedTeams.get(g);
    if (team) possible.push(team);
  }
  return possible;
}

function parseSeed(seed: string): { rank: 1 | 2; group: GroupCode } {
  return {
    rank: Number(seed[0]) as 1 | 2,
    group: seed[1] as GroupCode,
  };
}
