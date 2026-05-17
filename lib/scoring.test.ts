import { describe, it, expect } from "vitest";
import {
  KO_POINTS,
  deriveSurvivors,
  scoreBonus,
  scoreGroupPrediction,
  scoreKnockoutRound,
  type BracketRound,
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

describe("scoreKnockoutRound", () => {
  it("3 of 8 correct in LAST_16 → 21", () => {
    const picks = ["NED", "FRA", "BRA", "ARG", "GER", "ESP", "BEL", "POR"];
    const survivors = new Set(["NED", "FRA", "BRA", "USA"]);
    expect(scoreKnockoutRound(picks, survivors, "LAST_16")).toBe(21);
  });
  it("zero correct = 0", () => {
    expect(scoreKnockoutRound(["NED"], new Set(["FRA"]), "QUARTER_FINALS")).toBe(0);
  });
  it("CHAMPION 1 correct = 40", () => {
    expect(scoreKnockoutRound(["NED"], new Set(["NED"]), "CHAMPION")).toBe(40);
  });
  it("KO_POINTS mapping per round", () => {
    const rounds: BracketRound[] = ["LAST_32", "LAST_16", "QUARTER_FINALS", "SEMI_FINALS", "FINAL", "CHAMPION"];
    const expected = [4, 7, 12, 18, 28, 40];
    rounds.forEach((round, i) => {
      expect(scoreKnockoutRound(["X"], new Set(["X"]), round)).toBe(expected[i]);
      expect(KO_POINTS[round]).toBe(expected[i]);
    });
  });
});

describe("scoreBonus", () => {
  it("exact topscorer match → 15", () => {
    expect(
      scoreBonus(
        { top_scorer: "Kylian Mbappé", total_goals_tiebreak: null, total_yellow_cards_tiebreak: null },
        { topScorer: "Kylian Mbappé" },
      ).topScorer,
    ).toBe(15);
  });
  it("case-insensitive + trim topscorer → 15", () => {
    expect(
      scoreBonus(
        { top_scorer: "  kylian mbappé  ", total_goals_tiebreak: null, total_yellow_cards_tiebreak: null },
        { topScorer: "Kylian Mbappé" },
      ).topScorer,
    ).toBe(15);
  });
  it("different name → 0", () => {
    expect(
      scoreBonus(
        { top_scorer: "Lionel Messi", total_goals_tiebreak: null, total_yellow_cards_tiebreak: null },
        { topScorer: "Kylian Mbappé" },
      ).topScorer,
    ).toBe(0);
  });
  it("total goals exact → 15", () => {
    expect(
      scoreBonus(
        { top_scorer: null, total_goals_tiebreak: 120, total_yellow_cards_tiebreak: null },
        { topScorer: null, totalGoals: 120 },
      ).totalGoals,
    ).toBe(15);
  });
  it("total goals within ±3 → 8", () => {
    expect(
      scoreBonus(
        { top_scorer: null, total_goals_tiebreak: 117, total_yellow_cards_tiebreak: null },
        { topScorer: null, totalGoals: 120 },
      ).totalGoals,
    ).toBe(8);
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
    ).toEqual({ topScorer: 0, totalGoals: 0, totalYellowCards: 0 });
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
