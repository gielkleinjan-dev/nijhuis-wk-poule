"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { flagEmoji } from "@/lib/flags";

export type Team = { code: string; name: string };
export type Match = {
  id: number;
  group: string;
  kickoff: string;
  home: Team;
  away: Team;
  actual?: { home: number; away: number };
};
export type Prediction = {
  home?: number | null;
  away?: number | null;
  toto?: string | null;
};

type Toto = "1" | "X" | "2";
type SaveState = "idle" | "saving" | "saved" | "error";

function deriveToto(home?: number | null, away?: number | null): Toto | null {
  if (home == null || away == null) return null;
  return home > away ? "1" : home < away ? "2" : "X";
}

function scoreGroup(
  p: Prediction | undefined,
  a: { home: number; away: number }
): { pts: number; label: string } | null {
  if (!p) return null;
  const hasScores = p.home != null && p.away != null;
  if (!hasScores && !p.toto) return null;

  const actualToto = a.home > a.away ? "1" : a.home < a.away ? "2" : "X";
  let pts = 0;
  if (hasScores) {
    if (p.home === a.home) pts += 2;
    if (p.away === a.away) pts += 2;
  }
  // Explicit toto wins; fall back to score-derived toto.
  const effectiveToto =
    p.toto ??
    (hasScores ? (p.home! > p.away! ? "1" : p.home! < p.away! ? "2" : "X") : null);
  if (effectiveToto && effectiveToto === actualToto) pts += 1;

  const label =
    pts === 5 ? "exact" :
    pts === 4 ? "score goed" :
    pts === 3 ? "score + toto" :
    pts === 2 ? "één score goed" :
    pts === 1 ? "toto" : "mis";
  return { pts, label };
}

function isFilled(p: Prediction | undefined): boolean {
  if (!p) return false;
  return (p.home != null && p.away != null) || p.toto != null;
}

export default function GroupStageForm({
  userId,
  matches,
  initial,
  isLocked,
  totalPoints,
}: {
  userId: string;
  matches: Match[];
  initial: Record<number, Prediction>;
  isLocked: boolean;
  totalPoints?: number;
}) {
  const [predictions, setPredictions] = useState<Record<number, Prediction>>(initial);
  const [saveStates, setSaveStates] = useState<Record<number, SaveState>>({});
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const debounceTimers = useRef<Record<number, NodeJS.Timeout>>({});
  const predictionsRef = useRef(predictions);
  useEffect(() => { predictionsRef.current = predictions; }, [predictions]);

  const grouped = useMemo(() => {
    const map = new Map<string, Match[]>();
    for (const m of matches) {
      if (!map.has(m.group)) map.set(m.group, []);
      map.get(m.group)!.push(m);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [matches]);

  const filledCount = matches.filter((m) => isFilled(predictions[m.id])).length;

  function updateScore(matchId: number, side: "home" | "away", raw: string) {
    if (isLocked) return;
    const digits = raw.replace(/\D/g, "").slice(0, 2);
    const value = digits === "" ? undefined : Math.max(0, Math.min(20, parseInt(digits, 10)));
    setPredictions((prev) => ({
      ...prev,
      [matchId]: { ...prev[matchId], [side]: value ?? null },
    }));
    clearTimeout(debounceTimers.current[matchId]);
    debounceTimers.current[matchId] = setTimeout(() => saveScore(matchId), 500);
  }

  function updateToto(matchId: number, toto: Toto) {
    if (isLocked) return;
    // Preserve existing score — toto is stored independently
    setPredictions((prev) => ({ ...prev, [matchId]: { ...prev[matchId], toto } }));
    clearTimeout(debounceTimers.current[matchId]);
    debounceTimers.current[matchId] = setTimeout(() => saveToto(matchId), 300);
  }

  async function saveScore(matchId: number) {
    const p = predictionsRef.current[matchId];
    if (p?.home == null || p?.away == null) return;
    setSaveStates((s) => ({ ...s, [matchId]: "saving" }));
    const { error } = await supabase.from("predictions").upsert(
      { user_id: userId, match_id: matchId, home_score: p.home, away_score: p.away, toto_pick: p.toto ?? null },
      { onConflict: "user_id,match_id" }
    );
    setSaveStates((s) => ({ ...s, [matchId]: error ? "error" : "saved" }));
    if (!error) setTimeout(() => setSaveStates((s) => ({ ...s, [matchId]: "idle" })), 1800);
  }

  async function saveToto(matchId: number) {
    const p = predictionsRef.current[matchId];
    if (!p?.toto) return;
    setSaveStates((s) => ({ ...s, [matchId]: "saving" }));
    const { error } = await supabase.from("predictions").upsert(
      {
        user_id: userId,
        match_id: matchId,
        home_score: p.home ?? null,
        away_score: p.away ?? null,
        toto_pick: p.toto,
      },
      { onConflict: "user_id,match_id" }
    );
    setSaveStates((s) => ({ ...s, [matchId]: error ? "error" : "saved" }));
    if (!error) setTimeout(() => setSaveStates((s) => ({ ...s, [matchId]: "idle" })), 1800);
  }

  return (
    <div className="space-y-8">
      <div className="bg-surface border border-border rounded-lg p-5 flex flex-col-reverse sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold mb-1">Groepsfase</h1>
          <p className="text-sm text-muted">
            Elk onderdeel telt apart: thuisscore, uitscore en de toto (1/X/2) leveren los punten op.
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className="bg-pitch-soft text-pitch px-1.5 py-0.5 rounded font-semibold">2 pt</span>
            <span className="text-muted self-center">thuisscore goed ·</span>
            <span className="bg-pitch-soft text-pitch px-1.5 py-0.5 rounded font-semibold">2 pt</span>
            <span className="text-muted self-center">uitscore goed ·</span>
            <span className="bg-pitch-soft text-pitch px-1.5 py-0.5 rounded font-semibold">1 pt</span>
            <span className="text-muted self-center">toto goed · max 5 pt</span>
          </div>
          <p className="mt-1.5 text-xs text-muted">
            De toto volgt automatisch uit je uitslag, maar je kunt 'm ook handmatig kiezen — bijvoorbeeld als je een gelijkspel verwacht maar voor de zekerheid op winst gokt.
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
              {filledCount}
              <span className="text-base text-muted font-normal">/{matches.length}</span>
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

      {grouped.map(([group, ms]) => {
        const groupFilled = ms.filter((m) => isFilled(predictions[m.id])).length;
        return (
          <section key={group} className="bg-surface border border-border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-bg/50">
              <h2 className="text-lg font-bold">Groep {group.replace("GROUP_", "")}</h2>
              <span className="text-xs text-muted tabular-nums">{groupFilled}/{ms.length}</span>
            </div>
            <ul className="divide-y divide-border">
              {ms.map((m) => (
                <MatchRow
                  key={m.id}
                  match={m}
                  prediction={predictions[m.id]}
                  saveState={saveStates[m.id] || "idle"}
                  disabled={isLocked}
                  onScoreChange={updateScore}
                  onTotoChange={updateToto}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function MatchRow({
  match,
  prediction,
  saveState,
  disabled,
  onScoreChange,
  onTotoChange,
}: {
  match: Match;
  prediction: Prediction | undefined;
  saveState: SaveState;
  disabled: boolean;
  onScoreChange: (id: number, side: "home" | "away", value: string) => void;
  onTotoChange: (id: number, toto: Toto) => void;
}) {
  const fmt = new Intl.DateTimeFormat("nl-NL", {
    weekday: "short", day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(match.kickoff));

  const hasScore = prediction?.home != null && prediction?.away != null;
  // Explicit toto_pick takes priority; fall back to score-derived indicator
  const activeToto: Toto | null =
    (prediction?.toto as Toto | null | undefined) ??
    (hasScore ? deriveToto(prediction?.home, prediction?.away) : null);

  const result = match.actual ? scoreGroup(prediction, match.actual) : null;

  const resultBlock = match.actual ? (
    result === null ? (
      <span className="text-xs text-muted">—</span>
    ) : (
      <span className={`text-xs font-bold tabular-nums ${
        result.pts === 0 ? "text-brand" : result.pts === 1 ? "text-amber-600" : "text-pitch"
      }`}>
        {result.pts === 0 ? "mis" : `+${result.pts}`}
      </span>
    )
  ) : (
    <div className="text-xs h-4">
      {saveState === "saving" && <span className="text-muted">…</span>}
      {saveState === "saved" && <span className="text-pitch">✓</span>}
      {saveState === "error" && <span className="text-brand">!</span>}
    </div>
  );

  return (
    <li className="px-3 sm:px-4 py-3">
      {/* Desktop layout (sm+): alles op één rij */}
      <div className="hidden sm:flex items-center gap-3">
        <div className="text-xs text-muted w-24 shrink-0 leading-tight">{fmt}</div>

        <div className="flex items-center justify-end gap-1.5 flex-1 min-w-0">
          <span className="font-medium text-sm truncate leading-tight text-right">{match.home.name}</span>
          <span className="text-lg leading-none shrink-0" aria-hidden>{flagEmoji(match.home.code)}</span>
        </div>

        <div className="flex flex-col items-center gap-0.5 shrink-0">
          <div className="flex items-center gap-1">
            <ScoreInput value={prediction?.home ?? undefined} disabled={disabled}
              onChange={(v) => onScoreChange(match.id, "home", v)} ariaLabel={`Score ${match.home.name}`} />
            <span className="text-muted text-sm font-bold">–</span>
            <ScoreInput value={prediction?.away ?? undefined} disabled={disabled}
              onChange={(v) => onScoreChange(match.id, "away", v)} ariaLabel={`Score ${match.away.name}`} />
          </div>
          {match.actual && (
            <div className="text-xs text-muted tabular-nums">
              uitslag <span className="font-semibold text-ink">{match.actual.home}–{match.actual.away}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <span className="text-lg leading-none shrink-0" aria-hidden>{flagEmoji(match.away.code)}</span>
          <span className="font-medium text-sm truncate leading-tight">{match.away.name}</span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <TotoButtons value={activeToto} derived={hasScore} disabled={disabled}
            onClick={(t) => onTotoChange(match.id, t)} />
          <span className="w-8 text-center">{resultBlock}</span>
        </div>
      </div>

      {/* Mobile layout (< sm): 2 regels — team/score/team boven, toto+datum+status onder */}
      <div className="sm:hidden space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-end gap-1 flex-1 min-w-0">
            <span className="font-medium text-sm truncate leading-tight text-right">{match.home.name}</span>
            <span className="text-base leading-none shrink-0" aria-hidden>{flagEmoji(match.home.code)}</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <ScoreInput value={prediction?.home ?? undefined} disabled={disabled}
              onChange={(v) => onScoreChange(match.id, "home", v)} ariaLabel={`Score ${match.home.name}`} />
            <span className="text-muted text-sm font-bold">–</span>
            <ScoreInput value={prediction?.away ?? undefined} disabled={disabled}
              onChange={(v) => onScoreChange(match.id, "away", v)} ariaLabel={`Score ${match.away.name}`} />
          </div>
          <div className="flex items-center gap-1 flex-1 min-w-0">
            <span className="text-base leading-none shrink-0" aria-hidden>{flagEmoji(match.away.code)}</span>
            <span className="font-medium text-sm truncate leading-tight">{match.away.name}</span>
          </div>
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <span className="text-[11px] text-muted truncate">{fmt}</span>
          <div className="flex flex-col items-center gap-0.5">
            <TotoButtons value={activeToto} derived={hasScore} disabled={disabled}
              onClick={(t) => onTotoChange(match.id, t)} />
            {match.actual && (
              <div className="text-[11px] text-muted tabular-nums">
                uitslag <span className="font-semibold text-ink">{match.actual.home}–{match.actual.away}</span>
              </div>
            )}
          </div>
          <span className="text-xs text-right">{resultBlock}</span>
        </div>
      </div>
    </li>
  );
}

const TOTO_OPTIONS: { key: Toto; label: string; sub: string }[] = [
  { key: "1", label: "1", sub: "thuis" },
  { key: "X", label: "X", sub: "gelijk" },
  { key: "2", label: "2", sub: "uit" },
];

function TotoButtons({
  value,
  derived,
  disabled,
  onClick,
}: {
  value: Toto | null;
  derived: boolean; // true when toto is derived from a filled score (indicator only)
  disabled: boolean;
  onClick: (t: Toto) => void;
}) {
  const interactive = !disabled;
  return (
    <div className="flex items-center gap-1">
      {TOTO_OPTIONS.map((o) => {
        const active = value === o.key;
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => { if (interactive) onClick(o.key); }}
            title={o.sub}
            className={`w-8 h-8 rounded text-xs font-bold border transition select-none ${
              active
                ? "bg-brand text-white border-brand"
                : interactive
                ? "bg-surface border-border text-ink/60 hover:border-brand hover:text-ink"
                : "bg-surface border-border text-muted/40"
            } ${interactive ? "cursor-pointer" : "cursor-default"}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function ScoreInput({
  value,
  disabled,
  onChange,
  ariaLabel,
}: {
  value: number | undefined;
  disabled: boolean;
  onChange: (v: string) => void;
  ariaLabel: string;
}) {
  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      maxLength={2}
      value={value ?? ""}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      onFocus={(e) => e.target.select()}
      aria-label={ariaLabel}
      className="w-10 h-9 text-center text-base sm:text-sm font-bold border-2 border-border rounded-md focus:outline-none focus:border-brand bg-surface disabled:opacity-60"
    />
  );
}
