import { describe, it, expect } from "vitest";
import {
  computeR32Slots,
  getCandidatesForMatch,
  findInvalidMatches,
  smartClear,
  smartClearAfterMatchChange,
  type PhaseA,
  type Bracket,
} from "./cascade";
import type { GroupCode } from "./types";

// Test-helper: bouwt een complete fase-A waar elke groep rank1 = "1{G}", rank2 = "2{G}"
function buildFullPhaseA(): PhaseA {
  const a: PhaseA = {};
  const groups: GroupCode[] = ["A","B","C","D","E","F","G","H","I","J","K","L"];
  for (const g of groups) {
    a[g] = { rank1: `T1${g}`, rank2: `T2${g}` };
  }
  return a;
}

// Test-helper: 8 nrs3 uit groepen E..L (key "EFGHIJKL", optie 1 uit Annex C)
function buildFullPhaseB(): { phaseB: Set<string>; teamGroupMap: Map<string, GroupCode> } {
  const groups: GroupCode[] = ["E","F","G","H","I","J","K","L"];
  const teams = groups.map((g) => `T3${g}`);
  const phaseB = new Set(teams);
  const teamGroupMap = new Map<string, GroupCode>();
  // Map ook de fase-A teams in voor compleetheid
  for (const g of ["A","B","C","D","E","F","G","H","I","J","K","L"] as GroupCode[]) {
    teamGroupMap.set(`T1${g}`, g);
    teamGroupMap.set(`T2${g}`, g);
    teamGroupMap.set(`T3${g}`, g);
  }
  return { phaseB, teamGroupMap };
}

describe("computeR32Slots — volledige fase A + B", () => {
  it("R32-1 (M73: 2A v 2B) wordt gevuld met fase-A picks", () => {
    const phaseA = buildFullPhaseA();
    const { phaseB, teamGroupMap } = buildFullPhaseB();
    const slots = computeR32Slots(phaseA, phaseB, teamGroupMap);
    expect(slots["R32-1"]).toEqual({ home: "T2A", away: "T2B" });
  });

  it("R32-2 (M74: 1E v Best 3rd of ABCDF) — voor combinatie EFGHIJKL is 3F daar", () => {
    // FIFA optie 1: groepen E..L leveren nr3, dus 3F gaat naar 1E (R32-2 away)
    const phaseA = buildFullPhaseA();
    const { phaseB, teamGroupMap } = buildFullPhaseB();
    const slots = computeR32Slots(phaseA, phaseB, teamGroupMap);
    expect(slots["R32-2"]).toEqual({ home: "T1E", away: "T3F" });
  });

  it("R32-7 (M79: 1A v Best 3rd of CEFHI) — voor EFGHIJKL is 3E daar", () => {
    const phaseA = buildFullPhaseA();
    const { phaseB, teamGroupMap } = buildFullPhaseB();
    const slots = computeR32Slots(phaseA, phaseB, teamGroupMap);
    expect(slots["R32-7"]).toEqual({ home: "T1A", away: "T3E" });
  });
});

describe("computeR32Slots — incomplete fasen", () => {
  it("Lege fase A: home/away leeg voor fixed slots", () => {
    const phaseA: PhaseA = {};
    const phaseB = new Set<string>();
    const teamGroupMap = new Map<string, GroupCode>();
    const slots = computeR32Slots(phaseA, phaseB, teamGroupMap);
    expect(slots["R32-1"]).toEqual({});
  });

  it("Fase B met <8 teams: 3rd-placed slots blijven leeg", () => {
    const phaseA = buildFullPhaseA();
    const phaseB = new Set(["T3E", "T3F", "T3G"]); // maar 3 teams
    const tgm = new Map<string, GroupCode>([["T3E","E"],["T3F","F"],["T3G","G"]]);
    const slots = computeR32Slots(phaseA, phaseB, tgm);
    // R32-1 (fixed) wel gevuld
    expect(slots["R32-1"]).toEqual({ home: "T2A", away: "T2B" });
    // R32-2 (3rd-placed away) leeg
    expect(slots["R32-2"]?.away).toBeUndefined();
  });
});

describe("getCandidatesForMatch", () => {
  it("R32-match: home + away beide kandidaat", () => {
    const phaseA = buildFullPhaseA();
    const { phaseB, teamGroupMap } = buildFullPhaseB();
    const slots = computeR32Slots(phaseA, phaseB, teamGroupMap);
    const cands = getCandidatesForMatch("R32-1", slots, {});
    expect(cands.sort()).toEqual(["T2A", "T2B"]);
  });

  it("R16-match: alleen winnaars van parent R32-matches", () => {
    const phaseA = buildFullPhaseA();
    const { phaseB, teamGroupMap } = buildFullPhaseB();
    const slots = computeR32Slots(phaseA, phaseB, teamGroupMap);
    // R16-1 = R32-2 + R32-5. Stel gebruiker kiest winnaars
    const bracket: Bracket = { "R32-2": "T1E", "R32-5": "T1I" };
    const cands = getCandidatesForMatch("R16-1", slots, bracket);
    expect(cands.sort()).toEqual(["T1E", "T1I"]);
  });

  it("Match zonder parent-keuzes: lege kandidaten", () => {
    const slots = computeR32Slots({}, new Set(), new Map());
    const cands = getCandidatesForMatch("R16-1", slots, {});
    expect(cands).toEqual([]);
  });
});

describe("findInvalidMatches", () => {
  it("Lege bracket → geen ongeldige matches", () => {
    const phaseA = buildFullPhaseA();
    const { phaseB, teamGroupMap } = buildFullPhaseB();
    const invalid = findInvalidMatches({}, phaseA, phaseB, teamGroupMap);
    expect(invalid).toEqual([]);
  });

  it("Geldige bracket → geen ongeldige", () => {
    const phaseA = buildFullPhaseA();
    const { phaseB, teamGroupMap } = buildFullPhaseB();
    // R32-1 winnaar = T2A, geldig
    const bracket: Bracket = { "R32-1": "T2A" };
    const invalid = findInvalidMatches(bracket, phaseA, phaseB, teamGroupMap);
    expect(invalid).toEqual([]);
  });

  it("R32-keuze die niet voorkomt in slot is invalid", () => {
    const phaseA = buildFullPhaseA();
    const { phaseB, teamGroupMap } = buildFullPhaseB();
    const bracket: Bracket = { "R32-1": "T1F" }; // T1F zit niet in R32-1
    const invalid = findInvalidMatches(bracket, phaseA, phaseB, teamGroupMap);
    expect(invalid).toEqual(["R32-1"]);
  });

  it("Cascade: invalid R32 → ongeldige R16 keuze ook gevangen", () => {
    const phaseA = buildFullPhaseA();
    const { phaseB, teamGroupMap } = buildFullPhaseB();
    // R32-2 winnaar = T1E (geldig), R32-5 winnaar = T3G (geldig — 3G zit in R32-5 voor EFGHIJKL)
    // R16-1 (= R32-2 + R32-5) winnaar = T1E (geldig)
    // Maar als we de R32-2 keuze wijzigen naar iets ongeldigs, wordt R16-1 ook invalid
    const bracket: Bracket = {
      "R32-2": "T1X" as string, // niet bestaand team, dus invalid
      "R16-1": "T1X",
    };
    const invalid = findInvalidMatches(bracket, phaseA, phaseB, teamGroupMap);
    expect(invalid).toContain("R32-2");
    expect(invalid).toContain("R16-1");
  });
});

describe("smartClear — wissen + nieuwe state", () => {
  it("Wijziging fase A wist R32-keuze die niet meer geldig is", () => {
    const phaseA = buildFullPhaseA();
    const { phaseB, teamGroupMap } = buildFullPhaseB();
    // Vóór: gebruiker kiest T2A in R32-1 (geldig)
    const bracket: Bracket = { "R32-1": "T2A" };
    // Wijziging fase A: rank2 van groep A wordt iets anders
    const newPhaseA: PhaseA = { ...phaseA, A: { rank1: "T1A", rank2: "NEW2A" } };
    const result = smartClear(bracket, newPhaseA, phaseB, teamGroupMap);
    expect(result.cleared).toEqual(["R32-1"]);
    expect(result.bracket["R32-1"]).toBeUndefined();
  });

  it("Wijziging fase A wist DOWNSTREAM R16/QF die afhankelijk waren", () => {
    const phaseA = buildFullPhaseA();
    const { phaseB, teamGroupMap } = buildFullPhaseB();
    // Volledige bracket-keten R32-1 → R16-2 → QF-1 met T2A als winnaar overal
    const bracket: Bracket = {
      "R32-1": "T2A",
      "R16-2": "T2A",
      "QF-1": "T2A",
    };
    // Wijzig fase A zodat T2A niet meer in R32-1 zit
    const newPhaseA: PhaseA = { ...phaseA, A: { rank1: "T1A", rank2: "OTHER" } };
    const result = smartClear(bracket, newPhaseA, phaseB, teamGroupMap);
    expect(result.cleared).toEqual(["R32-1", "R16-2", "QF-1"]);
    expect(result.bracket["R32-1"]).toBeUndefined();
    expect(result.bracket["R16-2"]).toBeUndefined();
    expect(result.bracket["QF-1"]).toBeUndefined();
  });

  it("Ongerelateerde keuzes blijven staan na wijziging fase A", () => {
    const phaseA = buildFullPhaseA();
    const { phaseB, teamGroupMap } = buildFullPhaseB();
    // R32-1 winner T2A + R32-3 winner T1F (onafhankelijk takkenpaar)
    const bracket: Bracket = { "R32-1": "T2A", "R32-3": "T1F" };
    const newPhaseA: PhaseA = { ...phaseA, A: { rank1: "T1A", rank2: "X" } };
    const result = smartClear(bracket, newPhaseA, phaseB, teamGroupMap);
    expect(result.cleared).toEqual(["R32-1"]);
    expect(result.bracket["R32-3"]).toBe("T1F");
  });
});

describe("smartClearAfterMatchChange — bracket-niveau wijziging", () => {
  it("Wijziging in R32 wist downstream R16-keuze als die niet meer past", () => {
    const phaseA = buildFullPhaseA();
    const { phaseB, teamGroupMap } = buildFullPhaseB();
    // R16-1 = R32-2 + R32-5. Stel bracket = R32-2 T1E, R32-5 T1I, R16-1 T1E
    const bracket: Bracket = { "R32-2": "T1E", "R32-5": "T1I", "R16-1": "T1E" };
    // Wijzig R32-2 winnaar naar T3F (de andere kandidaat)
    const result = smartClearAfterMatchChange("R32-2", "T3F", bracket, phaseA, phaseB, teamGroupMap);
    expect(result.bracket["R32-2"]).toBe("T3F");
    // R16-1 had T1E als winnaar; T1E is nu geen kandidaat meer (R32-2 winner = T3F, R32-5 = T1I)
    expect(result.cleared).toContain("R16-1");
    expect(result.bracket["R16-1"]).toBeUndefined();
  });

  it("Wijziging in R32 die de R16-keuze nog steeds toestaat: niets gewist", () => {
    const phaseA = buildFullPhaseA();
    const { phaseB, teamGroupMap } = buildFullPhaseB();
    // R16-1 winner T1I (uit R32-5). Wijzig R32-2 winner van T1E naar T3F.
    // T1I komt nog steeds uit R32-5, dus R16-1 is nog geldig.
    const bracket: Bracket = { "R32-2": "T1E", "R32-5": "T1I", "R16-1": "T1I" };
    const result = smartClearAfterMatchChange("R32-2", "T3F", bracket, phaseA, phaseB, teamGroupMap);
    expect(result.cleared).toEqual([]);
    expect(result.bracket["R16-1"]).toBe("T1I");
  });

  it("Het wissen van een match (undefined) → cascade clears descendants met die winnaar", () => {
    const phaseA = buildFullPhaseA();
    const { phaseB, teamGroupMap } = buildFullPhaseB();
    const bracket: Bracket = { "R32-2": "T1E", "R32-5": "T1I", "R16-1": "T1E" };
    const result = smartClearAfterMatchChange("R32-2", undefined, bracket, phaseA, phaseB, teamGroupMap);
    expect(result.bracket["R32-2"]).toBeUndefined();
    expect(result.cleared).toContain("R16-1");
  });
});
