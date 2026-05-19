// Kerntypes voor de 3-fasen knock-out flow (bracket V2).
//
// Concepten:
// - GroupCode: WK 2026 heeft 12 groepen, A..L.
// - SeedSlot: een 'positie' in de bracket vóór de groepsfase klaar is. Bijvoorbeeld
//   "1A" = winnaar van groep A, "2B" = tweede van B, "3F" = derde van F. Een
//   SeedSlot zegt nog niets over een concreet land — pas zodra de gebruiker zijn
//   fase A+B keuzes heeft gemaakt, weten we welk team in welke SeedSlot zit.
// - MatchId: een vaste positie in de bracket-graaf. R32-1..R32-16 voor de 1/16e
//   finale, R16-1..R16-8 voor de 1/8e, QF-1..QF-4, SF-1/SF-2, F-1. Mapping naar
//   FIFA's match-numbers (M73..M104) in bracket-graph.ts.
// - ThirdsKey: een sorted-concat van de 8 group-letters die volgens de FIFA-regels
//   een nr3 leveren. Bijvoorbeeld "EFGHIJKL". 12-choose-8 = 495 mogelijke keys.
// - ThirdsRouting: per van die 8 groepen → welke R32-match + side de nr3 inneemt,
//   conform de officiële FIFA-routing (Annex C van de regulations).

export type GroupCode =
  | "A" | "B" | "C" | "D" | "E" | "F"
  | "G" | "H" | "I" | "J" | "K" | "L";

export const GROUP_CODES: readonly GroupCode[] = [
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L",
] as const;

export type Rank = 1 | 2 | 3;

export type SeedSlot = `${Rank}${GroupCode}`; // "1A", "2B", "3F", etc.

// Vaste positie in de bracket. Numbers zijn 1-based.
export type MatchId =
  | `R32-${number}` // R32-1..R32-16
  | `R16-${number}` // R16-1..R16-8
  | `QF-${number}`  // QF-1..QF-4
  | `SF-1` | `SF-2`
  | "F-1";

export type Round =
  | "LAST_32"
  | "LAST_16"
  | "QUARTER_FINALS"
  | "SEMI_FINALS"
  | "FINAL";

// 8 group-letters in alfabetische volgorde concat → "EFGHIJKL" etc. 12-choose-8 = 495 keys.
export type ThirdsKey = string;

// Voor elke groep G die een nr3 levert: in welke R32-match staat die nr3 en aan
// welke kant. Voor groepen die geen nr3 leveren ontbreekt de entry.
export type ThirdsRouting = Partial<
  Record<GroupCode, { match: MatchId; side: "home" | "away" }>
>;

// Een R32-match in de statische bracket heeft een 'template' — de twee SeedSlots
// die de wedstrijd vullen. Sommige slots zijn vast (bv. "2A" = altijd runner-up
// van groep A), andere zijn een derde-plaats placeholder die door de FIFA-tabel
// wordt ingevuld op basis van welke 8 groepen een nr3 leveren.
export type R32Slot =
  | { kind: "fixed"; seed: SeedSlot }              // bv. "2A", "1E"
  | { kind: "third-placed"; from: ReadonlyArray<GroupCode> }; // bv. "Best 3rd of [A,B,C,D,F]"

export type MatchNode =
  | {
      id: MatchId;
      round: "LAST_32";
      home: R32Slot;
      away: R32Slot;
      child: MatchId;
      fifaMatchNo: number; // M73..M88
    }
  | {
      id: MatchId;
      round: "LAST_16" | "QUARTER_FINALS" | "SEMI_FINALS" | "FINAL";
      homeFromMatch: MatchId;
      awayFromMatch: MatchId;
      child?: MatchId; // 'F-1' heeft geen child
      fifaMatchNo: number; // M89..M104
    };

export type BracketGraph = Record<MatchId, MatchNode>;

// Helpers
export function roundOfMatch(id: MatchId): Round {
  if (id.startsWith("R32-")) return "LAST_32";
  if (id.startsWith("R16-")) return "LAST_16";
  if (id.startsWith("QF-")) return "QUARTER_FINALS";
  if (id.startsWith("SF-")) return "SEMI_FINALS";
  if (id === "F-1") return "FINAL";
  throw new Error(`Onbekende MatchId: ${id}`);
}

export function seedSlot(rank: Rank, group: GroupCode): SeedSlot {
  return `${rank}${group}` as SeedSlot;
}

export function parseSeedSlot(slot: SeedSlot): { rank: Rank; group: GroupCode } {
  const rank = Number(slot[0]) as Rank;
  const group = slot[1] as GroupCode;
  return { rank, group };
}

export function isGroupCode(c: string): c is GroupCode {
  return GROUP_CODES.includes(c as GroupCode);
}
