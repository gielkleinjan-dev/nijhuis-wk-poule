"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import PlayerCombobox from "@/app/components/PlayerCombobox";

type BonusValues = {
  top_scorer: string;
  total_goals_tiebreak: number | null;
  total_yellow_cards_tiebreak: number | null;
};
type SaveState = "idle" | "saving" | "saved" | "error";

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
}: {
  userId: string;
  initial: BonusValues;
  isLocked: boolean;
  totalPoints?: number;
  actualTopScorer?: string | null;
  actualYellowCards?: number | null;
  actualTotalGoals?: number | null;
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
            De topscorer levert <span className="font-medium text-ink">15 punten</span> op. Doelpunten: exact = <span className="font-medium text-ink">15 pt</span>, binnen ±3 = <span className="font-medium text-ink">8 pt</span>. Gele kaarten: exact = <span className="font-medium text-ink">10 pt</span>, binnen ±3 = <span className="font-medium text-ink">5 pt</span>. Het aantal doelpunten is ook de <span className="font-medium text-ink">beslisser</span>: bij een gelijke eindstand wint wie het dichtst bij het werkelijke aantal zit.
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

      <section className="bg-surface border border-border rounded-lg p-5 space-y-2">
        <span className="block font-semibold mb-1 flex items-center gap-2">
          Topscorer van het toernooi
          <span className="text-xs font-normal bg-pitch-soft text-pitch px-1.5 py-0.5 rounded">15 punten</span>
        </span>
        <span className="block text-xs text-muted mb-2">
          Begin te typen om een speler te zoeken. 15 punten als je 'm goed hebt.
        </span>
        <PlayerCombobox
          value={values.top_scorer}
          disabled={isLocked}
          onChange={(name) => patch("top_scorer", name)}
        />
        {actualTopScorer && (() => {
          const correct = values.top_scorer?.trim().toLowerCase() === actualTopScorer.trim().toLowerCase();
          const filled = !!values.top_scorer?.trim();
          return (
            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs text-muted">Uitslag:</span>
              <span className="text-sm font-bold">{actualTopScorer}</span>
              {correct ? (
                <span className="text-xs font-bold text-pitch bg-pitch-soft px-1.5 py-0.5 rounded">+15 pt</span>
              ) : filled ? (
                <span className="text-xs text-brand">mis</span>
              ) : null}
            </div>
          );
        })()}
      </section>

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
        exactPts={15}
        closePts={8}
        actual={actualTotalGoals}
        onChange={(v) => patch("total_goals_tiebreak", v)}
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
