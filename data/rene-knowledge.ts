// ─────────────────────────────────────────────────────────────────────────────
// Rene van der Gijp (Mr Bookmaker) — Knowledge base
//
// Dit is de "kennis" die Rene gebruikt om de poule in te vullen. Eén plek voor
// alle bookmaker-input zodat hij snel ge-update kan worden als de odds wijzigen.
//
// Bron (mei 2026):
//   • Outright kampioens-odds: ESPN futures-tabel (synced van DraftKings)
//     https://www.espn.com/espn/betting/story/_/id/48386952
//   • Topscorer-markt: FOX Sports / RotoWire (Mbappé +600 favoriet)
//   • Groepsindeling: officiële FIFA-loting van 5 dec 2025 (Wikipedia)
//
// Update-procedure (als de odds bewegen):
//   1. Pas RENE_CHAMPION_ODDS aan met nieuwe decimal-odds per land
//   2. Eventueel RENE_GROUP_FORECAST tweaken als bookmakers een verrassende
//      poule-favoriet zien (bv. host-effect Mexico/Canada/USA)
//   3. Topscorer + NL-progress + total-goals tunen
//   4. Draai `npm run beat:rene -- --confirm` opnieuw — bestaande Rene-picks
//      worden gewist en vervangen.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Decimal odds om kampioen te worden (lager = grotere favoriet).
 * Bron: ESPN futures-tabel mei 2026.
 *
 * Conversie American → decimal:
 *   +500 → 6.0       +650 → 7.5       +800 → 9.0       +850 → 9.5
 *   11-1 → 12.0      14-1 → 15.0      20-1 → 21.0      ...
 *
 * "strength" in onze code = 1/odds = impliciete kans. Hoger = beter.
 */
export const RENE_CHAMPION_ODDS: Record<string, number> = {
  // Top-favorieten
  ESP: 6.0, FRA: 6.0, ENG: 7.5, BRA: 9.0, ARG: 9.5,
  // Tweede tier
  POR: 12.0, GER: 15.0, NED: 21.0, NOR: 31.0, BEL: 36.0,
  // Derde tier (outsiders)
  COL: 41.0, MAR: 51.0, JPN: 51.0, USA: 61.0, URY: 66.0,
  MEX: 76.0, SUI: 81.0, CRO: 81.0, ECU: 91.0, TUR: 101.0, SWE: 101.0,
  SEN: 111.0, AUT: 151.0, PAR: 151.0, CAN: 201.0, SCO: 201.0,
  // Vierde tier
  CZE: 251.0, CIV: 251.0, BIH: 251.0, EGY: 301.0, GHA: 301.0,
  ALG: 351.0, KOR: 451.0, IRN: 501.0, AUS: 501.0, TUN: 501.0,
  COD: 701.0, RSA: 801.0,
  // Bodem (kanslozen — kunnen nog wel uit groep)
  KSA: 1001.0, PAN: 1001.0, QAT: 1001.0, UZB: 1001.0, NZL: 1001.0,
  IRQ: 1001.0, CPV: 1001.0,
  JOR: 2001.0, CUR: 2001.0, HAI: 2501.0,
};

/**
 * Impliciete sterkte (kans-evenredig) per land. 1/odds, met fallback 0 voor
 * landen die (om wat voor reden ook) niet in de odds-tabel staan.
 */
export function strength(code: string): number {
  const o = RENE_CHAMPION_ODDS[code];
  return o ? 1 / o : 0;
}

/**
 * Per groep: Rene's voorspelling wie 1e, 2e, 3e wordt.
 *
 * Deze ordening komt logisch uit RENE_CHAMPION_ODDS (sort by strength desc),
 * MAAR is hier expliciet gemaakt zodat we host-effecten en specifieke
 * matchup-nuances kunnen verwerken zonder de odds te slopen.
 *
 * Voorbeeld: Mexico (76.0) is host en wint normaal de poule, ook al heeft
 * Tsjechië (251.0) op papier nog enige kans. → 1: MEX.
 */
export const RENE_GROUP_FORECAST: Record<string, { first: string; second: string; third: string }> = {
  A: { first: "MEX", second: "CZE", third: "KOR" },   // Mexico host-effect
  B: { first: "SUI", second: "CAN", third: "BIH" },   // Canada host-effect (CAN > BIH)
  C: { first: "BRA", second: "MAR", third: "SCO" },
  D: { first: "USA", second: "TUR", third: "PAR" },   // USA host-effect
  E: { first: "GER", second: "ECU", third: "CIV" },
  F: { first: "NED", second: "JPN", third: "SWE" },
  G: { first: "BEL", second: "EGY", third: "IRN" },
  H: { first: "ESP", second: "URY", third: "CPV" },
  I: { first: "FRA", second: "NOR", third: "SEN" },
  J: { first: "ARG", second: "AUT", third: "ALG" },
  K: { first: "POR", second: "COL", third: "COD" },
  L: { first: "ENG", second: "CRO", third: "GHA" },
};

/**
 * Bonus-voorspellingen (1× invullen, samen met outright odds).
 *
 *   • topScorer: Mbappé +600 — duidelijke favoriet, Frankrijk gaat ver
 *   • nlTopScorer: Memphis is nog steeds de meest tournament-relevante NL'er
 *   • nlProgress: NED odds 21.0 ≈ Belgium niveau → kwartfinale realistisch
 *   • totalGoals: WK22 (64 wedstrijden) = 172 goals, gem. 2.69/match.
 *     Voor WK26 (104 wedstrijden) bij gelijk gemiddelde → ~280. Bookmaker-
 *     lines hangen typisch iets onder zodat ~270 een veilige Rene-pick is.
 *   • totalYellowCards: WK22 had 227 gele kaarten = 3.55/match → 104×3.55 ≈ 370
 */
export const RENE_BONUS = {
  topScorer: "Kylian Mbappé",
  totalGoals: 270,
  totalYellowCards: 370,
  nlTopScorer: "Memphis Depay",
  // Memphis in 5 wedstrijden t/m kwartfinale ≈ 4 doelpunten (realistisch)
  nlTotalGoals: 4,
  // Moet matchen met NLProgress-enum (zie app/invullen/bonus/BonusForm.tsx):
  //   GROUP_STAGE | LAST_32 | LAST_16 | QUARTER_FINALS | SEMI_FINALS | FINAL_LOSER | CHAMPION
  nlProgress: "QUARTER_FINALS" as const,
};
