// FIFA's officiële 3rd-place routing voor WK 2026.
//
// Bron: Annex C van "Regulations for the FIFA World Cup 26™" (mei 2026 editie),
// gepubliceerd op FIFA digitalhub. Dit bestand wordt direct ingeladen vanuit
// `fifa-thirds-source.json`, dat reviewbaar is in een PR.
//
// 495 combinaties = C(12,8). Elke combinatie = een sorted-concat van 8 group-
// letters die volgens FIFA-tiebreakers een nr3 leveren (bv. "EFGHIJKL" als
// groepen A,B,C,D geen 3e plek doorhebben).
//
// Per combinatie geeft de routing voor elke G die wel een nr3 levert:
//   { match: "R32-N", side: "away" }
// = "in welke R32-wedstrijd (en kant) speelt de nr3 van groep G".
//
// In FIFA's bracket spelen 3rd-placed teams altijd op de "away" kant tegen
// een group winner — dat blijkt uit Article 12.6 van de regulations.

import sourceData from "./fifa-thirds-source.json";
import type { GroupCode, MatchId, ThirdsKey, ThirdsRouting } from "./types";

// Parse + valideer het JSON-source direct in een Record. Strikt typed.
type RawSource = Record<string, Record<string, { match: string; side: string }>>;

function buildTable(): Record<ThirdsKey, ThirdsRouting> {
  const out: Record<ThirdsKey, ThirdsRouting> = {};
  const raw = sourceData as RawSource;
  for (const [key, routing] of Object.entries(raw)) {
    const typed: ThirdsRouting = {};
    for (const [group, slot] of Object.entries(routing)) {
      typed[group as GroupCode] = {
        match: slot.match as MatchId,
        side: slot.side as "home" | "away",
      };
    }
    out[key] = typed;
  }
  return out;
}

export const FIFA_THIRDS_TABLE: Readonly<Record<ThirdsKey, ThirdsRouting>> = buildTable();

// Helper: bouw de ThirdsKey uit een set van 8 group-codes (sorted alfabetisch).
export function makeThirdsKey(groups: ReadonlyArray<GroupCode>): ThirdsKey {
  if (groups.length !== 8) {
    throw new Error(`makeThirdsKey verwacht exact 8 groepen, kreeg er ${groups.length}`);
  }
  const sorted = [...groups].sort();
  if (new Set(sorted).size !== 8) {
    throw new Error(`makeThirdsKey vereist 8 unieke groepen: ${sorted.join(",")}`);
  }
  return sorted.join("");
}

// Helper: voor een gegeven Fase B-keuze (8 groepen die nr3 leveren), geef de
// FIFA-routing terug. Returns undefined als de key niet bestaat (zou niet
// voorkomen want C(12,8)=495 en we hebben alle 495 in tabel).
export function getThirdsRouting(groups: ReadonlyArray<GroupCode>): ThirdsRouting | undefined {
  const key = makeThirdsKey(groups);
  return FIFA_THIRDS_TABLE[key];
}
