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
          <h1 className="text-2xl font-bold mb-1">Knock-out</h1>
          <p className="text-sm text-muted">
            Voorspel het hele knock-out schema in drie stappen. Vul ze in volgorde in —
            stap 2 opent zodra stap 1 af is, stap 3 opent zodra stap 2 af is.
          </p>
        </div>
        <div className="shrink-0 flex flex-row sm:flex-col items-start sm:items-end gap-6 sm:gap-2 text-left sm:text-right">
          {(totalPoints ?? 0) > 0 && (
            <div>
              <div className="text-3xl font-bold tabular-nums text-pitch">{totalPoints}</div>
              <div className="text-xs text-muted">punten</div>
            </div>
          )}
          <div>
            <div className="text-2xl font-bold tabular-nums">
              {s.phaseACount + s.phaseB.size + s.bracketCount}
              <span className="text-base text-muted font-normal">/63</span>
            </div>
            <div className="text-xs text-muted">ingevuld</div>
          </div>
        </div>
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
        <div className="fixed top-4 right-4 z-40 max-w-sm bg-yellow-50 border border-yellow-300 text-yellow-800 rounded-md px-3 py-2 text-xs shadow-lg flex items-start gap-2">
          <span>⚠️</span><span>{s.toast}</span>
        </div>
      )}

      {/* Visuele stappen-indicator met cijfers, voortgangsverbinder en status */}
      <StepProgress
        steps={[
          { num: 1, label: "Top 2 per poule", count: s.phaseACount, total: 24, complete: s.phaseAComplete, active: activePhase === "A" },
          { num: 2, label: "Beste nummers 3", count: s.phaseB.size, total: 8, complete: s.phaseBComplete, active: activePhase === "B", locked: !s.phaseAComplete },
          { num: 3, label: "Winnaars per wedstrijd", count: s.bracketCount, total: 31, complete: s.bracketComplete, active: activePhase === "C", locked: !s.phaseBComplete },
        ]}
        onSelect={(num) => {
          if (num === 1) setActivePhase("A");
          else if (num === 2 && s.phaseAComplete) setActivePhase("B");
          else if (num === 3 && s.phaseBComplete) setActivePhase("C");
        }}
      />

      <div className="bg-surface border border-border rounded-lg overflow-hidden">

        {activePhase === "A" && (
          <>
            <StepHeader
              num={1}
              title="Top 2 per poule"
              subtitle="Voor alle 12 poules: kies wie er volgens jou eerste en tweede wordt. Dat zijn 24 picks."
            />
            <PhaseAPicker
              teamsByGroup={teamsByGroup}
              phaseA={s.phaseA}
              isLocked={isLocked}
              onSetRank={s.setPhaseARank}
              nextFreeRank={s.nextFreeRank}
            />
          </>
        )}
        {activePhase === "B" && (
          <>
            <StepHeader
              num={2}
              title="Beste nummers 3"
              subtitle="Van de 12 nummers 3 plaatsen er 8 zich. Markeer in welke 8 poules de nummer 3 doorgaat naar de knock-out."
            />
            <PhaseBPicker
              teamsByGroup={teamsByGroup}
              phaseA={s.phaseA}
              phaseB={s.phaseB}
              isLocked={isLocked}
              onToggle={s.togglePhaseB}
            />
          </>
        )}
        {activePhase === "C" && (
          <>
            <StepHeader
              num={3}
              title="Winnaars per wedstrijd"
              subtitle="Het complete knock-out schema. Tik op het land dat volgens jou wint."
              legend={[
                { sw: "bg-pitch", text: "winnaar" },
                { sw: "bg-pitch-soft border border-pitch/40", text: "afwijkende keuze t.o.v. het automatische schema" },
                { ico: "▾", text: "tik om af te wijken van het standaard schema en een ander land te kiezen" },
                { ico: "↺", text: "tik om die keuze te wissen" },
              ]}
            />
            <div className="p-3">
              <BracketBuilder
                phaseA={s.phaseA}
                phaseB={s.phaseB}
                bracket={s.bracket}
                overrides={s.overrides}
                isLocked={isLocked}
                teamsByCode={teamsByCode}
                teamGroupMap={teamGroupMap}
                allTeams={allTeams}
                matchDatesByFifaNo={matchDatesByFifaNo}
                onPick={s.setMatchWinner}
                onSetOverride={s.setOverride}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

type LegendItem = { sw?: string; ico?: string; text: string };

function StepHeader({
  num, title, subtitle, legend,
}: {
  num: number;
  title: string;
  subtitle: string;
  legend?: LegendItem[];
}) {
  return (
    <div className="px-5 py-4 border-b border-border bg-bg/30">
      <div className="flex items-center gap-2 mb-1">
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-brand text-white text-xs font-bold">
          {num}
        </span>
        <h2 className="text-base font-bold">{title}</h2>
      </div>
      <p className="text-xs text-muted">{subtitle}</p>
      {legend && legend.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-muted">
          {legend.map((item, i) => (
            <li key={i} className="flex items-center gap-1.5">
              {item.sw && <span className={`inline-block w-4 h-4 rounded ${item.sw}`} aria-hidden />}
              {item.ico && <span className="inline-flex w-4 h-4 items-center justify-center rounded border border-border text-muted text-[10px]" aria-hidden>{item.ico}</span>}
              <span>{item.text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type Step = {
  num: 1 | 2 | 3;
  label: string;
  count: number;
  total: number;
  complete: boolean;
  active: boolean;
  locked?: boolean;
};

function StepProgress({ steps, onSelect }: { steps: Step[]; onSelect: (num: 1 | 2 | 3) => void }) {
  return (
    <div className="bg-surface border border-border rounded-lg p-3 sm:p-4">
      <div className="flex items-center gap-1 sm:gap-2">
        {steps.map((step, i) => (
          <div key={step.num} className="flex items-center gap-1 sm:gap-2 flex-1 min-w-0">
            <button
              type="button"
              disabled={step.locked}
              onClick={() => onSelect(step.num)}
              className={`flex-1 min-w-0 px-2 sm:px-3 py-2 rounded-md border transition text-left ${
                step.active
                  ? "border-brand bg-brand-soft"
                  : step.locked
                  ? "border-border bg-bg/30 cursor-not-allowed opacity-50"
                  : "border-border bg-bg hover:border-brand hover:bg-bg/60"
              }`}
            >
              <div className="flex items-center gap-1.5 mb-0.5">
                <span
                  className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-bold shrink-0 ${
                    step.complete
                      ? "bg-pitch text-white"
                      : step.active
                      ? "bg-brand text-white"
                      : "bg-border text-muted"
                  }`}
                >
                  {step.complete ? "✓" : step.num}
                </span>
                <span className={`text-[11px] sm:text-xs font-semibold truncate ${step.active ? "text-brand" : "text-fg"}`}>
                  {step.label}
                </span>
              </div>
              <div className="text-[10px] tabular-nums text-muted ml-6 sm:ml-7">
                {step.count}/{step.total}
              </div>
            </button>
            {i < steps.length - 1 && (
              <div className={`h-0.5 w-2 sm:w-3 shrink-0 ${steps[i].complete ? "bg-pitch" : "bg-border"}`} aria-hidden />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
