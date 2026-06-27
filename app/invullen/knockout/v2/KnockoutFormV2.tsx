"use client";

import { useMemo, useState } from "react";
import type { GroupCode } from "@/lib/bracket/types";
import { GROUP_CODES } from "@/lib/bracket/types";
import type { OccupantMap } from "@/lib/scoring-knockout";
import { PhaseAPicker } from "./PhaseAPicker";
import { PhaseBPicker } from "./PhaseBPicker";
import { BracketBuilder } from "./BracketBuilder";
import { useBracketState, type V2InitialPicks } from "./useBracketState";
import SaveStatusBadge from "@/app/components/SaveStatusBadge";
import OnboardingTip from "@/app/components/OnboardingTip";
import TodayButton from "@/app/components/TodayButton";

type Team = { code: string; name: string; group: GroupCode };

type Phase = "A" | "B" | "C";

export default function KnockoutFormV2({
  teams,
  initial,
  isLocked,
  totalPoints,
  matchDatesByFifaNo,
  actualBySlot,
  ptsBySlot,
}: {
  teams: Team[];
  initial: V2InitialPicks;
  isLocked: boolean;
  totalPoints?: number;
  matchDatesByFifaNo: ReadonlyMap<number, Date>;
  actualBySlot: OccupantMap;
  ptsBySlot: ReadonlyMap<string, number>;
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

  // ── Gesloten weergave: bracket is hoofdscherm, stap 1 & 2 ingeklapt ──────────
  // Tijdens het invullen (niet-locked) blijft de stappen-flow hieronder.
  if (isLocked) {
    return (
      <div className="space-y-4">
        <div className="tab-hero bg-surface border border-border rounded-lg p-5">
          <div className="flex items-baseline justify-between gap-3 mb-1">
            <h1 className="text-2xl font-bold leading-tight">Knock-out</h1>
            {/* Gesloten poule: iedereen heeft alles ingevuld, dus 63/63 zegt niks
                meer. Alleen de punten, rechts, in de hero-tekstkleur (wit). */}
            {(totalPoints ?? 0) > 0 && (
              <div className="shrink-0 text-right leading-tight">
                <div className="text-xl font-bold tabular-nums">{totalPoints}</div>
                <div className="text-[10px] text-muted">punten</div>
              </div>
            )}
          </div>
        </div>

        {/* Het knock-out schema zelf (eigen ronde-kaarten met werkelijke uitslag + punten) */}
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
          actualBySlot={actualBySlot}
          ptsBySlot={ptsBySlot}
          onPick={s.setMatchWinner}
          onSetOverride={s.setOverride}
        />

        {/* Stap 1 & 2 — als historische context, ingeklapt */}
        <details className="group bg-surface border border-border rounded-lg overflow-hidden">
          <summary className="px-5 py-4 cursor-pointer select-none flex items-center justify-between gap-3 hover:bg-bg/30">
            <div>
              <div className="text-base font-bold">Mijn groepsvoorspelling</div>
              <div className="text-xs text-muted">
                Je top 2 per poule en je beste nummers 3 — de basis waarop dit schema is opgebouwd.
              </div>
            </div>
            <span className="text-muted text-sm shrink-0 transition-transform group-open:rotate-180" aria-hidden>▾</span>
          </summary>
          <div className="border-t border-border">
            <div className="px-5 py-3 border-b border-border bg-bg/30">
              <h3 className="text-sm font-bold">Top 2 per poule</h3>
              <p className="text-xs text-muted">De nummer 1 en 2 die jij per poule voorspelde.</p>
            </div>
            <PhaseAPicker
              teamsByGroup={teamsByGroup}
              phaseA={s.phaseA}
              isLocked={isLocked}
              onSetRank={s.setPhaseARank}
              nextFreeRank={s.nextFreeRank}
            />
            <div className="px-5 py-3 border-y border-border bg-bg/30">
              <h3 className="text-sm font-bold">Beste nummers 3</h3>
              <p className="text-xs text-muted">De 8 poules waarvan jij de nummer 3 liet doorgaan.</p>
            </div>
            <PhaseBPicker
              teamsByGroup={teamsByGroup}
              phaseA={s.phaseA}
              phaseB={s.phaseB}
              isLocked={isLocked}
              onToggle={s.togglePhaseB}
            />
          </div>
        </details>

        <TodayButton />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="tab-hero bg-surface border border-border rounded-lg p-5">
        <div className="flex items-baseline justify-between gap-3 mb-1">
          <h1 className="text-2xl font-bold leading-tight">Knock-out</h1>
          <div className="shrink-0 text-right leading-tight flex items-baseline gap-3">
            {(totalPoints ?? 0) > 0 && (
              <div>
                <div className="text-xl font-bold tabular-nums text-pitch">{totalPoints}</div>
                <div className="text-[10px] text-muted">punten</div>
              </div>
            )}
            <div>
              <div className="text-xl font-bold tabular-nums">
                {s.phaseACount + s.phaseB.size + s.bracketCount}<span className="text-sm text-muted font-normal">/63</span>
              </div>
              <div className="text-[10px] text-muted">ingevuld</div>
            </div>
          </div>
        </div>
        <div className="text-sm text-muted">
          {isLocked ? (
            <p>
              Jouw vastgezette knock-out picks. Gebruik de tabs hieronder om te bladeren. Je verdient
              punten voor elk land dat op de <span className="font-medium text-fg">juiste plek</span> in
              jouw schema uitkomt — vanaf de laatste 32 t/m de finale, plus de wereldkampioen.
            </p>
          ) : (
            <div className="space-y-2">
              <p>
                In drie stappen voorspel je het knock-out schema. Elke volgende stap opent zodra
                de vorige klaar is.
              </p>
              <p>
                <span className="font-medium text-fg">Stap 1 en 2</span> bepalen welke 32 landen
                aan jouw knock-out beginnen — de nummer 1 en 2 per poule en jouw 8 beste nummers 3.
                Daarop bouwen we automatisch jouw persoonlijke schema.
              </p>
              <p>
                Je verdient punten voor elk land dat jij op de{" "}
                <span className="font-medium text-fg">juiste plek</span> in het schema voorspelt —
                vanaf de laatste 32 t/m de finale, plus de wereldkampioen. Juiste plek = volle punten,
                juist land op de verkeerde plek = halve punten. In{" "}
                <span className="font-medium text-fg">stap 3</span> kies je per wedstrijd wie doorgaat,
                zodat we weten welke landen jij verder in het schema verwacht.
              </p>
            </div>
          )}
        </div>
      </div>


      {!isLocked && (
        <div className="text-xs h-5 flex justify-end px-1">
          <SaveStatusBadge saveStates={s.saveStates} />
        </div>
      )}

      {s.toast && (
        <div className="fixed top-4 right-4 z-40 max-w-sm bg-yellow-50 border border-yellow-300 text-yellow-800 rounded-md px-3 py-2 text-xs shadow-lg flex items-start gap-2">
          <span>⚠️</span><span>{s.toast}</span>
        </div>
      )}

      {/* Visuele stappen-indicator met cijfers, voortgangsverbinder en status */}
      <StepProgress
        isLocked={isLocked}
        steps={[
          { num: 1, label: "Top 2 per poule",         shortLabel: "Top 2",    count: s.phaseACount,   total: 24, complete: s.phaseAComplete, active: activePhase === "A" },
          { num: 2, label: "Beste nummers 3",         shortLabel: "Beste 3e", count: s.phaseB.size,   total: 8,  complete: s.phaseBComplete, active: activePhase === "B", locked: !s.phaseAComplete },
          { num: 3, label: "Winnaars per wedstrijd",  shortLabel: "Winnaars", count: s.bracketCount,  total: 31, complete: s.bracketComplete, active: activePhase === "C", locked: !s.phaseBComplete },
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
              subtitle="Wijs per poule de nummer 1 en de nummer 2 aan. Samen 24 landen."
            />
            {!isLocked && (
              <div className="px-3 pt-3">
                <OnboardingTip id="ko-step-a">
                  <strong>Tip:</strong> tik op een land — eerste tik wordt jouw
                  <strong> nummer 1</strong> (donkergroen), tweede tik wordt
                  <strong> nummer 2</strong> (lichter groen). Nogmaals tikken
                  op een gemarkeerd land wist de keuze.
                </OnboardingTip>
              </div>
            )}
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
              subtitle="Niet elke nummer 3 plaatst zich — alleen de 8 beste. Markeer in welke 8 poules dat lukt."
            />
            {!isLocked && (
              <div className="px-3 pt-3">
                <OnboardingTip id="ko-step-b">
                  <strong>Tip:</strong> tik op een land om 'm te markeren als
                  jouw nummer 3 — hij krijgt een oranje <strong>3e</strong>-badge.
                  Nogmaals tikken wist de markering. In elke poule staan twee
                  kandidaten klikbaar; de andere twee zijn jouw 1 en 2 uit
                  stap 1.
                </OnboardingTip>
              </div>
            )}
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
              subtitle={isLocked
                ? "Jouw persoonlijke knock-out schema — vastgezet. Punten vallen voor elk land op de juiste plek, t/m de finale en de wereldkampioen."
                : "Hieronder staat jouw persoonlijke knock-out schema, opgebouwd uit stap 1 en 2. Kies per wedstrijd wie doorgaat — zo bepaal je welke landen jij verder in het schema verwacht. Elk land op de juiste plek levert punten op, t/m de finale. Eigenwijs? Extra spreiding? Je kunt je automatische schema op alle plaatsen aanpassen door een ander land te selecteren."}
              legend={[
                { sw: "bg-pitch", text: "winnaar van de wedstrijd" },
                { sw: "bg-pitch-soft border border-pitch/40", text: "ander land op deze plek gezet" },
                ...(!isLocked ? [
                  { ico: "▾", text: "kies een ander land voor deze plek" } as LegendItem,
                  { ico: "↺", text: "wis deze keuze" } as LegendItem,
                ] : []),
              ]}
            />
            <div className="p-3 space-y-3">
              {!isLocked && (
                <OnboardingTip id="ko-step-c">
                  <strong>Tip:</strong> tik op een land om 'm als winnaar te
                  kiezen — wordt donkergroen. Wil je een ander land op die
                  plek? Klik op het <strong>pijltje ▾</strong> en kies. De
                  <strong> ↺</strong> wist je keuze.
                </OnboardingTip>
              )}
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
                actualBySlot={actualBySlot}
                ptsBySlot={ptsBySlot}
                onPick={s.setMatchWinner}
                onSetOverride={s.setOverride}
              />
            </div>
          </>
        )}
      </div>
      <TodayButton />
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
        <ul className="mt-3 space-y-1.5 text-xs text-muted">
          {legend.map((item, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span className="w-6 h-6 flex items-center justify-center shrink-0">
                {item.sw && <span className={`inline-block w-5 h-5 rounded ${item.sw}`} aria-hidden />}
                {item.ico && <span className="inline-flex w-6 h-6 items-center justify-center rounded border border-border text-fg text-sm leading-none" aria-hidden>{item.ico}</span>}
              </span>
              <span className="pt-0.5">{item.text}</span>
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
  shortLabel: string;
  count: number;
  total: number;
  complete: boolean;
  active: boolean;
  locked?: boolean;
};

function StepProgress({
  steps,
  onSelect,
  isLocked,
}: {
  steps: Step[];
  onSelect: (num: 1 | 2 | 3) => void;
  isLocked?: boolean;
}) {
  if (isLocked) {
    // Locked: toon als simpele navigatie-tabs zonder stap-framing
    return (
      <div className="bg-surface border border-border rounded-lg p-3 sm:p-4">
        <div className="flex items-center gap-2">
          {steps.map((step) => (
            <button
              key={step.num}
              type="button"
              onClick={() => onSelect(step.num)}
              className={`flex-1 min-w-0 px-3 py-2 rounded-md border transition text-center ${
                step.active
                  ? "border-brand bg-brand-soft text-brand"
                  : "border-border bg-bg hover:border-brand/50 text-muted hover:text-fg"
              }`}
            >
              <div className={`text-xs font-semibold truncate`}>
                <span className="sm:hidden">{step.shortLabel}</span>
                <span className="hidden sm:inline">{step.label}</span>
              </div>
              <div className="text-[10px] tabular-nums mt-0.5 opacity-70">
                {step.count}/{step.total} ✓
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Niet-locked: originele stappen-weergave
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
                <span className={`text-[11px] sm:text-xs font-semibold ${step.active ? "text-brand" : "text-fg"}`}>
                  <span className="sm:hidden">{step.shortLabel}</span>
                  <span className="hidden sm:inline">{step.label}</span>
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
