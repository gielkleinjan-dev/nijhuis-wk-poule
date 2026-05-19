import { describe, it, expect } from "vitest";
import { FIFA_THIRDS_TABLE, getThirdsRouting, makeThirdsKey } from "./fifa-thirds-table";
import type { GroupCode } from "./types";

const ALL_GROUPS: GroupCode[] = ["A","B","C","D","E","F","G","H","I","J","K","L"];

// Bereken alle C(12,8) = 495 combinaties van 8 uit 12 groepen
function allCombinations(): GroupCode[][] {
  const out: GroupCode[][] = [];
  const n = ALL_GROUPS.length;
  const k = 8;
  const idx = Array.from({ length: k }, (_, i) => i);
  while (true) {
    out.push(idx.map((i) => ALL_GROUPS[i]));
    let i = k - 1;
    while (i >= 0 && idx[i] === n - k + i) i--;
    if (i < 0) break;
    idx[i]++;
    for (let j = i + 1; j < k; j++) idx[j] = idx[j - 1] + 1;
  }
  return out;
}

describe("FIFA_THIRDS_TABLE — coverage", () => {
  it("bevat exact 495 entries (= C(12,8))", () => {
    expect(Object.keys(FIFA_THIRDS_TABLE).length).toBe(495);
  });

  it("elke C(12,8) combinatie heeft een entry", () => {
    const combos = allCombinations();
    expect(combos.length).toBe(495);
    const missing: string[] = [];
    for (const c of combos) {
      const key = makeThirdsKey(c);
      if (!FIFA_THIRDS_TABLE[key]) missing.push(key);
    }
    expect(missing).toEqual([]);
  });

  it("alle keys zijn 8 chars lang, sorted, unieke groep-letters", () => {
    for (const key of Object.keys(FIFA_THIRDS_TABLE)) {
      expect(key.length).toBe(8);
      const chars = key.split("");
      expect([...chars].sort().join("")).toBe(key); // sorted
      expect(new Set(chars).size).toBe(8); // unieke
      for (const c of chars) expect(ALL_GROUPS).toContain(c);
    }
  });
});

describe("FIFA_THIRDS_TABLE — structuur per entry", () => {
  it("elke entry heeft exact 8 routings", () => {
    for (const [key, routing] of Object.entries(FIFA_THIRDS_TABLE)) {
      expect(Object.keys(routing).length).toBe(8);
      // Routings dekken precies de groepen uit de key
      const routedGroups = Object.keys(routing).sort().join("");
      expect(routedGroups).toBe(key);
    }
  });

  it("elke routing wijst naar één van de 8 R32-matches met 3rd-placed slot", () => {
    // Per FIFA Article 12.6: 3rd-placed teams spelen in R32-2, 5, 7, 8, 9, 10, 13, 15.
    const validMatches = new Set([
      "R32-2", "R32-5", "R32-7", "R32-8", "R32-9", "R32-10", "R32-13", "R32-15",
    ]);
    for (const routing of Object.values(FIFA_THIRDS_TABLE)) {
      const targets = Object.values(routing).map((r) => r.match);
      for (const t of targets) expect(validMatches.has(t)).toBe(true);
      // Elke entry vult exact alle 8 third-placed slots (geen duplicates)
      expect(new Set(targets).size).toBe(8);
    }
  });

  it("elke routing heeft side='away' (3rd-placed staan altijd away)", () => {
    for (const routing of Object.values(FIFA_THIRDS_TABLE)) {
      for (const r of Object.values(routing)) {
        expect(r.side).toBe("away");
      }
    }
  });
});

describe("FIFA_THIRDS_TABLE — canonieke spot-check", () => {
  // Optie 1 uit Annex C: combinatie "EFGHIJKL"
  // Rij: "1 3E 3J 3I 3F 3H 3G 3L 3K"
  // Header: "1A 1B 1D 1E 1G 1I 1K 1L"
  // Mapping:
  //   1A vs 3E → R32-7
  //   1B vs 3J → R32-13
  //   1D vs 3I → R32-9
  //   1E vs 3F → R32-2
  //   1G vs 3H → R32-10
  //   1I vs 3G → R32-5
  //   1K vs 3L → R32-15
  //   1L vs 3K → R32-8
  it("optie 1 (EFGHIJKL): correcte routing per groep", () => {
    const routing = FIFA_THIRDS_TABLE["EFGHIJKL"];
    expect(routing).toBeTruthy();
    expect(routing.E).toEqual({ match: "R32-7",  side: "away" });
    expect(routing.J).toEqual({ match: "R32-13", side: "away" });
    expect(routing.I).toEqual({ match: "R32-9",  side: "away" });
    expect(routing.F).toEqual({ match: "R32-2",  side: "away" });
    expect(routing.H).toEqual({ match: "R32-10", side: "away" });
    expect(routing.G).toEqual({ match: "R32-5",  side: "away" });
    expect(routing.L).toEqual({ match: "R32-15", side: "away" });
    expect(routing.K).toEqual({ match: "R32-8",  side: "away" });
  });

  // Laatste optie 495: combinatie "ABCDEFGH" (geen IJKL als nr3)
  // Wait — option 495 row: "495 3H 3G 3B 3C 3A 3F 3D 3E"
  // Sorted chars: ABCDEFGH → key = "ABCDEFGH"
  // Mapping:
  //   1A vs 3H → R32-7
  //   1B vs 3G → R32-13
  //   1D vs 3B → R32-9
  //   1E vs 3C → R32-2
  //   1G vs 3A → R32-10
  //   1I vs 3F → R32-5
  //   1K vs 3D → R32-15
  //   1L vs 3E → R32-8
  it("optie 495 (ABCDEFGH): correcte routing", () => {
    const routing = FIFA_THIRDS_TABLE["ABCDEFGH"];
    expect(routing).toBeTruthy();
    expect(routing.H).toEqual({ match: "R32-7",  side: "away" });
    expect(routing.G).toEqual({ match: "R32-13", side: "away" });
    expect(routing.B).toEqual({ match: "R32-9",  side: "away" });
    expect(routing.C).toEqual({ match: "R32-2",  side: "away" });
    expect(routing.A).toEqual({ match: "R32-10", side: "away" });
    expect(routing.F).toEqual({ match: "R32-5",  side: "away" });
    expect(routing.D).toEqual({ match: "R32-15", side: "away" });
    expect(routing.E).toEqual({ match: "R32-8",  side: "away" });
  });
});

describe("makeThirdsKey + getThirdsRouting helpers", () => {
  it("makeThirdsKey sorteert input", () => {
    expect(makeThirdsKey(["L","A","C","B","D","E","F","G"])).toBe("ABCDEFGL");
  });

  it("makeThirdsKey throws bij verkeerd aantal groepen", () => {
    expect(() => makeThirdsKey(["A","B","C","D","E","F","G"])).toThrow();
    expect(() => makeThirdsKey(["A","B","C","D","E","F","G","H","I"])).toThrow();
  });

  it("makeThirdsKey throws bij duplicates", () => {
    expect(() => makeThirdsKey(["A","A","B","C","D","E","F","G"])).toThrow();
  });

  it("getThirdsRouting vindt de routing per geldige combinatie", () => {
    const routing = getThirdsRouting(["E","F","G","H","I","J","K","L"]);
    expect(routing).toBeTruthy();
    expect(routing!.E).toEqual({ match: "R32-7", side: "away" });
  });
});
