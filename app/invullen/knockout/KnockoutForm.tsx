"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { flagEmoji } from "@/lib/flags";
import { ROUNDS, type Team, type Picks } from "./rounds";

export type { Team, Picks };
export { ROUNDS };

type SaveState = "idle" | "saving" | "saved" | "error";

function groupLabel(g: string) {
  // "GROUP_A" → "Poule A"
  return g.startsWith("GROUP_") ? `Poule ${g.slice(6)}` : g;
}

function TeamButton({
  team, selected, atMax, isLocked, showGroup, fromPrev, onToggle, survivorStatus, pointsEarned,
}: {
  team: Team; selected: boolean; atMax: boolean; isLocked: boolean; showGroup?: boolean; fromPrev?: boolean; onToggle: () => void;
  survivorStatus?: "correct" | "wrong" | "unknown";
  pointsEarned?: number;
}) {
  // Only color tiles the user actually selected — unselected tiles stay neutral
  const resultClass =
    survivorStatus === "correct" && selected
      ? "bg-pitch border-pitch text-white"
      : survivorStatus === "wrong" && selected
      ? "bg-brand-soft border-brand/30 text-brand"
      : survivorStatus !== "unknown" && !selected
      ? "bg-bg border-border text-muted opacity-30 cursor-default"
      : null;

  const baseClass = resultClass ?? (
    selected
      ? "bg-brand text-white border-brand"
      : atMax
      ? "bg-bg border-border text-muted opacity-50 cursor-not-allowed"
      : fromPrev
      ? "bg-pitch-soft border-pitch/30 hover:border-pitch"
      : "bg-surface border-border hover:border-brand"
  );

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={isLocked || atMax}
      className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium border transition text-left ${baseClass}`}
    >
      <span className="text-lg leading-none" aria-hidden>{flagEmoji(team.code)}</span>
      <span className={`truncate flex-1 ${survivorStatus === "wrong" && selected ? "line-through" : ""}`}>
        {team.name}
      </span>
      {showGroup && (
        <span className="text-[10px] font-mono shrink-0 opacity-50">
          {team.group.startsWith("GROUP_") ? team.group.slice(6) : ""}
        </span>
      )}
      {pointsEarned != null && pointsEarned > 0 && (
        <span className="text-[10px] font-bold shrink-0 opacity-90">+{pointsEarned}</span>
      )}
    </button>
  );
}

function GroupedTeamPicker({
  teams, set, full, isLocked, onToggle, maxPerGroup = 2, warnText,
  getSurvivorStatus, getPointsEarned,
}: {
  teams: Team[]; set: Set<string>; full: boolean; isLocked: boolean; onToggle: (code: string) => void;
  maxPerGroup?: number; warnText?: string;
  getSurvivorStatus?: (code: string) => "correct" | "wrong" | "unknown";
  getPointsEarned?: (code: string) => number | undefined;
}) {
  // Group teams by their group_name
  const byGroup = new Map<string, Team[]>();
  for (const t of teams) {
    if (!byGroup.has(t.group)) byGroup.set(t.group, []);
    byGroup.get(t.group)!.push(t);
  }
  const groups = Array.from(byGroup.entries()).sort(([a], [b]) => a.localeCompare(b));

  const overrepresented = groups
    .map(([g, members]) => ({ label: groupLabel(g), count: members.filter(m => set.has(m.code)).length }))
    .filter(x => x.count > maxPerGroup);

  const defaultWarnText = `er kunnen maximaal ${maxPerGroup} teams per poule doorgaan.`;

  return (
    <div className="p-3 space-y-4">
      {overrepresented.length > 0 && (
        <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-300 text-yellow-800 rounded-md px-3 py-2 text-xs">
          <span className="shrink-0">⚠️</span>
          <span>
            {overrepresented.map(x => `${x.label} (${x.count})`).join(", ")} — {warnText ?? defaultWarnText}
          </span>
        </div>
      )}
      {groups.map(([g, members]) => (
        <div key={g}>
          <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-1.5 px-1">
            {groupLabel(g)}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {members.map((t) => (
              <TeamButton
                key={t.code}
                team={t}
                selected={set.has(t.code)}
                atMax={!set.has(t.code) && full}
                isLocked={isLocked}
                onToggle={() => onToggle(t.code)}
                survivorStatus={getSurvivorStatus?.(t.code)}
                pointsEarned={getPointsEarned?.(t.code)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function KnockoutForm({
  userId,
  teams,
  initial,
  isLocked,
  survivors,
  totalPoints,
}: {
  userId: string;
  teams: Team[];
  initial: Picks;
  isLocked: boolean;
  survivors: Record<string, Set<string>>;
  totalPoints?: number;
}) {
  const [picks, setPicks] = useState<Picks>(initial);
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({});
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const picksRef = useRef(picks);
  useEffect(() => {
    picksRef.current = picks;
  }, [picks]);
  const timers = useRef<Record<string, NodeJS.Timeout>>({});

  function toggle(round: string, code: string) {
    if (isLocked) return;
    const cfg = ROUNDS.find((r) => r.key === round)!;
    setPicks((prev) => {
      const next = { ...prev, [round]: new Set(prev[round]) };
      if (next[round].has(code)) {
        next[round].delete(code);
      } else {
        if (next[round].size >= cfg.count) {
          // Highlight max bereikt — gewoon niet toevoegen
          return prev;
        }
        next[round].add(code);
      }
      return next;
    });
    clearTimeout(timers.current[round]);
    timers.current[round] = setTimeout(() => save(round), 600);
  }

  async function save(round: string) {
    const set = picksRef.current[round];
    setSaveStates((s) => ({ ...s, [round]: "saving" }));
    // Vervang alle picks voor deze ronde
    const { error: delErr } = await supabase
      .from("bracket_picks")
      .delete()
      .eq("user_id", userId)
      .eq("round", round);
    if (delErr) {
      setSaveStates((s) => ({ ...s, [round]: "error" }));
      return;
    }
    if (set.size > 0) {
      const rows = Array.from(set).map((team_code, slot) => ({
        user_id: userId,
        round,
        slot,
        team_code,
      }));
      const { error: insErr } = await supabase.from("bracket_picks").insert(rows);
      if (insErr) {
        setSaveStates((s) => ({ ...s, [round]: "error" }));
        return;
      }
    }
    setSaveStates((s) => ({ ...s, [round]: "saved" }));
    setTimeout(() => setSaveStates((s) => ({ ...s, [round]: "idle" })), 1800);
  }

  return (
    <div className="space-y-4">

      {/* ── Header ── */}
      <div className="bg-surface border border-border rounded-lg p-5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold mb-1">Knock-out</h1>
          <p className="text-sm text-muted mb-3">
            Kies per ronde welke teams doorgaan. Punten per juist team, oplopend per ronde:
          </p>
          <div className="flex flex-wrap gap-2 text-xs">
            {ROUNDS.map((r) => (
              <span key={r.key} className="flex items-center gap-1.5">
                <span className="bg-pitch-soft text-pitch px-1.5 py-0.5 rounded font-semibold">{r.points} pt</span>
                <span className="text-muted">{r.label}</span>
              </span>
            ))}
          </div>
        </div>
        {(totalPoints ?? 0) > 0 && (
          <div className="text-right shrink-0">
            <div className="text-3xl font-bold tabular-nums text-pitch">{totalPoints}</div>
            <div className="text-xs text-muted">punten</div>
          </div>
        )}
      </div>

      {/* ── Locked notice ── */}
      {isLocked && (
        <div className="bg-brand-soft border border-brand/20 rounded-lg p-4 text-sm">
          De poule is gesloten — je voorspellingen zijn vastgezet.
        </div>
      )}

      {/* ── Rounds ── */}
      {ROUNDS.map((round, i) => {
        const set = picks[round.key] || new Set<string>();
        const prevSet = i > 0 ? (picks[ROUNDS[i - 1].key] || new Set<string>()) : new Set<string>();
        const state = saveStates[round.key] || "idle";
        const full = set.size === round.count;
        const roundSurvivors = survivors[round.key];
        const hasData = !!(roundSurvivors && roundSurvivors.size > 0);
        const getSurvivorStatus = (code: string): "correct" | "wrong" | "unknown" =>
          hasData ? (roundSurvivors.has(code) ? "correct" : "wrong") : "unknown";
        const getPointsEarned = (code: string): number | undefined =>
          set.has(code) && getSurvivorStatus(code) === "correct" ? round.points : undefined;

        return (
          <section key={round.key} className="bg-surface border border-border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-bg/50">
              <div>
                <h2 className="text-lg font-bold flex items-center gap-2">
                  {round.label}
                  <span className="bg-pitch-soft text-pitch text-xs font-semibold px-1.5 py-0.5 rounded">{round.points} pt</span>
                </h2>
                <p className="text-xs text-muted">{round.hint}</p>
              </div>
              <div className="text-right shrink-0 ml-4">
                <div className={`text-2xl font-bold tabular-nums ${full ? "text-pitch" : ""}`}>
                  {set.size}<span className="text-base text-muted font-normal">/{round.count}</span>
                </div>
                <div className="text-xs h-4">
                  {state === "saving" && <span className="text-muted">opslaan…</span>}
                  {state === "saved" && <span className="text-pitch">✓ opgeslagen</span>}
                  {state === "error" && <span className="text-brand">opslaan mislukt</span>}
                </div>
              </div>
            </div>
            {round.key === "LAST_32" ? (
              <GroupedTeamPicker
                teams={teams} set={set} full={full} isLocked={isLocked}
                onToggle={(code) => toggle(round.key, code)} maxPerGroup={3}
                warnText="maximaal 3 teams per poule kunnen doorgaan (nr. 1, nr. 2 en eventueel de nr. 3 als die bij de 8 beste nrs. 3 hoort)."
                getSurvivorStatus={getSurvivorStatus} getPointsEarned={getPointsEarned}
              />
            ) : (
              <div className="p-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                {teams.map((t) => (
                  <TeamButton
                    key={t.code} team={t} selected={set.has(t.code)}
                    atMax={!set.has(t.code) && full} isLocked={isLocked}
                    showGroup
                    fromPrev={!full && !hasData && prevSet.has(t.code)}
                    onToggle={() => toggle(round.key, t.code)}
                    survivorStatus={getSurvivorStatus(t.code)}
                    pointsEarned={getPointsEarned(t.code)}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}

    </div>
  );
}
