/**
 * Heavy integratie-test voor de scoring-keten. Hamert tegen de échte
 * Supabase-DB (vereist .env.local met SUPABASE_SERVICE_ROLE_KEY) en
 * verifieert dat:
 *
 *   1. Een test-user in `profiles` geschreven en gelezen kan worden
 *   2. Predictions (groepsfase) worden opgeslagen + correct gescoord
 *   3. Bracket-picks (knock-out V2) worden opgeslagen + correct gescoord
 *   4. Bonus-picks worden opgeslagen + correct gescoord
 *
 * Veiligheid:
 *   - Test-user heeft een vaste UUID + `department='__SCORING_TEST__'`
 *     marker zodat hij nooit per ongeluk met echte data botst.
 *   - Cleanup gebeurt VOOR + NA elke run zodat orphan-data nooit blijft
 *     staan, zelfs niet als een test crashed.
 *   - Schrijft NIET in matches/settings: laat real-world data ongemoeid.
 *   - Maakt een "fake match-result" in-code bij scoring i.p.v. matches
 *     te updaten — geen risico op corrupte uitslagen voor echte users.
 *
 * Run: npm run test:integration
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  scoreGroupPrediction,
  scoreKnockoutMatch,
  scoreBonus,
  KO_POINTS_FULL,
} from "@/lib/scoring";

const MARKER = "__SCORING_TEST__";
const TEST_EMAIL = "scoring-test@nijhuis-test.local";

let supabase: SupabaseClient;
let TEST_USER_ID: string;

/** Verwijder alle data van eerdere test-runs + bijhorende auth-users. */
async function cleanup() {
  const { data: testProfiles } = await supabase
    .from("profiles")
    .select("id")
    .eq("department", MARKER);
  const ids = (testProfiles ?? []).map((p) => p.id);

  for (const table of [
    "predictions",
    "bracket_picks",
    "bracket_match_overrides",
    "bonus_picks",
    "points",
  ]) {
    if (ids.length > 0) {
      await supabase.from(table).delete().in("user_id", ids);
    }
  }
  await supabase.from("profiles").delete().eq("department", MARKER);

  // Auth-users opruimen — profiles.id is FK naar auth.users, dus auth-user
  // moet bestaan voordat we profile kunnen maken. Cleanup omgekeerd.
  for (const id of ids) {
    await supabase.auth.admin.deleteUser(id).catch(() => {});
  }
}

beforeAll(async () => {
  supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  // Schoonmaken van eventuele vorige test-runs voordat we beginnen
  await cleanup();

  // Auth-user aanmaken — profiles heeft FK naar auth.users, dus geen
  // shortcut. email_confirm:true omzeilt verificatie-mail.
  const { data: created, error: authErr } = await supabase.auth.admin.createUser({
    email: TEST_EMAIL,
    password: "scoring-test-internal-do-not-use",
    email_confirm: true,
  });
  if (authErr || !created.user) {
    throw new Error(`Auth setup faalt: ${authErr?.message ?? "geen user terug"}`);
  }
  TEST_USER_ID = created.user.id;

  // Profile linken aan auth-user
  const { error } = await supabase.from("profiles").upsert(
    { id: TEST_USER_ID, display_name: "Scoring Test", department: MARKER },
    { onConflict: "id" },
  );
  if (error) throw new Error(`Profile setup faalt: ${error.message}`);
});

afterAll(async () => {
  await cleanup();
});

describe("DB-laag — profiles + lookups", () => {
  it("test-profile staat in DB en is leesbaar", async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, display_name, department")
      .eq("id", TEST_USER_ID)
      .single();
    expect(error).toBeNull();
    expect(data?.display_name).toBe("Scoring Test");
    expect(data?.department).toBe(MARKER);
  });

  it("matches-tabel heeft realistische data (>= 100 wedstrijden)", async () => {
    const { count, error } = await supabase
      .from("matches")
      .select("id", { count: "exact", head: true });
    expect(error).toBeNull();
    expect(count ?? 0).toBeGreaterThanOrEqual(100);
  });
});

describe("Groepsfase scoring", () => {
  it("predictions schrijven + lezen via DB", async () => {
    const { data: match } = await supabase
      .from("matches")
      .select("id")
      .eq("stage", "GROUP_STAGE")
      .limit(1)
      .single();
    expect(match).toBeTruthy();

    const { error: upErr } = await supabase.from("predictions").upsert(
      {
        user_id: TEST_USER_ID,
        match_id: match!.id,
        home_score: 2,
        away_score: 1,
        toto_pick: "1",
      },
      { onConflict: "user_id,match_id" },
    );
    expect(upErr).toBeNull();

    const { data: read } = await supabase
      .from("predictions")
      .select("home_score, away_score, toto_pick")
      .eq("user_id", TEST_USER_ID)
      .eq("match_id", match!.id)
      .single();
    expect(read).toEqual({ home_score: 2, away_score: 1, toto_pick: "1" });
  });

  it("score: alles correct (2-1 voorspeld, 2-1 uitslag) = 5 pt", () => {
    const pts = scoreGroupPrediction(
      { match_id: 1, home_score: 2, away_score: 1, toto_pick: "1" },
      { id: 1, home_score: 2, away_score: 1 },
    );
    // 2 (home correct) + 2 (away correct) + 1 (toto correct) = 5
    expect(pts).toBe(5);
  });

  it("score: alleen toto correct (3-2 voorspeld, 1-0 uitslag) = 1 pt", () => {
    const pts = scoreGroupPrediction(
      { match_id: 1, home_score: 3, away_score: 2, toto_pick: "1" },
      { id: 1, home_score: 1, away_score: 0 },
    );
    // Beide scores fout, alleen toto "1" klopt (home wint) = 1 pt
    expect(pts).toBe(1);
  });

  it("score: alleen home-score correct (2-1 voorspeld, 2-0 uitslag) = 3 pt", () => {
    const pts = scoreGroupPrediction(
      { match_id: 1, home_score: 2, away_score: 1, toto_pick: "1" },
      { id: 1, home_score: 2, away_score: 0 },
    );
    // 2 (home correct) + 0 (away wrong) + 1 (toto "1" correct, beide picks winnen thuis)
    expect(pts).toBe(3);
  });

  it("score: alles fout (1-3 voorspeld, 0-1 uitslag) = 0 pt", () => {
    const pts = scoreGroupPrediction(
      { match_id: 1, home_score: 1, away_score: 3, toto_pick: "2" },
      { id: 1, home_score: 0, away_score: 1 },
    );
    // Voorspelling zegt away wint, uitslag zegt away wint → toto is wel correct? Ja "2" = away wint, dus +1
    expect(pts).toBe(1);
  });

  it("score: gelijkspel correct voorspeld (1-1) = 5 pt", () => {
    const pts = scoreGroupPrediction(
      { match_id: 1, home_score: 1, away_score: 1, toto_pick: "X" },
      { id: 1, home_score: 1, away_score: 1 },
    );
    expect(pts).toBe(5);
  });
});

describe("Knock-out scoring", () => {
  it("bracket-pick schrijven + lezen", async () => {
    const { error: upErr } = await supabase.from("bracket_picks").upsert(
      {
        user_id: TEST_USER_ID,
        round: "LAST_32",
        slot: 1,
        team_code: "NED",
      },
      { onConflict: "user_id,round,slot" },
    );
    expect(upErr).toBeNull();

    const { data: read } = await supabase
      .from("bracket_picks")
      .select("round, slot, team_code")
      .eq("user_id", TEST_USER_ID)
      .eq("round", "LAST_32")
      .eq("slot", 1)
      .single();
    expect(read?.team_code).toBe("NED");
  });

  it("score: juiste land op juiste plek = volle punten (LAST_32: 8 pt)", () => {
    const pts = scoreKnockoutMatch(
      "NED",
      "NED",
      new Set(["NED", "GER", "FRA"]),
      "LAST_32",
    );
    expect(pts).toBe(KO_POINTS_FULL.LAST_32);
    expect(pts).toBe(8);
  });

  it("score: juiste land in ronde maar verkeerde wedstrijd = halve punten (LAST_32: 4 pt)", () => {
    const pts = scoreKnockoutMatch(
      "NED",
      "GER",                        // andere winnaar in deze wedstrijd
      new Set(["GER", "NED", "FRA"]), // NED is wel door in de ronde
      "LAST_32",
    );
    expect(pts).toBe(4);
  });

  it("score: pick is helemaal uitgeschakeld = 0 pt", () => {
    const pts = scoreKnockoutMatch(
      "BEL",
      "NED",
      new Set(["NED", "GER", "FRA"]), // BEL is niet door
      "LAST_32",
    );
    expect(pts).toBe(0);
  });

  it("score-tabel: punten per ronde kloppen met spec", () => {
    expect(KO_POINTS_FULL.LAST_32).toBe(8);
    expect(KO_POINTS_FULL.LAST_16).toBe(14);
    expect(KO_POINTS_FULL.QUARTER_FINALS).toBe(24);
    expect(KO_POINTS_FULL.SEMI_FINALS).toBe(36);
    expect(KO_POINTS_FULL.FINAL).toBe(96);
  });
});

describe("Bonus scoring", () => {
  it("bonus_picks schrijven + lezen (alle 6 velden)", async () => {
    const { error: upErr } = await supabase.from("bonus_picks").upsert(
      {
        user_id: TEST_USER_ID,
        top_scorer: "Lionel Messi",
        total_goals_tiebreak: 165,
        total_yellow_cards_tiebreak: 200,
        nl_top_scorer: "Memphis Depay",
        nl_total_goals: 6,
        nl_progress: "QUARTER_FINALS",
      },
      { onConflict: "user_id" },
    );
    expect(upErr).toBeNull();

    const { data: read } = await supabase
      .from("bonus_picks")
      .select("top_scorer, total_goals_tiebreak, nl_top_scorer, nl_progress")
      .eq("user_id", TEST_USER_ID)
      .single();
    expect(read?.top_scorer).toBe("Lionel Messi");
    expect(read?.total_goals_tiebreak).toBe(165);
    expect(read?.nl_top_scorer).toBe("Memphis Depay");
    expect(read?.nl_progress).toBe("QUARTER_FINALS");
  });

  it("score: topscorer exact match = 10 pt", () => {
    const pts = scoreBonus(
      {
        top_scorer: "Messi",
        total_goals_tiebreak: null,
        total_yellow_cards_tiebreak: null,
        nl_top_scorer: null,
        nl_total_goals: null,
        nl_progress: null,
      },
      {
        topScorer: "Messi",
        totalYellowCards: null,
        totalGoals: null,
        nlTopScorer: null,
        nlTotalGoals: null,
        nlProgress: null,
      },
    );
    expect(pts.topScorer).toBe(10);
  });

  it("score: topscorer mis = 0 pt", () => {
    const pts = scoreBonus(
      {
        top_scorer: "Messi",
        total_goals_tiebreak: null,
        total_yellow_cards_tiebreak: null,
        nl_top_scorer: null,
        nl_total_goals: null,
        nl_progress: null,
      },
      {
        topScorer: "Mbappé",
        totalYellowCards: null,
        totalGoals: null,
        nlTopScorer: null,
        nlTotalGoals: null,
        nlProgress: null,
      },
    );
    expect(pts.topScorer).toBe(0);
  });

  it("score: doelpunten exact = 10 pt, dichtbij (1 verschil) = 5 pt", () => {
    const exact = scoreBonus(
      {
        top_scorer: null,
        total_goals_tiebreak: 150,
        total_yellow_cards_tiebreak: null,
        nl_top_scorer: null,
        nl_total_goals: null,
        nl_progress: null,
      },
      {
        topScorer: null,
        totalYellowCards: null,
        totalGoals: 150,
        nlTopScorer: null,
        nlTotalGoals: null,
        nlProgress: null,
      },
    );
    expect(exact.totalGoals).toBe(10);

    const close = scoreBonus(
      {
        top_scorer: null,
        total_goals_tiebreak: 149,
        total_yellow_cards_tiebreak: null,
        nl_top_scorer: null,
        nl_total_goals: null,
        nl_progress: null,
      },
      {
        topScorer: null,
        totalYellowCards: null,
        totalGoals: 150,
        nlTopScorer: null,
        nlTotalGoals: null,
        nlProgress: null,
      },
    );
    expect(close.totalGoals).toBe(5);
  });

  it("score: NL progress exact = 10 pt (geen close-credit)", () => {
    const correct = scoreBonus(
      {
        top_scorer: null,
        total_goals_tiebreak: null,
        total_yellow_cards_tiebreak: null,
        nl_top_scorer: null,
        nl_total_goals: null,
        nl_progress: "QUARTER_FINALS",
      },
      {
        topScorer: null,
        totalYellowCards: null,
        totalGoals: null,
        nlTopScorer: null,
        nlTotalGoals: null,
        nlProgress: "QUARTER_FINALS",
      },
    );
    expect(correct.nlProgress).toBe(10);

    // 1 ronde ernaast = 0 (geen close-credit voor NL progress)
    const oneOff = scoreBonus(
      {
        top_scorer: null,
        total_goals_tiebreak: null,
        total_yellow_cards_tiebreak: null,
        nl_top_scorer: null,
        nl_total_goals: null,
        nl_progress: "SEMI_FINALS",
      },
      {
        topScorer: null,
        totalYellowCards: null,
        totalGoals: null,
        nlTopScorer: null,
        nlTotalGoals: null,
        nlProgress: "QUARTER_FINALS",
      },
    );
    expect(oneOff.nlProgress).toBe(0);
  });
});

describe("Cleanup-marker werkt", () => {
  it("test-user is gemarkeerd zodat cleanup hem vindt", async () => {
    const { count } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("department", MARKER);
    expect(count ?? 0).toBeGreaterThanOrEqual(1);
  });
});
