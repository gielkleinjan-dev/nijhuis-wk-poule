// Placement-gebaseerde knock-outtelling (timing-verschuiving t.o.v. de huidige
// winnaar-gebaseerde telling in lib/scoring.ts).
//
// Doel (zie /Users/.../plans): dezelfde puntenwaarden, maar uitgekeerd zodra
// 100% zeker is dat een land op een bracket-plek terechtkomt — niet pas als de
// wedstrijd van die ronde gespeeld is. "100% zeker geplaatst" = de bron heeft
// de twee deelnemers van die knock-outwedstrijd hard ingevuld
// (matches.home_team / matches.away_team).
//
// Model per ronde R (LAST_32 t/m SEMI_FINALS):
//   - vol[R]  = jouw voorspelde land staat op exact dit vakje (juiste plek)
//   - half[R] = jouw voorspelde land bereikt deze ronde, maar op een ander vakje
//   - 0       = anders
// De FINALE/wereldkampioen blijft resultaat-gebaseerd (je kunt de kampioen pas
// kennen als de finale gespeeld is) en wordt hier NIET als placement gescoord —
// die houdt exact de bestaande waarde (zie scoreChampion).
//
// Waarden ongewijzigd hergebruikt uit lib/scoring.ts (KO_POINTS_FULL/HALF).

import {
  BRACKET_GRAPH,
  MATCH_IDS_BY_ROUND,
  ALL_MATCH_IDS,
} from "./bracket/bracket-graph";
import { computeR32Slots, type PhaseA, type Bracket, type TeamGroupMap } from "./bracket/cascade";
import { isGroupCode, type MatchId } from "./bracket/types";
import type { BracketRound, PointsRow } from "./scoring";

// Eigen puntenwaarden voor de placement-telling (ontkoppeld van de oude
// winnaar-gebaseerde KO_POINTS in scoring.ts). Per ronde: vol = juiste plek,
// half = komt door op een ander vakje. De FINALE is een eigen ronde (de twee
// finalisten, 56/28); de wereldkampioen is een aparte beloning (40) bovenop.
type PlacementRound = "LAST_32" | "LAST_16" | "QUARTER_FINALS" | "SEMI_FINALS" | "FINAL";
const PLACEMENT_FULL: Record<PlacementRound, number> = {
  LAST_32: 8, LAST_16: 14, QUARTER_FINALS: 24, SEMI_FINALS: 36, FINAL: 56,
};
const PLACEMENT_HALF: Record<PlacementRound, number> = {
  LAST_32: 4, LAST_16: 7, QUARTER_FINALS: 12, SEMI_FINALS: 18, FINAL: 28,
};
export const CHAMPION_POINTS = 40;

// Rondes die via placement (vakje-gevuld) gescoord worden — t/m de FINALE
// (de twee finalisten). De wereldkampioen wordt apart geteld (scoreChampion).
export const PLACEMENT_ROUNDS = [
  "LAST_32",
  "LAST_16",
  "QUARTER_FINALS",
  "SEMI_FINALS",
  "FINAL",
] as const satisfies readonly BracketRound[];

export type SlotPair = { home?: string; away?: string };
export type OccupantMap = Map<MatchId, SlotPair>;

// ── Decodeer bracket_picks → fase A/B + bracket ───────────────────────────────
// Houdt exact dezelfde slot-encoding aan als de canonieke loader in
// app/invullen/knockout/page.tsx (GROUP_TOP_2: (rank-1)*12 + groupIdx; LAST_32..
// FINAL: slot = R32-N/R16-N/QF-N/SF-N/F-1). Defensieve groep-check overgeslagen
// hier — de telling vergelijkt sowieso tegen werkelijke plaatsing.
export type RawPick = { round: string; slot: number | null; team_code: string | null };

export function decodeBracketPicks(picks: ReadonlyArray<RawPick>): {
  phaseA: PhaseA;
  phaseB: Set<string>;
  bracket: Bracket;
} {
  const phaseA: PhaseA = {};
  const phaseB = new Set<string>();
  const bracket: Bracket = {};
  const validMatchIds = new Set<string>(ALL_MATCH_IDS);

  for (const p of picks) {
    if (!p.team_code) continue;
    if (p.round === "GROUP_TOP_2") {
      if (typeof p.slot !== "number") continue;
      const rank = Math.floor(p.slot / 12) + 1;
      const groupIdx = p.slot % 12;
      const g = String.fromCharCode("A".charCodeAt(0) + groupIdx);
      if (!isGroupCode(g)) continue;
      phaseA[g] = phaseA[g] ?? {};
      if (rank === 1) phaseA[g]!.rank1 = p.team_code;
      else if (rank === 2) phaseA[g]!.rank2 = p.team_code;
      else if (rank === 3) phaseA[g]!.rank3 = p.team_code;
    } else if (p.round === "BEST_THIRDS") {
      phaseB.add(p.team_code);
    } else if (p.round === "LAST_32" && typeof p.slot === "number") {
      const id = `R32-${p.slot}`;
      if (validMatchIds.has(id)) bracket[id as MatchId] = p.team_code;
    } else if (p.round === "LAST_16" && typeof p.slot === "number") {
      const id = `R16-${p.slot}`;
      if (validMatchIds.has(id)) bracket[id as MatchId] = p.team_code;
    } else if (p.round === "QUARTER_FINALS" && typeof p.slot === "number") {
      const id = `QF-${p.slot}`;
      if (validMatchIds.has(id)) bracket[id as MatchId] = p.team_code;
    } else if (p.round === "SEMI_FINALS" && typeof p.slot === "number") {
      const id = `SF-${p.slot}`;
      if (validMatchIds.has(id)) bracket[id as MatchId] = p.team_code;
    } else if (p.round === "FINAL") {
      bracket["F-1"] = p.team_code;
    }
  }
  return { phaseA, phaseB, bracket };
}

// ── Werkelijke bezetters per vakje ────────────────────────────────────────────
// Uit matches.home_team/away_team, met matches.id == FIFA-match-nummer
// (BRACKET_GRAPH[id].fifaMatchNo). Een undefined kant = nog niet 100% zeker.
export function actualOccupants(
  matchesByFifaNo: ReadonlyMap<number, { home_team: string | null; away_team: string | null }>,
): OccupantMap {
  const out: OccupantMap = new Map();
  for (const matchId of ALL_MATCH_IDS) {
    const node = BRACKET_GRAPH[matchId];
    const m = matchesByFifaNo.get(node.fifaMatchNo);
    if (!m) continue;
    out.set(matchId, {
      home: m.home_team ?? undefined,
      away: m.away_team ?? undefined,
    });
  }
  return out;
}

// ── Voorspelde bezetters per vakje ────────────────────────────────────────────
// R32: via de canonieke computeR32Slots (fase A + FIFA 3rd-routing).
// R16+: de bezetter van een kant = de winnaar-keuze van de voedende wedstrijd
//       (bracket[homeFromMatch] / bracket[awayFromMatch]).
export function predictedOccupants(
  phaseA: PhaseA,
  phaseB: ReadonlySet<string>,
  bracket: Bracket,
  teamGroupMap: TeamGroupMap,
): OccupantMap {
  const r32 = computeR32Slots(phaseA, phaseB, teamGroupMap);
  const out: OccupantMap = new Map();
  for (const matchId of ALL_MATCH_IDS) {
    const node = BRACKET_GRAPH[matchId];
    if (node.round === "LAST_32") {
      out.set(matchId, { home: r32[matchId]?.home, away: r32[matchId]?.away });
    } else {
      out.set(matchId, {
        home: bracket[node.homeFromMatch],
        away: bracket[node.awayFromMatch],
      });
    }
  }
  return out;
}

// ── Placement-telling voor R32..SF ────────────────────────────────────────────
export function scorePlacementPoints(predicted: OccupantMap, actual: OccupantMap): PointsRow[] {
  const rows: PointsRow[] = [];

  for (const round of PLACEMENT_ROUNDS) {
    const matchIds = MATCH_IDS_BY_ROUND[round];

    // Set van alle landen die de deelnemer in deze ronde voorspelde (om "komt
    // door op een ander vakje" te detecteren).
    const predictedInRound = new Set<string>();
    for (const mid of matchIds) {
      const p = predicted.get(mid);
      if (p?.home) predictedInRound.add(p.home);
      if (p?.away) predictedInRound.add(p.away);
    }

    for (const mid of matchIds) {
      const a = actual.get(mid);
      const p = predicted.get(mid);
      for (const side of ["home", "away"] as const) {
        const actualTeam = a?.[side];
        if (!actualTeam) continue; // vakje nog niet 100% zeker gevuld

        let pts = 0;
        if (p?.[side] && p[side] === actualTeam) {
          pts = PLACEMENT_FULL[round]; // juiste plek
        } else if (predictedInRound.has(actualTeam)) {
          pts = PLACEMENT_HALF[round]; // komt door, ander vakje
        }
        if (pts > 0) {
          rows.push({ source: "knockout", ref_id: `${round}:${mid}:${side}`, points: pts });
        }
      }
    }
  }

  return rows;
}

// ── Wereldkampioen (aparte beloning bovenop de finale-plaatsing) ──────────────
// De kampioen kan pas bekend zijn als de finale gespeeld is, dus dit blijft
// resultaat-gebaseerd: voorspelde kampioen (bracket["F-1"]) == werkelijke
// winnaar van de finale → CHAMPION_POINTS (40). Het halen van de finale zelf
// wordt al via de placement-telling (FINAL, 56/28) beloond.
export function scoreChampion(bracket: Bracket, actualChampion: string | null | undefined): PointsRow | null {
  const pick = bracket["F-1"];
  if (!pick || !actualChampion) return null;
  if (pick !== actualChampion) return null;
  return { source: "knockout", ref_id: "FINAL:champion", points: CHAMPION_POINTS };
}

// ── Volledige knock-outtelling voor één deelnemer ─────────────────────────────
export function scoreKnockoutPlacement(
  picks: ReadonlyArray<RawPick>,
  teamGroupMap: TeamGroupMap,
  matchesByFifaNo: ReadonlyMap<number, { home_team: string | null; away_team: string | null }>,
  actualChampion: string | null | undefined,
): PointsRow[] {
  const { phaseA, phaseB, bracket } = decodeBracketPicks(picks);
  const predicted = predictedOccupants(phaseA, phaseB, bracket, teamGroupMap);
  const actual = actualOccupants(matchesByFifaNo);
  const rows = scorePlacementPoints(predicted, actual);
  const champ = scoreChampion(bracket, actualChampion);
  if (champ) rows.push(champ);
  return rows;
}
