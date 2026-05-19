"use client";

import { useCallback, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { smartClear, smartClearAfterMatchChange, type PhaseA, type Bracket } from "@/lib/bracket/cascade";
import type { GroupCode, MatchId } from "@/lib/bracket/types";
import { useDebouncedSave } from "./useDebouncedSave";

export type V2InitialPicks = {
  phaseA: PhaseA;
  phaseB: Set<string>;
  bracket: Bracket;
};

export function useBracketState(initial: V2InitialPicks, teamGroupMap: ReadonlyMap<string, GroupCode>) {
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
      const { matchId, winner, clear } = payload as { matchId: MatchId; winner: string | undefined; clear: MatchId[] };
      const { error } = await supabase.rpc("bracket_v2_save_match", {
        p_match_id: matchId,
        p_winner: winner ?? null,
        p_clear_descendants: clear,
      });
      return { ok: !error };
    }
    return { ok: false };
  });

  // Centrale helper: bereken nieuwe phase A + B state, cascade-clear de bracket,
  // en save alles. Werkt buiten setState-updaters om strict-mode dubbele effects
  // te vermijden.
  const commitPhaseChange = useCallback(
    (nextA: PhaseA, nextB: Set<string>, opts?: { saveA?: boolean; saveB?: boolean }) => {
      setPhaseA(nextA);
      setPhaseB(nextB);
      if (opts?.saveA !== false) schedule("phaseA", nextA);
      if (opts?.saveB !== false) schedule("phaseB", Array.from(nextB));

      const { bracket: nextBracket, cleared } = smartClear(bracket, nextA, nextB, teamGroupMap);
      if (cleared.length > 0) {
        setBracket(nextBracket);
        for (const id of cleared) {
          schedule(`match:${id}`, { matchId: id, winner: undefined, clear: [] });
        }
        showToast(`${cleared.length} bracket-keuze${cleared.length > 1 ? "s" : ""} gewist — kandidaten zijn veranderd.`);
      }
    },
    [bracket, teamGroupMap, schedule, showToast],
  );

  const setPhaseARank = useCallback(
    (group: GroupCode, rank: 1 | 2, teamCode: string | undefined) => {
      const nextA: PhaseA = { ...phaseA, [group]: { ...phaseA[group] } };
      const entry = nextA[group]!;
      if (teamCode == null) {
        if (rank === 1) delete entry.rank1;
        else delete entry.rank2;
      } else {
        // Team kan niet tweemaal in dezelfde groep zitten
        if (rank === 1 && entry.rank2 === teamCode) delete entry.rank2;
        if (rank === 2 && entry.rank1 === teamCode) delete entry.rank1;
        if (rank === 1) entry.rank1 = teamCode;
        else entry.rank2 = teamCode;
      }
      // Een team kan niet tegelijk top-2 én best-3 zijn
      let nextB = phaseB;
      if (teamCode && phaseB.has(teamCode)) {
        nextB = new Set(phaseB);
        nextB.delete(teamCode);
      }
      commitPhaseChange(nextA, nextB);
    },
    [phaseA, phaseB, commitPhaseChange],
  );

  const togglePhaseB = useCallback(
    (teamCode: string) => {
      const nextB = new Set(phaseB);
      if (nextB.has(teamCode)) {
        nextB.delete(teamCode);
      } else {
        if (nextB.size >= 8) return;
        nextB.add(teamCode);
      }
      commitPhaseChange(phaseA, nextB, { saveA: false });
    },
    [phaseA, phaseB, commitPhaseChange],
  );

  const setMatchWinner = useCallback(
    (matchId: MatchId, winner: string | undefined) => {
      const { bracket: nextBracket, cleared } = smartClearAfterMatchChange(
        matchId, winner, bracket, phaseA, phaseB, teamGroupMap,
      );
      setBracket(nextBracket);
      schedule(`match:${matchId}`, { matchId, winner, clear: cleared });
      for (const id of cleared) {
        schedule(`match:${id}`, { matchId: id, winner: undefined, clear: [] });
      }
      if (cleared.length > 0) {
        showToast(`${cleared.length} latere wedstrijd${cleared.length > 1 ? "en zijn" : " is"} gewist — winnaar veranderd.`);
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
    setPhaseARank, togglePhaseB, setMatchWinner,
    saveStates: states,
    toast,
  };
}
