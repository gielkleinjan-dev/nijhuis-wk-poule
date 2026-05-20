"use client";

import { useCallback, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { smartClearAfterMatchChange, type PhaseA, type Bracket } from "@/lib/bracket/cascade";
import type { GroupCode, MatchId } from "@/lib/bracket/types";
import { useDebouncedSave } from "./useDebouncedSave";

export type V2InitialPicks = {
  phaseA: PhaseA;
  phaseB: Set<string>;
  bracket: Bracket;
};

export function useBracketState(
  initial: V2InitialPicks,
  teamGroupMap: ReadonlyMap<string, GroupCode>,
) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [phaseA, setPhaseA] = useState<PhaseA>(initial.phaseA);
  const [phaseB, setPhaseB] = useState<Set<string>>(initial.phaseB);
  const [bracket, setBracket] = useState<Bracket>(initial.bracket);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((t) => (t === msg ? null : t)), 4000);
  }, []);

  const { states, schedule } = useDebouncedSave<unknown>(async (key, payload) => {
    if (key === "phaseA") {
      const { error } = await supabase.rpc("bracket_v2_save_phase_a", { p_picks: payload });
      return { ok: !error };
    }
    if (key === "phaseB") {
      const { error } = await supabase.rpc("bracket_v2_save_phase_b", { p_teams: payload });
      return { ok: !error };
    }
    if (key.startsWith("match:")) {
      const { matchId, winner } = payload as { matchId: MatchId; winner: string | undefined };
      const { error } = await supabase.rpc("bracket_v2_save_match", {
        p_match_id: matchId,
        p_winner: winner ?? null,
        p_clear_descendants: [],
      });
      return { ok: !error };
    }
    return { ok: false };
  });

  // ── Fase A — rank 1 of 2 per groep ────────────────────────────────────────
  const setPhaseARank = useCallback(
    (group: GroupCode, rank: 1 | 2, teamCode: string | undefined) => {
      const prev = phaseA;
      const entry = { ...(prev[group] ?? {}) };

      if (teamCode == null) {
        if (rank === 1) delete entry.rank1;
        else delete entry.rank2;
      } else {
        // Team kan binnen één groep niet beide ranks vullen
        if (entry.rank1 === teamCode) delete entry.rank1;
        if (entry.rank2 === teamCode) delete entry.rank2;
        if (rank === 1) entry.rank1 = teamCode;
        else entry.rank2 = teamCode;
      }

      const nextA: PhaseA = { ...prev, [group]: entry };

      // Als nieuw rank1/2 land eerder als "3e doorgaande" gemarkeerd was, daar weg
      let nextB = phaseB;
      if (teamCode && phaseB.has(teamCode)) {
        nextB = new Set(phaseB);
        nextB.delete(teamCode);
        setPhaseB(nextB);
        schedule("phaseB", Array.from(nextB));
      }

      setPhaseA(nextA);
      schedule("phaseA", nextA);

      if (Object.values(bracket).filter(Boolean).length > 0) {
        showToast("Poule-keuzes gewijzigd — check je bracket.");
      }
    },
    [phaseA, phaseB, bracket, schedule, showToast],
  );

  const nextFreeRank = useCallback(
    (group: GroupCode): 1 | 2 | null => {
      const e = phaseA[group] ?? {};
      if (!e.rank1) return 1;
      if (!e.rank2) return 2;
      return null;
    },
    [phaseA],
  );

  // ── Fase B — "3e doorgaande" markering per groep ──────────────────────────
  // Click-UX: per groep maximaal 1 markering, totaal maximaal 8.
  const togglePhaseB = useCallback(
    (teamCode: string) => {
      const groupOfNew = teamGroupMap.get(teamCode);
      const next = new Set(phaseB);

      if (next.has(teamCode)) {
        next.delete(teamCode);
      } else {
        if (next.size >= 8) return;
        // Verwijder eventueel ander team uit dezelfde groep (max 1 per groep)
        if (groupOfNew) {
          for (const t of Array.from(next)) {
            if (teamGroupMap.get(t) === groupOfNew) next.delete(t);
          }
        }
        next.add(teamCode);
      }

      setPhaseB(next);
      schedule("phaseB", Array.from(next));

      if (Object.values(bracket).filter(Boolean).length > 0) {
        showToast("Selectie 3e doorgaande gewijzigd — check je bracket.");
      }
    },
    [phaseB, bracket, teamGroupMap, schedule, showToast],
  );

  // ── Bracket — winnaar per wedstrijd ───────────────────────────────────────
  // Wanneer een winnaar verandert, kijken we downstream of latere matches een
  // winnaar hebben staan die niet meer geldig is (= geen kandidaat meer). Die
  // worden gewist en de gebruiker krijgt een toast met het aantal opgeschoonde
  // matches. Een eigen explicit override van de gebruiker downstream kan zo
  // ook worden gewist als die niet meer mogelijk is — dan moet hij opnieuw
  // kiezen, wat correcter is dan een onmogelijk land laten staan.
  const setMatchWinner = useCallback(
    (matchId: MatchId, winner: string | undefined) => {
      const { bracket: nextBracket, cleared } = smartClearAfterMatchChange(
        matchId, winner, bracket, phaseA, phaseB, teamGroupMap,
      );
      setBracket(nextBracket);
      schedule(`match:${matchId}`, { matchId, winner });
      // De gewiste downstream matches ook server-side wissen
      for (const id of cleared) {
        schedule(`match:${id}`, { matchId: id, winner: undefined });
      }
      if (cleared.length > 0) {
        showToast(
          `${cleared.length} latere wedstrijd${cleared.length > 1 ? "en zijn" : " is"} gewist — winnaar was niet meer mogelijk.`,
        );
      }
    },
    [bracket, phaseA, phaseB, teamGroupMap, schedule, showToast],
  );

  const phaseACount = useMemo(() => {
    let n = 0;
    for (const g of Object.values(phaseA)) {
      if (g?.rank1) n++;
      if (g?.rank2) n++;
    }
    return n;
  }, [phaseA]);

  const phaseAComplete = phaseACount === 24;
  const phaseBComplete = phaseB.size === 8;
  const bracketCount = Object.values(bracket).filter(Boolean).length;
  const bracketComplete = bracketCount === 31;

  return {
    phaseA, phaseB, bracket,
    phaseACount, phaseAComplete,
    phaseBComplete,
    bracketCount, bracketComplete,
    setPhaseARank, nextFreeRank,
    togglePhaseB,
    setMatchWinner,
    saveStates: states,
    toast,
  };
}
