"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import PlayerCombobox from "@/app/components/PlayerCombobox";

type NLProgress =
  | "GROUP_STAGE"
  | "LAST_32"
  | "LAST_16"
  | "QUARTER_FINALS"
  | "SEMI_FINALS"
  | "FINAL_LOSER"
  | "CHAMPION";

const NL_PROGRESS_OPTIONS: { value: NLProgress; label: string }[] = [
  { value: "GROUP_STAGE",     label: "Uitgeschakeld in de groepsfase" },
  { value: "LAST_32",         label: "Uitgeschakeld in de 1/16e finale" },
  { value: "LAST_16",         label: "Uitgeschakeld in de 1/8e finale" },
  { value: "QUARTER_FINALS",  label: "Uitgeschakeld in de kwartfinale" },
  { value: "SEMI_FINALS",     label: "Uitgeschakeld in de halve finale" },
  { value: "FINAL_LOSER",     label: "Verliest de finale (tweede plaats)" },
  { value: "CHAMPION",        label: "Wereldkampioen" },
];

type BonusValues = {
  top_scorer: string;
  total_goals_tiebreak: number | null;
  total_yellow_cards_tiebreak: number | null;
  nl_top_scorer: string;
  nl_total_goals: number | null;
  nl_progress: NLProgress | null;
};
type SaveState = "idle" | "saving" | "saved" | "error";

// Gemeenschappelijke topscorer-sectie (gebruikt voor zowel toernooi-topscorer als NL-topscorer)
function TopScorerSection({
  label, hint, value, disabled, actual, onChange, restrictToTla,
}: {
  label: string;
  hint: string;
  value: string;
  disabled: boolean;
  actual: string | null;
  onChange: (name: string) => void;
  restrictToTla?: string;
}) {
  return (
    <section className="bg-surface border border-border rounded-lg p-5 space-y-2">
      <span className="block font-semibold mb-1 flex items-center gap-2">
        {label}
        <span className="text-xs font-normal bg-pitch-soft text-pitch px-1.5 py-0.5 rounded">10 pt exact</span>
      </span>
      <span className="block text-xs text-muted mb-2">{hint}</span>
      <PlayerCombobox
        value={value}
        disabled={disabled}
        onChange={onChange}
        restrictToTla={restrictToTla}
        showAllOnFocus={!!restrictToTla}
      />
      {actual && (() => {
        const correct = value?.trim().toLowerCase() === actual.trim().toLowerCase();
        const filled = !!value?.trim();
        return (
          <div className="flex items-center gap-2 pt-1">
            <span className="text-xs text-muted">Uitslag:</span>
            <span className="text-sm font-bold">{actual}</span>
            {correct ? (
              <span className="text-xs font-bold text-pitch bg-pitch-soft px-1.5 py-0.5 rounded">+10 pt</span>
            ) : filled ? (
              <span className="text-xs text-brand">mis</span>
            ) : null}
          </div>
        );
      })()}
    </section>
  );
}

function ProgressQuestion({
  value, disabled, actual, onChange,
}: {
  value: NLProgress | null;
  disabled: boolean;
  actual: NLProgress | null;
  onChange: (v: NLProgress | null) => void;
}) {
  const actualIdx = actual ? NL_PROGRESS_OPTIONS.findIndex((o) => o.value === actual) : -1;
  const valueIdx  = value  ? NL_PROGRESS_OPTIONS.findIndex((o) => o.value === value) : -1;
  const diff = actualIdx >= 0 && valueIdx >= 0 ? Math.abs(actualIdx - valueIdx) : null;
  const ptsEarned = diff === 0 ? 10 : diff === 1 ? 5 : null;

  return (
    <section className="bg-surface border border-border rounded-lg p-5 space-y-2">
      <span className="block font-semibold mb-1 flex items-center gap-2 flex-wrap">
        Hoe ver komt het Nederlands elftal?
        <span className="text-xs font-normal bg-pitch-soft text-pitch px-1.5 py-0.5 rounded">10 pt exact</span>
        <span className="text-xs font-normal bg-pitch-soft text-pitch px-1.5 py-0.5 rounded">5 pt 1 ronde naast</span>
      </span>
      <span className="block text-xs text-muted mb-2">
        Kies tot welke ronde Oranje volgens jou komt.
      </span>
      <select
        value={value ?? ""}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value === "" ? null : (e.target.value as NLProgress))}
        className="w-full sm:w-80 border border-border bg-surface rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand disabled:opacity-50"
      >
        <option value="">— maak een keuze —</option>
        {NL_PROGRESS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {actual && (
        <div className="flex items-center gap-2 pt-1">
          <span className="text-xs text-muted">Uitslag:</span>
          <span className="text-sm font-bold">
            {NL_PROGRESS_OPTIONS.find((o) => o.value === actual)?.label ?? actual}
          </span>
          {ptsEarned != null ? (
            <span className="text-xs font-bold text-pitch bg-pitch-soft px-1.5 py-0.5 rounded">+{ptsEarned} pt</span>
          ) : value != null ? (
            <span className="text-xs text-brand">mis</span>
          ) : null}
        </div>
      )}
    </section>
  );
}

function NumberQuestion({
  label,
  hint,
  value,
  disabled,
  placeholder,
  isDecider,
  exactPts,
  closePts,
  actual,
  onChange,
}: {
  label: string;
  hint: string;
  value: number | null;
  disabled: boolean;
  placeholder: string;
  isDecider?: boolean;
  exactPts: number;
  closePts: number;
  actual?: number | null;
  onChange: (v: number | null) => void;
}) {
  const diff = actual != null && value != null ? Math.abs(actual - value) : null;
  const ptsEarned =
    diff === 0 ? exactPts : diff != null && diff <= 3 ? closePts : null;

  return (
    <section className="bg-surface border border-border rounded-lg p-5 space-y-2">
      <label className="block">
        <span className="flex items-center gap-2 font-semibold mb-1 flex-wrap">
          {label}
          <span className="text-xs font-normal bg-pitch-soft text-pitch px-1.5 py-0.5 rounded">{exactPts} pt exact</span>
          <span className="text-xs font-normal bg-pitch-soft text-pitch px-1.5 py-0.5 rounded">{closePts} pt ±3</span>
          {isDecider && (
            <span className="text-xs font-normal bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded">beslisser</span>
          )}
        </span>
        <span className="block text-xs text-muted mb-2">{hint}</span>
        <div className="flex items-center gap-4 flex-wrap">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            value={value ?? ""}
            disabled={disabled}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, "").slice(0, 4);
              onChange(digits === "" ? null : parseInt(digits, 10));
            }}
            placeholder={placeholder}
            className="w-24 sm:w-32 border border-border bg-surface rounded-md px-3 py-2.5 text-lg font-bold text-center focus:outline-none focus:ring-2 focus:ring-brand disabled:opacity-50"
          />
          {actual != null && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted">Uitslag:</span>
              <span className="text-sm font-bold tabular-nums">{actual}</span>
              {ptsEarned != null ? (
                <span className="text-xs font-bold text-pitch bg-pitch-soft px-1.5 py-0.5 rounded">
                  +{ptsEarned} pt
                </span>
              ) : value != null ? (
                <span className="text-xs text-brand">mis</span>
              ) : null}
            </div>
          )}
        </div>
      </label>
    </section>
  );
}

export default function BonusForm({
  userId,
  initial,
  isLocked,
  totalPoints,
  actualTopScorer,
  actualYellowCards,
  actualTotalGoals,
  actualNLTopScorer,
  actualNLTotalGoals,
  actualNLProgress,
}: {
  userId: string;
  initial: BonusValues;
  isLocked: boolean;
  totalPoints?: number;
  actualTopScorer?: string | null;
  actualYellowCards?: number | null;
  actualTotalGoals?: number | null;
  actualNLTopScorer?: string | null;
  actualNLTotalGoals?: number | null;
  actualNLProgress?: NLProgress | null;
}) {
  const [values, setValues] = useState<BonusValues>(initial);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const valuesRef = useRef(values);
  useEffect(() => {
    valuesRef.current = values;
  }, [values]);
  const timer = useRef<NodeJS.Timeout | undefined>(undefined);

  function patch<K extends keyof BonusValues>(key: K, val: BonusValues[K]) {
    if (isLocked) return;
    setValues((prev) => ({ ...prev, [key]: val }));
    clearTimeout(timer.current);
    timer.current = setTimeout(save, 600);
  }

  async function save() {
    const v = valuesRef.current;
    setSaveState("saving");
    const { error } = await supabase.from("bonus_picks").upsert(
      {
        user_id: userId,
        top_scorer: v.top_scorer || null,
        total_goals_tiebreak: v.total_goals_tiebreak,
        total_yellow_cards_tiebreak: v.total_yellow_cards_tiebreak,
        nl_top_scorer: v.nl_top_scorer || null,
        nl_total_goals: v.nl_total_goals,
        nl_progress: v.nl_progress,
      },
      { onConflict: "user_id" }
    );
    setSaveState(error ? "error" : "saved");
    if (!error) setTimeout(() => setSaveState("idle"), 1800);
  }

  return (
    <div className="space-y-8">
      <div className="bg-surface border border-border rounded-lg p-5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold mb-1">Bonusvragen</h1>
          <p className="text-sm text-muted">
            Elke vraag levert <span className="font-medium text-ink">10 punten</span> op bij een
            exact antwoord, en <span className="font-medium text-ink">5 punten</span> bij een
            getal binnen ±3 van het werkelijke aantal. Het totaal aantal doelpunten in het
            toernooi is ook de <span className="font-medium text-ink">beslisser</span>: bij
            een gelijke eindstand in het algemeen klassement wint wie het dichtst bij het
            werkelijke aantal zit.
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

      <TopScorerSection
        label="Topscorer van het toernooi"
        hint="Begin te typen om een speler te zoeken. 10 punten als je 'm goed hebt."
        value={values.top_scorer}
        disabled={isLocked}
        actual={actualTopScorer ?? null}
        onChange={(name) => patch("top_scorer", name)}
      />

      <NumberQuestion
        label="Totaal aantal gele kaarten in het toernooi"
        hint="Op het WK 2022 werden er 219 gele kaarten uitgedeeld."
        value={values.total_yellow_cards_tiebreak}
        disabled={isLocked}
        placeholder="bv. 210"
        exactPts={10}
        closePts={5}
        actual={actualYellowCards}
        onChange={(v) => patch("total_yellow_cards_tiebreak", v)}
      />

      <NumberQuestion
        label="Totaal aantal doelpunten in het toernooi"
        hint="Staat het gelijk in eindpunten? Dan wint wie het dichtst bij het werkelijke aantal zit. Op het WK 2022 vielen er 172 doelpunten."
        value={values.total_goals_tiebreak}
        disabled={isLocked}
        placeholder="bv. 175"
        isDecider
        exactPts={10}
        closePts={5}
        actual={actualTotalGoals}
        onChange={(v) => patch("total_goals_tiebreak", v)}
      />

      {/* ── Drie nieuwe vragen over Oranje ──────────────────────────── */}
      <div className="pt-4 border-t border-border">
        <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
          <span aria-hidden>🇳🇱</span> Oranje
        </h2>
      </div>

      <TopScorerSection
        label="Topscorer Nederlands elftal"
        hint="De Nederlandse speler met de meeste doelpunten tijdens dit toernooi. Klik in het veld voor de hele lijst."
        value={values.nl_top_scorer}
        disabled={isLocked}
        actual={actualNLTopScorer ?? null}
        onChange={(name) => patch("nl_top_scorer", name)}
        restrictToTla="NED"
      />

      <NumberQuestion
        label="Aantal doelpunten Nederlands elftal"
        hint="Alle doelpunten die Oranje maakt tijdens het toernooi (groepsfase + knock-out)."
        value={values.nl_total_goals}
        disabled={isLocked}
        placeholder="bv. 12"
        exactPts={10}
        closePts={5}
        actual={actualNLTotalGoals ?? null}
        onChange={(v) => patch("nl_total_goals", v)}
      />

      <ProgressQuestion
        value={values.nl_progress}
        disabled={isLocked}
        actual={actualNLProgress ?? null}
        onChange={(v) => patch("nl_progress", v)}
      />

      <div className="text-sm h-5 text-right">
        {saveState === "saving" && <span className="text-muted">opslaan…</span>}
        {saveState === "saved" && (
          <span className="text-pitch">✓ opgeslagen</span>
        )}
        {saveState === "error" && (
          <span className="text-brand">opslaan mislukt</span>
        )}
      </div>
    </div>
  );
}
