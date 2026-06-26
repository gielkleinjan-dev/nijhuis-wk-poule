import { describe, it, expect } from "vitest";
import {
  decodeBracketPicks,
  predictedOccupants,
  actualOccupants,
  scorePlacementPoints,
  scoreChampion,
  scoreKnockoutPlacement,
  type RawPick,
} from "./scoring-knockout";
import type { PhaseA, Bracket } from "./bracket/cascade";
import type { GroupCode, MatchId } from "./bracket/types";

const GROUPS: GroupCode[] = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];

// Volledige fase A: rank1 = "1{G}", rank2 = "2{G}" (bv. "1A", "2A").
function fullPhaseA(): PhaseA {
  const a: PhaseA = {};
  for (const g of GROUPS) a[g] = { rank1: `1${g}`, rank2: `2${g}` };
  return a;
}

// Fase B: nrs 3 uit groepen E..L (FIFA-key "EFGHIJKL"), teams "3E".."3L".
const PHASE_B_GROUPS: GroupCode[] = ["E", "F", "G", "H", "I", "J", "K", "L"];
function fullPhaseB(): Set<string> {
  return new Set(PHASE_B_GROUPS.map((g) => `3${g}`));
}

// team-code → groep: "1A"/"2A"/"3A" → A.
function teamGroupMap(): Map<string, GroupCode> {
  const m = new Map<string, GroupCode>();
  for (const g of GROUPS) {
    m.set(`1${g}`, g);
    m.set(`2${g}`, g);
    m.set(`3${g}`, g);
  }
  return m;
}

function occ(pairs: Array<[number, string | null, string | null]>) {
  const m = new Map<number, { home_team: string | null; away_team: string | null }>();
  for (const [fifa, home, away] of pairs) m.set(fifa, { home_team: home, away_team: away });
  return m;
}

describe("scorePlacementPoints — laatste 32", () => {
  const tgm = teamGroupMap();
  const predicted = predictedOccupants(fullPhaseA(), fullPhaseB(), {}, tgm);

  it("juiste plek levert vol (8) per kant", () => {
    // R32-1 (M73) = 2A v 2B volgens de bracket-graaf.
    const actual = actualOccupants(occ([[73, "2A", "2B"]]));
    const rows = scorePlacementPoints(predicted, actual);
    const r32_1 = rows.filter((r) => r.ref_id.startsWith("LAST_32:R32-1:"));
    expect(r32_1).toHaveLength(2);
    expect(r32_1.every((r) => r.points === 8)).toBe(true);
  });

  it("komt door maar verkeerde plek levert half (4)", () => {
    // Verwisselde kanten: beide landen komen door, maar staan op de andere kant.
    const actual = actualOccupants(occ([[73, "2B", "2A"]]));
    const rows = scorePlacementPoints(predicted, actual).filter((r) =>
      r.ref_id.startsWith("LAST_32:R32-1:"),
    );
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.points === 4)).toBe(true);
  });

  it("niet-voorspeld land levert 0", () => {
    const actual = actualOccupants(occ([[73, "ZZZ", "2B"]]));
    const rows = scorePlacementPoints(predicted, actual).filter((r) =>
      r.ref_id.startsWith("LAST_32:R32-1:"),
    );
    // alleen 2B (juiste plek) telt → 1 rij vol
    expect(rows).toHaveLength(1);
    expect(rows[0].points).toBe(8);
    expect(rows[0].ref_id).toBe("LAST_32:R32-1:away");
  });

  it("nog niet gevuld vakje levert geen punten", () => {
    const actual = actualOccupants(occ([[73, null, null]]));
    const rows = scorePlacementPoints(predicted, actual).filter((r) =>
      r.ref_id.startsWith("LAST_32:"),
    );
    expect(rows).toHaveLength(0);
  });

  it("3rd-placed routing telt mee (FIFA-key EFGHIJKL)", () => {
    // R32-2 (M74) = 1E v Best 3rd of [A,B,C,D,F]; met key EFGHIJKL levert groep F
    // de 3e plek in dit slot (away). Verwacht: 1E thuis + 3F uit, beide vol.
    const actual = actualOccupants(occ([[74, "1E", "3F"]]));
    const rows = scorePlacementPoints(predicted, actual).filter((r) =>
      r.ref_id.startsWith("LAST_32:R32-2:"),
    );
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.points === 8)).toBe(true);
  });
});

describe("scorePlacementPoints — achtste finale via voedende keuze", () => {
  const tgm = teamGroupMap();

  it("voorspelde winnaar van voedende R32 = voorspelde bezetter R16 → vol (14)", () => {
    // R16-2 (M90) wordt gevoed door R32-1 (home) en R32-3 (away).
    // Voorspel 2A wint R32-1 → voorspelde bezetter R16-2 home = 2A.
    const bracket: Bracket = { "R32-1": "2A" };
    const predicted = predictedOccupants(fullPhaseA(), fullPhaseB(), bracket, tgm);
    const actual = actualOccupants(occ([[90, "2A", null]]));
    const rows = scorePlacementPoints(predicted, actual).filter((r) =>
      r.ref_id === "LAST_16:R16-2:home",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].points).toBe(14);
  });
});

describe("scorePlacementPoints — finale (finalisten)", () => {
  const tgm = teamGroupMap();

  it("juiste finalist op de juiste kant levert vol (56)", () => {
    // F-1 (M104) wordt gevoed door SF-1 (home) en SF-2 (away).
    // Voorspel 1A wint SF-1 → voorspelde finalist op F-1 home = 1A.
    const bracket: Bracket = { "SF-1": "1A", "SF-2": "1B" };
    const predicted = predictedOccupants(fullPhaseA(), fullPhaseB(), bracket, tgm);
    const actual = actualOccupants(occ([[104, "1A", "1B"]]));
    const rows = scorePlacementPoints(predicted, actual).filter((r) => r.ref_id.startsWith("FINAL:F-1:"));
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.points === 56)).toBe(true);
  });
});

describe("scoreChampion — aparte kampioen-beloning (40)", () => {
  it("juiste kampioen levert 40", () => {
    const row = scoreChampion({ "F-1": "1A" } as Bracket, "1A");
    expect(row?.points).toBe(40);
    expect(row?.ref_id).toBe("FINAL:champion");
  });
  it("foute kampioen levert null", () => {
    expect(scoreChampion({ "F-1": "1A" } as Bracket, "1B")).toBeNull();
  });
  it("geen finale-uitslag levert null", () => {
    expect(scoreChampion({ "F-1": "1A" } as Bracket, null)).toBeNull();
  });
});

describe("decodeBracketPicks", () => {
  it("decodeert GROUP_TOP_2 slot-encoding correct", () => {
    const picks: RawPick[] = [
      { round: "GROUP_TOP_2", slot: 0, team_code: "1A" }, // rank1, groep A
      { round: "GROUP_TOP_2", slot: 12, team_code: "2A" }, // rank2, groep A
      { round: "GROUP_TOP_2", slot: 13, team_code: "2B" }, // rank2, groep B
      { round: "BEST_THIRDS", slot: 0, team_code: "3E" },
      { round: "LAST_32", slot: 1, team_code: "2A" },
      { round: "FINAL", slot: 1, team_code: "1A" },
    ];
    const { phaseA, phaseB, bracket } = decodeBracketPicks(picks);
    expect(phaseA.A?.rank1).toBe("1A");
    expect(phaseA.A?.rank2).toBe("2A");
    expect(phaseA.B?.rank2).toBe("2B");
    expect(phaseB.has("3E")).toBe(true);
    expect(bracket["R32-1" as MatchId]).toBe("2A");
    expect(bracket["F-1"]).toBe("1A");
  });
});

describe("scoreKnockoutPlacement — end-to-end", () => {
  it("combineert placement + kampioen", () => {
    const tgm = teamGroupMap();
    const picks: RawPick[] = [];
    // Volledige fase A
    for (let i = 0; i < GROUPS.length; i++) {
      picks.push({ round: "GROUP_TOP_2", slot: i, team_code: `1${GROUPS[i]}` });
      picks.push({ round: "GROUP_TOP_2", slot: 12 + i, team_code: `2${GROUPS[i]}` });
    }
    for (const g of PHASE_B_GROUPS) picks.push({ round: "BEST_THIRDS", slot: 0, team_code: `3${g}` });
    picks.push({ round: "FINAL", slot: 1, team_code: "1A" });

    const matches = occ([[73, "2A", "2B"]]); // R32-1 exact
    const rows = scoreKnockoutPlacement(picks, tgm, matches, "1A");
    const total = rows.reduce((s, r) => s + r.points, 0);
    // R32-1 home+away vol (8+8) + kampioen (40) = 56
    expect(total).toBe(56);
  });
});
