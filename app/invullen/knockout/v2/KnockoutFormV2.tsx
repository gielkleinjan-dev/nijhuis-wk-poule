"use client";

import { useMemo, useState } from "react";
import type { GroupCode } from "@/lib/bracket/types";
import { GROUP_CODES } from "@/lib/bracket/types";
import { PhaseAPicker } from "./PhaseAPicker";
import { PhaseBPicker } from "./PhaseBPicker";
import { BracketBuilder } from "./BracketBuilder";
import { useBracketState, type V2InitialPicks } from "./useBracketState";

type Team = { code: string; name: string; group: GroupCode };

type Phase = "A" | "B" | "C";

export default function KnockoutFormV2({
  teams,
  initial,
  isLocked,
  totalPoints,
  matchDatesByFifaNo,
}: {
  teams: Team[];
  initial: V2InitialPicks;
  isLocked: boolean;
  totalPoints?: number;
  matchDatesByFifaNo: ReadonlyMap<number, Date>;
}) {
  const teamGroupMap = useMemo(() => {
    const m = new Map<string, GroupCode>();
    for (const t of teams) m.set(t.code, t.group);
    return m;
  }, [teams]);

  const teamsByCode = useMemo(() => {
    const m = new Map<string, { code: string; name: string }>();
    for (const t of teams) m.set(t.code, { code: t.code, name: t.name });
    return m;
  }, [teams]);

  const teamsByGroup = useMemo(() => {
    const m = new Map<GroupCode, Team[]>();
    for (const g of GROUP_CODES) m.set(g, []);
    for (const t of teams) m.get(t.group)?.push(t);
    return m;
  }, [teams]);

  const allTeams = useMemo(
    () => [...teams].sort((a, b) => a.name.localeCompare(b.name, "nl")),
    [teams],
  );

  const s = useBracketState(initial, teamGroupMap);

  const [activePhase, setActivePhase] = useState<Phase>(() => {
    if (!s.phaseAComplete) return "A";
    if (!s.phaseBComplete) return "B";
    return "C";
  });

  const anySaving = Object.values(s.saveStates).some((x) => x === "saving");
  const anyError = Object.values(s.saveStates).some((x) => x === "error");

  return (
    <div className="space-y-4">
      <div className="bg-surface border border-border rounded-lg p-5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold mb-1">Knock-out — bracket</h1>
          <p className="text-sm text-muted">
            Drie stappen: kies eerst per poule nummer 1 en 2, dan in welke 8 poules de nummer 3
            doorgaat, daarna vul je per wedstrijd de winnaar in. Je mag in elke wedstrijd ook een
            ander land kiezen via de dropdown ▾.
          </p>
        </div>
        {(totalPoints ?? 0) > 0 && (
          <div className="text-right shrink-0">
            <div className="text-3xl font-bold tabular-nums text-pitch">{totalPoints}</div>
            <div className="text-xs text-muted">punten</div>
          </div>
        )}
      </div>

      {isLocked && (
        <div className="bg-brand-soft border border-brand/20 rounded-lg p-4 text-sm">
          De poule is gesloten — je voorspellingen zijn vastgezet.
        </div>
      )}

      <div className="text-xs h-4 flex justify-end px-1">
        {anyError ? (
          <span className="text-brand font-semibold">opslaan mislukt — probeer opnieuw</span>
        ) : anySaving ? (
          <span className="text-muted">opslaan…</span>
        ) : null}
      </div>

      {s.toast && (
        <div className="bg-yellow-50 border border-yellow-300 text-yellow-800 rounded-md px-3 py-2 text-xs flex items-start gap-2">
          <span>⚠️</span><span>{s.toast}</span>
        </div>
      )}

      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        <nav className="flex border-b border-border text-sm">
          <PhaseTab
            label="1. Top 2 per poule"
            count={`${s.phaseACount}/24`}
            active={activePhase === "A"}
            complete={s.phaseAComplete}
            onClick={() => setActivePhase("A")}
          />
          <PhaseTab
            label="2. Beste nrs 3"
            count={`${s.phaseB.size}/8`}
            active={activePhase === "B"}
            complete={s.phaseBComplete}
            disabled={!s.phaseAComplete}
            onClick={() => s.phaseAComplete && setActivePhase("B")}
          />
          <PhaseTab
            label="3. Bracket"
            count={`${s.bracketCount}/31`}
            active={activePhase === "C"}
            complete={s.bracketComplete}
            disabled={!s.phaseBComplete}
            onClick={() => s.phaseBComplete && setActivePhase("C")}
          />
        </nav>

        {activePhase === "A" && (
          <PhaseAPicker
            teamsByGroup={teamsByGroup}
            phaseA={s.phaseA}
            isLocked={isLocked}
            onSetRank={s.setPhaseARank}
            nextFreeRank={s.nextFreeRank}
          />
        )}
        {activePhase === "B" && (
          <PhaseBPicker
            teamsByGroup={teamsByGroup}
            phaseA={s.phaseA}
            phaseB={s.phaseB}
            isLocked={isLocked}
            onToggle={s.togglePhaseB}
          />
        )}
        {activePhase === "C" && (
          <div className="p-3">
            <BracketBuilder
              phaseA={s.phaseA}
              phaseB={s.phaseB}
              bracket={s.bracket}
              isLocked={isLocked}
              teamsByCode={teamsByCode}
              teamGroupMap={teamGroupMap}
              allTeams={allTeams}
              matchDatesByFifaNo={matchDatesByFifaNo}
              onPick={s.setMatchWinner}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function PhaseTab({
  label, count, active, complete, disabled, onClick,
}: {
  label: string;
  count: string;
  active: boolean;
  complete: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex-1 px-3 py-3 text-left transition border-b-2 ${
        active
          ? "border-brand text-fg font-semibold bg-bg/30"
          : disabled
          ? "border-transparent text-muted opacity-40 cursor-not-allowed"
          : "border-transparent text-muted hover:text-fg hover:bg-bg/30"
      }`}
    >
      <div className="flex items-center gap-2">
        <span>{label}</span>
        {complete && <span className="text-pitch text-xs">✓</span>}
      </div>
      <div className="text-[10px] tabular-nums text-muted">{count}</div>
    </button>
  );
}
