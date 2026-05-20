import { describe, it, expect } from "vitest";
import {
  KO_POINTS_FULL,
  KO_POINTS_HALF,
  deriveSurvivors,
  expandBracketPicksForScoring,
  scoreBonus,
  scoreGroupPrediction,
  scoreKnockoutMatch,
} from "./scoring";

const p = (h: number, a: number) => ({ match_id: 1, home_score: h, away_score: a });
const r = (h: number, a: number) => ({ id: 1, home_score: h, away_score: a });

describe("scoreGroupPrediction", () => {
  it("exact score = 5 (2+2+1)", () => {
    expect(scoreGroupPrediction(p(3, 1), r(3, 1))).toBe(5);
  });
  it("same goal diff, different scores = 1 (toto only)", () => {
    expect(scoreGroupPrediction(p(2, 1), r(3, 2))).toBe(1);
  });
  it("toto right, no scores right = 1", () => {
    expect(scoreGroupPrediction(p(1, 0), r(3, 1))).toBe(1);
  });
  it("wrong winner = 0", () => {
    expect(scoreGroupPrediction(p(1, 2), r(2, 1))).toBe(0);
  });
  it("0-0 exact = 5", () => {
    expect(scoreGroupPrediction(p(0, 0), r(0, 0))).toBe(5);
  });
  it("draw exact same scores = 5", () => {
    expect(scoreGroupPrediction(p(1, 1), r(1, 1))).toBe(5);
  });
  it("draw different goals = 1 (toto right only)", () => {
    expect(scoreGroupPrediction(p(1, 1), r(2, 2))).toBe(1);
  });
  it("predicted draw, actual home win: away right = 2", () => {
    // pred 1-1, actual 2-1: away=1 match (+2), toto wrong (X vs 1) = 2
    expect(scoreGroupPrediction(p(1, 1), r(2, 1))).toBe(2);
  });
  it("predicted home win, actual draw: away right = 2", () => {
    // pred 2-1, actual 1-1: away=1 match (+2), toto wrong (1 vs X) = 2
    expect(scoreGroupPrediction(p(2, 1), r(1, 1))).toBe(2);
  });
  it("home score right, toto right = 3", () => {
    // pred 2-0, actual 2-1: home=2 match (+2), away wrong, toto right (1=1) = 3
    expect(scoreGroupPrediction(p(2, 0), r(2, 1))).toBe(3);
  });
  it("home score right, toto wrong = 2", () => {
    // pred 1-0, actual 1-2: home=1 match (+2), away wrong, toto wrong (1 vs 2) = 2
    expect(scoreGroupPrediction(p(1, 0), r(1, 2))).toBe(2);
  });
  it("toto-only pick correct = 1", () => {
    expect(scoreGroupPrediction({ match_id: 1, home_score: null, away_score: null, toto_pick: "1" }, r(2, 0))).toBe(1);
  });
  it("toto-only pick wrong = 0", () => {
    expect(scoreGroupPrediction({ match_id: 1, home_score: null, away_score: null, toto_pick: "2" }, r(2, 0))).toBe(0);
  });
  it("explicit toto_pick overrides score-derived toto: scores wrong, explicit toto right = 1", () => {
    // pred 1-0 (derived "1"), explicit X, actual 3-3 (X). Beide scores fout, toto X = X → 1 pt.
    expect(scoreGroupPrediction({ match_id: 1, home_score: 1, away_score: 0, toto_pick: "X" }, r(3, 3))).toBe(1);
  });
  it("explicit toto_pick overrides score-derived toto: scores right, explicit toto wrong = 4", () => {
    // pred 2-2 (derived X), explicit "2", actual 2-2 (X). Scores 2+2, toto "2" ≠ X → 0 pt voor toto. Totaal 4.
    expect(scoreGroupPrediction({ match_id: 1, home_score: 2, away_score: 2, toto_pick: "2" }, r(2, 2))).toBe(4);
  });
});

describe("scoreKnockoutMatch (V2 per-match)", () => {
  it("exact match: jouw winner = echte winner → full pt", () => {
    expect(scoreKnockoutMatch("NED", "NED", new Set(["NED"]), "LAST_32")).toBe(8);
    expect(scoreKnockoutMatch("NED", "NED", new Set(["NED"]), "LAST_16")).toBe(14);
    expect(scoreKnockoutMatch("NED", "NED", new Set(["NED"]), "QUARTER_FINALS")).toBe(24);
    expect(scoreKnockoutMatch("NED", "NED", new Set(["NED"]), "SEMI_FINALS")).toBe(36);
    expect(scoreKnockoutMatch("NED", "NED", new Set(["NED"]), "FINAL")).toBe(96);
  });

  it("verkeerde wedstrijd, wel door in deze ronde → half pt", () => {
    expect(scoreKnockoutMatch("NED", "FRA", new Set(["FRA", "NED"]), "LAST_32")).toBe(4);
    expect(scoreKnockoutMatch("NED", "FRA", new Set(["FRA", "NED"]), "LAST_16")).toBe(7);
    expect(scoreKnockoutMatch("NED", "FRA", new Set(["FRA", "NED"]), "QUARTER_FINALS")).toBe(12);
    expect(scoreKnockoutMatch("NED", "FRA", new Set(["FRA", "NED"]), "SEMI_FINALS")).toBe(18);
    // FINAL heeft geen half — er is maar 1 finale.
    expect(scoreKnockoutMatch("NED", "FRA", new Set(["FRA", "NED"]), "FINAL")).toBe(0);
  });

  it("valt af in deze ronde → 0 pt", () => {
    expect(scoreKnockoutMatch("NED", "FRA", new Set(["FRA"]), "LAST_32")).toBe(0);
    expect(scoreKnockoutMatch("NED", "FRA", new Set(["FRA"]), "SEMI_FINALS")).toBe(0);
  });

  it("geen pick → 0 pt", () => {
    expect(scoreKnockoutMatch(null, "FRA", new Set(["FRA"]), "LAST_32")).toBe(0);
    expect(scoreKnockoutMatch(undefined, "FRA", new Set(["FRA"]), "LAST_32")).toBe(0);
    expect(scoreKnockoutMatch("", "FRA", new Set(["FRA"]), "LAST_32")).toBe(0);
  });

  it("wedstrijd nog niet gespeeld (geen winner) maar pick is in winners-set → half", () => {
    // Edge case: een wedstrijd is nog niet klaar maar het team is wel
    // winnaar van een andere wedstrijd in deze ronde. Geeft half pt.
    expect(scoreKnockoutMatch("NED", undefined, new Set(["NED"]), "LAST_32")).toBe(4);
  });

  it("totaal maximum per ronde komt op ~504 pt voor knock-out", () => {
    const max =
      16 * KO_POINTS_FULL.LAST_32 +
      8 * KO_POINTS_FULL.LAST_16 +
      4 * KO_POINTS_FULL.QUARTER_FINALS +
      2 * KO_POINTS_FULL.SEMI_FINALS +
      1 * KO_POINTS_FULL.FINAL;
    expect(max).toBe(504);
  });

  it("half is altijd de helft van full (behalve FINAL)", () => {
    expect(KO_POINTS_HALF.LAST_32 * 2).toBe(KO_POINTS_FULL.LAST_32);
    expect(KO_POINTS_HALF.LAST_16 * 2).toBe(KO_POINTS_FULL.LAST_16);
    expect(KO_POINTS_HALF.QUARTER_FINALS * 2).toBe(KO_POINTS_FULL.QUARTER_FINALS);
    expect(KO_POINTS_HALF.SEMI_FINALS * 2).toBe(KO_POINTS_FULL.SEMI_FINALS);
    expect(KO_POINTS_HALF.FINAL).toBe(0); // geen half voor finale
  });
});

describe("scoreBonus", () => {
  it("exact topscorer match → 10", () => {
    expect(
      scoreBonus(
        { top_scorer: "Kylian Mbappé", total_goals_tiebreak: null, total_yellow_cards_tiebreak: null },
        { topScorer: "Kylian Mbappé" },
      ).topScorer,
    ).toBe(10);
  });
  it("case-insensitive + trim topscorer → 10", () => {
    expect(
      scoreBonus(
        { top_scorer: "  kylian mbappé  ", total_goals_tiebreak: null, total_yellow_cards_tiebreak: null },
        { topScorer: "Kylian Mbappé" },
      ).topScorer,
    ).toBe(10);
  });
  it("different name → 0", () => {
    expect(
      scoreBonus(
        { top_scorer: "Lionel Messi", total_goals_tiebreak: null, total_yellow_cards_tiebreak: null },
        { topScorer: "Kylian Mbappé" },
      ).topScorer,
    ).toBe(0);
  });
  it("total goals exact → 10", () => {
    expect(
      scoreBonus(
        { top_scorer: null, total_goals_tiebreak: 120, total_yellow_cards_tiebreak: null },
        { topScorer: null, totalGoals: 120 },
      ).totalGoals,
    ).toBe(10);
  });
  it("total goals within ±3 → 5", () => {
    expect(
      scoreBonus(
        { top_scorer: null, total_goals_tiebreak: 117, total_yellow_cards_tiebreak: null },
        { topScorer: null, totalGoals: 120 },
      ).totalGoals,
    ).toBe(5);
  });
  it("total goals outside ±3 → 0", () => {
    expect(
      scoreBonus(
        { top_scorer: null, total_goals_tiebreak: 100, total_yellow_cards_tiebreak: null },
        { topScorer: null, totalGoals: 120 },
      ).totalGoals,
    ).toBe(0);
  });
  it("yellow cards exact → 10", () => {
    expect(
      scoreBonus(
        { top_scorer: null, total_goals_tiebreak: null, total_yellow_cards_tiebreak: 80 },
        { topScorer: null, totalYellowCards: 80 },
      ).totalYellowCards,
    ).toBe(10);
  });
  it("yellow cards within ±3 → 5", () => {
    expect(
      scoreBonus(
        { top_scorer: null, total_goals_tiebreak: null, total_yellow_cards_tiebreak: 82 },
        { topScorer: null, totalYellowCards: 80 },
      ).totalYellowCards,
    ).toBe(5);
  });
  it("all nulls → all 0", () => {
    expect(
      scoreBonus(
        { top_scorer: null, total_goals_tiebreak: null, total_yellow_cards_tiebreak: null },
        { topScorer: null },
      ),
    ).toEqual({ topScorer: 0, totalGoals: 0, totalYellowCards: 0, nlTopScorer: 0, nlTotalGoals: 0, nlProgress: 0 });
  });
});

describe("deriveSurvivors", () => {
  it("LAST_32 survivors = participants in LAST_32 matches (group qualifiers)", () => {
    const matches = [
      { id: 1, stage: "LAST_32", status: "SCHEDULED", home_team: "NED", away_team: "USA" },
      { id: 2, stage: "LAST_32", status: "SCHEDULED", home_team: "FRA", away_team: "GER" },
      { id: 3, stage: "LAST_32", status: "SCHEDULED", home_team: null, away_team: null }, // TBD
    ];
    const s = deriveSurvivors(matches, new Map());
    expect(s.LAST_32).toEqual(new Set(["NED", "USA", "FRA", "GER"]));
  });
  it("LAST_32 survivors empty when all teams still TBD", () => {
    const matches = [
      { id: 1, stage: "LAST_32", status: "SCHEDULED", home_team: null, away_team: null },
    ];
    const s = deriveSurvivors(matches, new Map());
    expect(s.LAST_32.size).toBe(0);
  });
  it("LAST_32 winners become LAST_16 survivors", () => {
    const matches = [
      { id: 1, stage: "LAST_32", status: "FINISHED" },
      { id: 2, stage: "LAST_32", status: "FINISHED" },
      { id: 3, stage: "LAST_32", status: "SCHEDULED" },
    ];
    const winners = new Map([
      [1, "NED"],
      [2, "FRA"],
      [3, "GER"],
    ]);
    const s = deriveSurvivors(matches, winners);
    expect(s.LAST_16).toEqual(new Set(["NED", "FRA"]));
    expect(s.QUARTER_FINALS.size).toBe(0);
  });
  it("matches without status FINISHED are ignored", () => {
    const matches = [{ id: 1, stage: "FINAL", status: "IN_PLAY" }];
    const s = deriveSurvivors(matches, new Map([[1, "NED"]]));
    expect(s.CHAMPION.size).toBe(0);
  });
  it("FINAL winner becomes CHAMPION survivor", () => {
    const matches = [{ id: 99, stage: "FINAL", status: "FINISHED" }];
    const s = deriveSurvivors(matches, new Map([[99, "ARG"]]));
    expect(s.CHAMPION).toEqual(new Set(["ARG"]));
  });
  it("full cascade across all knockout stages", () => {
    const matches = [
      { id: 10, stage: "LAST_32", status: "FINISHED" },
      { id: 20, stage: "LAST_16", status: "FINISHED" },
      { id: 30, stage: "QUARTER_FINALS", status: "FINISHED" },
      { id: 40, stage: "SEMI_FINALS", status: "FINISHED" },
      { id: 50, stage: "FINAL", status: "FINISHED" },
    ];
    const winners = new Map([
      [10, "A"],
      [20, "B"],
      [30, "C"],
      [40, "D"],
      [50, "E"],
    ]);
    const s = deriveSurvivors(matches, winners);
    expect(s.LAST_16).toEqual(new Set(["A"]));
    expect(s.QUARTER_FINALS).toEqual(new Set(["B"]));
    expect(s.SEMI_FINALS).toEqual(new Set(["C"]));
    expect(s.FINAL).toEqual(new Set(["D"]));
    expect(s.CHAMPION).toEqual(new Set(["E"]));
  });
});

describe("expandBracketPicksForScoring (V2)", () => {
  it("lege input → lege last32Teams + lege otherPicks", () => {
    const r = expandBracketPicksForScoring([]);
    expect(r.last32Teams.size).toBe(0);
    expect(r.otherPicks).toEqual([]);
  });

  it("alleen V1 LAST_32 picks → komen in last32Teams", () => {
    const r = expandBracketPicksForScoring([
      { round: "LAST_32", team_code: "BRA" },
      { round: "LAST_32", team_code: "ARG" },
    ]);
    expect(r.last32Teams).toEqual(new Set(["BRA", "ARG"]));
    expect(r.otherPicks).toEqual([]);
  });

  it("alleen V2 GROUP_TOP_2 + BEST_THIRDS → samen in last32Teams", () => {
    // Slot-encoding: (rank-1)*12 + groupIdx. rank1 poule A = 0, rank2 poule A = 12.
    const r = expandBracketPicksForScoring([
      { round: "GROUP_TOP_2", slot: 0, team_code: "BRA" },   // rank1 poule A
      { round: "GROUP_TOP_2", slot: 12, team_code: "MEX" },  // rank2 poule A
      { round: "BEST_THIRDS", slot: 0, team_code: "MAR" },
    ]);
    expect(r.last32Teams).toEqual(new Set(["BRA", "MEX", "MAR"]));
    expect(r.otherPicks).toEqual([]);
  });

  it("GROUP_TOP_2 slot >= 24 (= rank3 metadata) telt NIET mee voor LAST_32", () => {
    const r = expandBracketPicksForScoring([
      { round: "GROUP_TOP_2", slot: 0, team_code: "BRA" },        // rank1
      { round: "GROUP_TOP_2", slot: 12, team_code: "MEX" },       // rank2
      { round: "GROUP_TOP_2", slot: 24, team_code: "RANK3_NIET" }, // rank3
      { round: "BEST_THIRDS", slot: 0, team_code: "MAR" },
    ]);
    expect(r.last32Teams).toEqual(new Set(["BRA", "MEX", "MAR"]));
  });

  it("V1 LAST_32 + V2 picks → V2 wint, V1 LAST_32 wordt genegeerd", () => {
    const r = expandBracketPicksForScoring([
      { round: "LAST_32", team_code: "OUDE_V1" },
      { round: "GROUP_TOP_2", slot: 0, team_code: "NIEUW_V2" },
    ]);
    expect(r.last32Teams).toEqual(new Set(["NIEUW_V2"]));
    expect(r.otherPicks).toEqual([]);
  });

  it("LAST_16/QF/SF/FINAL/CHAMPION picks komen in otherPicks", () => {
    const picks = [
      { round: "LAST_16", team_code: "BRA" },
      { round: "QUARTER_FINALS", team_code: "ARG" },
      { round: "SEMI_FINALS", team_code: "FRA" },
      { round: "FINAL", team_code: "ESP" },
      { round: "CHAMPION", team_code: "NED" },
    ];
    const r = expandBracketPicksForScoring(picks);
    expect(r.last32Teams.size).toBe(0);
    expect(r.otherPicks).toEqual(picks);
  });

  it("V2 + R16 picks samen werken correct", () => {
    const r = expandBracketPicksForScoring([
      { round: "GROUP_TOP_2", slot: 0, team_code: "BRA" },
      { round: "BEST_THIRDS", slot: 0, team_code: "MAR" },
      { round: "LAST_16", team_code: "BRA" },
      { round: "FINAL", team_code: "BRA" },
    ]);
    expect(r.last32Teams).toEqual(new Set(["BRA", "MAR"]));
    expect(r.otherPicks).toEqual([
      { round: "LAST_16", team_code: "BRA" },
      { round: "FINAL", team_code: "BRA" },
    ]);
  });

  it("duplicate team-codes in last32Teams worden gededupliceerd (Set-gedrag)", () => {
    const r = expandBracketPicksForScoring([
      { round: "GROUP_TOP_2", slot: 0, team_code: "BRA" },
      { round: "BEST_THIRDS", slot: 0, team_code: "BRA" }, // duplicate (zou normaal niet voorkomen)
    ]);
    expect(r.last32Teams).toEqual(new Set(["BRA"]));
  });
});
