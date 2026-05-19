import { describe, it, expect } from "vitest";
import {
  BRACKET_GRAPH,
  ALL_MATCH_IDS,
  MATCH_IDS_BY_ROUND,
  descendantMatches,
  parentMatches,
} from "./bracket-graph";
import { roundOfMatch, type MatchNode } from "./types";

describe("bracket-graph structuur", () => {
  it("heeft precies 31 wedstrijden", () => {
    expect(Object.keys(BRACKET_GRAPH).length).toBe(31);
    expect(ALL_MATCH_IDS.length).toBe(31);
  });

  it("aantallen per ronde kloppen", () => {
    expect(MATCH_IDS_BY_ROUND.LAST_32.length).toBe(16);
    expect(MATCH_IDS_BY_ROUND.LAST_16.length).toBe(8);
    expect(MATCH_IDS_BY_ROUND.QUARTER_FINALS.length).toBe(4);
    expect(MATCH_IDS_BY_ROUND.SEMI_FINALS.length).toBe(2);
    expect(MATCH_IDS_BY_ROUND.FINAL.length).toBe(1);
  });

  it("R32-matches hebben home + away slot en fifaMatchNo M73..M88", () => {
    const fifaNos: number[] = [];
    for (const id of MATCH_IDS_BY_ROUND.LAST_32) {
      const node = BRACKET_GRAPH[id];
      expect(node.round).toBe("LAST_32");
      if (node.round !== "LAST_32") throw new Error();
      expect(node.home).toBeTruthy();
      expect(node.away).toBeTruthy();
      expect(node.fifaMatchNo).toBeGreaterThanOrEqual(73);
      expect(node.fifaMatchNo).toBeLessThanOrEqual(88);
      fifaNos.push(node.fifaMatchNo);
    }
    expect(new Set(fifaNos).size).toBe(16);
  });

  it("FIFA-pairings R16: R16-1 = R32-2 + R32-5 (M89 = W74 v W77)", () => {
    const r16_1 = BRACKET_GRAPH["R16-1"];
    if (r16_1.round === "LAST_32") throw new Error();
    expect(r16_1.homeFromMatch).toBe("R32-2");
    expect(r16_1.awayFromMatch).toBe("R32-5");
    expect(r16_1.fifaMatchNo).toBe(89);
  });

  it("FIFA-pairings R16: R16-8 = R32-13 + R32-15 (M96 = W85 v W87)", () => {
    const r16_8 = BRACKET_GRAPH["R16-8"];
    if (r16_8.round === "LAST_32") throw new Error();
    expect(r16_8.homeFromMatch).toBe("R32-13");
    expect(r16_8.awayFromMatch).toBe("R32-15");
    expect(r16_8.fifaMatchNo).toBe(96);
  });

  it("FIFA-pairings QF: QF-2 = R16-5 + R16-6 (M98 = W93 v W94)", () => {
    const node = BRACKET_GRAPH["QF-2"];
    if (node.round === "LAST_32") throw new Error();
    expect(node.homeFromMatch).toBe("R16-5");
    expect(node.awayFromMatch).toBe("R16-6");
    expect(node.fifaMatchNo).toBe(98);
  });

  it("SF + F: M101=SF-1, M102=SF-2, M104=F-1", () => {
    const sf1 = BRACKET_GRAPH["SF-1"];
    const sf2 = BRACKET_GRAPH["SF-2"];
    const f = BRACKET_GRAPH["F-1"];
    if (sf1.round === "LAST_32" || sf2.round === "LAST_32" || f.round === "LAST_32") throw new Error();
    expect(sf1.fifaMatchNo).toBe(101);
    expect(sf2.fifaMatchNo).toBe(102);
    expect(f.fifaMatchNo).toBe(104);
    expect(sf1.homeFromMatch).toBe("QF-1");
    expect(sf1.awayFromMatch).toBe("QF-2");
    expect(sf2.homeFromMatch).toBe("QF-3");
    expect(sf2.awayFromMatch).toBe("QF-4");
    expect(f.homeFromMatch).toBe("SF-1");
    expect(f.awayFromMatch).toBe("SF-2");
  });

  it("alle non-final matches hebben een correcte child-pointer", () => {
    // Voor elke R32 → child is een R16 die als parent verwijst naar deze R32
    for (const id of MATCH_IDS_BY_ROUND.LAST_32) {
      const node = BRACKET_GRAPH[id] as MatchNode;
      if (!("child" in node) || !node.child) throw new Error(`${id} heeft geen child`);
      const child = BRACKET_GRAPH[node.child];
      if (child.round === "LAST_32") throw new Error();
      const isParent = child.homeFromMatch === id || child.awayFromMatch === id;
      expect(isParent).toBe(true);
    }
    // Idem R16 → QF, QF → SF, SF → F
    for (const id of [...MATCH_IDS_BY_ROUND.LAST_16, ...MATCH_IDS_BY_ROUND.QUARTER_FINALS, ...MATCH_IDS_BY_ROUND.SEMI_FINALS]) {
      const node = BRACKET_GRAPH[id] as MatchNode;
      if (!("child" in node) || !node.child) throw new Error(`${id} heeft geen child`);
      const child = BRACKET_GRAPH[node.child];
      if (child.round === "LAST_32") throw new Error();
      const isParent = child.homeFromMatch === id || child.awayFromMatch === id;
      expect(isParent).toBe(true);
    }
  });

  it("finale heeft geen child", () => {
    const f = BRACKET_GRAPH["F-1"];
    expect("child" in f && f.child).toBeFalsy();
  });

  it("graaf is acyclisch — elke match leidt via child-traversal naar F-1", () => {
    for (const id of ALL_MATCH_IDS) {
      const visited = new Set<string>([id]);
      let current = id;
      while (true) {
        const node = BRACKET_GRAPH[current];
        if (!("child" in node) || !node.child) break;
        if (visited.has(node.child)) throw new Error(`cyclus vanaf ${id} via ${node.child}`);
        visited.add(node.child);
        current = node.child;
      }
      expect(current).toBe("F-1");
    }
  });
});

describe("R32 slot definities — fixed vs third-placed", () => {
  it("R32-1 (M73) is 2A v 2B — beide fixed", () => {
    const node = BRACKET_GRAPH["R32-1"];
    if (node.round !== "LAST_32") throw new Error();
    expect(node.home).toEqual({ kind: "fixed", seed: "2A" });
    expect(node.away).toEqual({ kind: "fixed", seed: "2B" });
  });

  it("R32-2 (M74) is 1E v Best 3rd of A,B,C,D,F", () => {
    const node = BRACKET_GRAPH["R32-2"];
    if (node.round !== "LAST_32") throw new Error();
    expect(node.home).toEqual({ kind: "fixed", seed: "1E" });
    expect(node.away).toEqual({ kind: "third-placed", from: ["A","B","C","D","F"] });
  });

  it("R32-7 (M79) is 1A v Best 3rd of C,E,F,H,I", () => {
    const node = BRACKET_GRAPH["R32-7"];
    if (node.round !== "LAST_32") throw new Error();
    expect(node.home).toEqual({ kind: "fixed", seed: "1A" });
    expect(node.away).toEqual({ kind: "third-placed", from: ["C","E","F","H","I"] });
  });

  it("Precies 8 R32-matches hebben een third-placed slot, 8 hebben twee fixed slots", () => {
    let thirdsCount = 0;
    let fixedCount = 0;
    for (const id of MATCH_IDS_BY_ROUND.LAST_32) {
      const node = BRACKET_GRAPH[id];
      if (node.round !== "LAST_32") throw new Error();
      const hasThird = node.home.kind === "third-placed" || node.away.kind === "third-placed";
      if (hasThird) thirdsCount++;
      else fixedCount++;
    }
    expect(thirdsCount).toBe(8);
    expect(fixedCount).toBe(8);
  });
});

describe("descendantMatches", () => {
  it("R32-2 leidt via R16-1 → QF-1 → SF-1 → F-1", () => {
    expect(descendantMatches("R32-2")).toEqual(["R16-1", "QF-1", "SF-1", "F-1"]);
  });

  it("R32-13 leidt via R16-8 → QF-4 → SF-2 → F-1", () => {
    expect(descendantMatches("R32-13")).toEqual(["R16-8", "QF-4", "SF-2", "F-1"]);
  });

  it("F-1 heeft geen descendants", () => {
    expect(descendantMatches("F-1")).toEqual([]);
  });
});

describe("parentMatches", () => {
  it("R32 heeft geen parents", () => {
    expect(parentMatches("R32-1")).toBeNull();
  });

  it("R16-1 heeft parents R32-2 en R32-5 (FIFA-pairing)", () => {
    expect(parentMatches("R16-1")).toEqual(["R32-2", "R32-5"]);
  });

  it("QF-2 heeft parents R16-5 en R16-6", () => {
    expect(parentMatches("QF-2")).toEqual(["R16-5", "R16-6"]);
  });

  it("F-1 heeft parents SF-1 en SF-2", () => {
    expect(parentMatches("F-1")).toEqual(["SF-1", "SF-2"]);
  });
});

describe("roundOfMatch helper", () => {
  it("R32-1 → LAST_32", () => expect(roundOfMatch("R32-1")).toBe("LAST_32"));
  it("R16-5 → LAST_16", () => expect(roundOfMatch("R16-5")).toBe("LAST_16"));
  it("QF-3 → QUARTER_FINALS", () => expect(roundOfMatch("QF-3")).toBe("QUARTER_FINALS"));
  it("SF-2 → SEMI_FINALS", () => expect(roundOfMatch("SF-2")).toBe("SEMI_FINALS"));
  it("F-1 → FINAL", () => expect(roundOfMatch("F-1")).toBe("FINAL"));
});
