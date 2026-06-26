"use client";

import { useRef } from "react";
import { flagEmoji } from "@/lib/flags";
import type { MatchId } from "@/lib/bracket/types";
import { CountryDropdown } from "./CountryDropdown";
import type { Side } from "./useBracketState";

type TeamLite = { code: string; name: string };

function formatKickoff(d: Date | undefined): string {
  if (!d) return "datum onbekend";
  const fmt = new Intl.DateTimeFormat("nl-NL", {
    timeZone: "Europe/Amsterdam",
    weekday: "short", day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit",
  });
  return fmt.format(d);
}

export function BracketMatch({
  matchId,
  fifaMatchNo,
  homeShown,
  awayShown,
  homeIsOverride,
  awayIsOverride,
  homeEmptyLabel,
  awayEmptyLabel,
  kickoff,
  winner,
  homeActual,
  awayActual,
  homeActualPts,
  awayActualPts,
  roundFull,
  allTeams,
  isLocked,
  teamsByCode,
  onPick,
  onSetOverride,
}: {
  matchId: MatchId;
  fifaMatchNo: number;
  homeShown: string | undefined;
  awayShown: string | undefined;
  homeIsOverride: boolean;
  awayIsOverride: boolean;
  homeEmptyLabel?: string;
  awayEmptyLabel?: string;
  kickoff: Date | undefined;
  winner: string | undefined;
  homeActual?: string;
  awayActual?: string;
  homeActualPts: number;
  awayActualPts: number;
  roundFull: number;
  allTeams: ReadonlyArray<TeamLite>;
  isLocked: boolean;
  teamsByCode: ReadonlyMap<string, TeamLite>;
  onPick: (winner: string | undefined) => void;
  onSetOverride: (side: Side, teamCode: string | null) => void;
}) {
  const fmt = formatKickoff(kickoff);

  // iOS ghost-click guard: na een dropdown-pick fired iOS soms een synthetische
  // click op de pill eronder. 500ms lockout vangt dat op.
  const clickLockUntil = useRef(0);
  function lockClicksBriefly() {
    clickLockUntil.current = Date.now() + 500;
  }

  // ── Pill body click = aanwijzen als winnaar (geen toggle off) ─────────────
  function clickHome() {
    if (Date.now() < clickLockUntil.current) return;
    if (!homeShown) return;
    if (winner !== homeShown) onPick(homeShown);
  }
  function clickAway() {
    if (Date.now() < clickLockUntil.current) return;
    if (!awayShown) return;
    if (winner !== awayShown) onPick(awayShown);
  }

  // ── Dropdown pick = override (NIET automatisch winnaar) ───────────────────
  function pickHomeFromDropdown(code: string) {
    onSetOverride("home", code);
    lockClicksBriefly();
    // Als de winnaar was de oude homeShown, en die is nu vervangen, dan
    // is winner stale. Houd 'm zoals 'ie was — gebruiker bepaalt zelf via
    // pill body click of de override de winnaar wordt.
  }
  function pickAwayFromDropdown(code: string) {
    onSetOverride("away", code);
    lockClicksBriefly();
  }

  // ── ↺ per pill = wis override van DEZE pill + winnaar als deze pill ──────
  const canResetHome = !isLocked && (homeIsOverride || winner === homeShown);
  const canResetAway = !isLocked && (awayIsOverride || winner === awayShown);

  function resetHome() {
    if (homeIsOverride) onSetOverride("home", null);
    if (winner === homeShown) onPick(undefined);
  }
  function resetAway() {
    if (awayIsOverride) onSetOverride("away", null);
    if (winner === awayShown) onPick(undefined);
  }

  return (
    <li
      data-kickoff={kickoff ? kickoff.toISOString() : undefined}
      className="px-3 sm:px-4 py-3 border-b border-border last:border-b-0"
    >
      {/* Desktop (sm+): alles op één rij */}
      <div className="hidden sm:flex items-center gap-2">
        <div className="w-28 shrink-0 leading-tight">
          <div className="text-xs text-muted">{fmt}</div>
          <div className="font-mono text-[10px] text-muted/70 mt-0.5">W{fifaMatchNo}</div>
        </div>

        <div className="flex-1 min-w-0">
          <TeamPill
            code={homeShown}
            emptyLabel={homeEmptyLabel}
            isWinner={winner != null && winner === homeShown}
            isOverride={homeIsOverride}
            isLocked={isLocked}
            teamsByCode={teamsByCode}
            allTeams={allTeams}
            onClickPill={clickHome}
            onPickFromList={pickHomeFromDropdown}
          />
        </div>

        <ResetButton enabled={canResetHome} onClick={resetHome} ariaLabel="Reset thuis-keuze" />

        <div className="text-xs text-muted shrink-0 font-medium">vs</div>

        <ResetButton enabled={canResetAway} onClick={resetAway} ariaLabel="Reset uit-keuze" />

        <div className="flex-1 min-w-0">
          <TeamPill
            code={awayShown}
            emptyLabel={awayEmptyLabel}
            isWinner={winner != null && winner === awayShown}
            isOverride={awayIsOverride}
            isLocked={isLocked}
            teamsByCode={teamsByCode}
            allTeams={allTeams}
            onClickPill={clickAway}
            onPickFromList={pickAwayFromDropdown}
          />
        </div>
      </div>

      {/* Mobile (< sm): 3 regels — teams boven, ↺-knoppen midden, datum onder */}
      <div className="sm:hidden space-y-1.5">
        <div className="flex items-center gap-1.5">
          <div className="flex-1 min-w-0">
            <TeamPill
              code={homeShown}
              emptyLabel={homeEmptyLabel}
              isWinner={winner != null && winner === homeShown}
              isOverride={homeIsOverride}
              isLocked={isLocked}
              teamsByCode={teamsByCode}
              allTeams={allTeams}
              onClickPill={clickHome}
              onPickFromList={pickHomeFromDropdown}
            />
          </div>
          <div className="text-[10px] text-muted shrink-0 px-0.5">vs</div>
          <div className="flex-1 min-w-0">
            <TeamPill
              code={awayShown}
              emptyLabel={awayEmptyLabel}
              isWinner={winner != null && winner === awayShown}
              isOverride={awayIsOverride}
              isLocked={isLocked}
              teamsByCode={teamsByCode}
              allTeams={allTeams}
              onClickPill={clickAway}
              onPickFromList={pickAwayFromDropdown}
            />
          </div>
        </div>
        {/* Tweede regel: ↺-knoppen onder de pills, vol-breed klikbaar */}
        <div className="flex items-center gap-1.5">
          <div className="flex-1 min-w-0">
            <ResetButton enabled={canResetHome} onClick={resetHome} ariaLabel="Reset thuis-keuze" wide />
          </div>
          <div className="w-6 shrink-0" aria-hidden />
          <div className="flex-1 min-w-0">
            <ResetButton enabled={canResetAway} onClick={resetAway} ariaLabel="Reset uit-keuze" wide />
          </div>
        </div>
        <div className="flex items-center justify-between text-[11px] text-muted pt-0.5">
          <span>{fmt}</span>
          <span className="font-mono text-muted/70">W{fifaMatchNo}</span>
        </div>
      </div>

      {/* Werkelijke uitslag + behaalde punten — read-only. Eigen layout per
          breakpoint die exact de pill-rij hierboven volgt (incl. de w-6 ruimte
          voor de ↺-knoppen op desktop), zodat thuis/uit netjes uitlijnen. */}
      {(homeActual || awayActual) && (
        <div className="mt-2 pt-2 border-t border-border/60 text-[11px]">
          {/* Desktop: zelfde kolommen als de pill-rij (w-28 · flex-1 · w-6 · vs · w-6 · flex-1) */}
          <div className="hidden sm:flex items-center gap-2">
            <div className="w-28 shrink-0 text-muted">Werkelijk</div>
            <div className="flex-1 min-w-0">
              <ActualSlot code={homeActual} pts={homeActualPts} full={roundFull} teamsByCode={teamsByCode} />
            </div>
            <span className="w-6 shrink-0" aria-hidden />
            <span className="shrink-0 text-muted/50 font-medium">vs</span>
            <span className="w-6 shrink-0" aria-hidden />
            <div className="flex-1 min-w-0">
              <ActualSlot code={awayActual} pts={awayActualPts} full={roundFull} teamsByCode={teamsByCode} />
            </div>
          </div>
          {/* Mobiel: label boven, twee kolommen zoals de mobiele pill-rij */}
          <div className="sm:hidden">
            <div className="text-muted mb-1">Werkelijk</div>
            <div className="flex items-center gap-1.5">
              <div className="flex-1 min-w-0">
                <ActualSlot code={homeActual} pts={homeActualPts} full={roundFull} teamsByCode={teamsByCode} />
              </div>
              <span className="shrink-0 px-0.5 text-muted/50">vs</span>
              <div className="flex-1 min-w-0">
                <ActualSlot code={awayActual} pts={awayActualPts} full={roundFull} teamsByCode={teamsByCode} />
              </div>
            </div>
          </div>
        </div>
      )}

      <span className="hidden">{matchId}</span>
    </li>
  );
}

// Eén werkelijk vakje: vlag + naam + punten-chip. Vol = juiste plek (groen),
// half = juist land verkeerde plek (geel), 0 = mis (grijs).
function ActualSlot({
  code, pts, full, teamsByCode,
}: {
  code: string | undefined;
  pts: number;
  full: number;
  teamsByCode: ReadonlyMap<string, TeamLite>;
}) {
  // pl-[9px] = pill-rand (1px) + pill-padding (px-2 = 8px), plus dezelfde
  // flag-grootte (text-base) als de pill → vlag-harten vallen exact samen.
  if (!code) return <span className="text-muted/70 italic pl-[9px]">nog onbekend</span>;
  const name = teamsByCode.get(code)?.name ?? code;
  const chip =
    pts === 0
      ? "bg-red-50 text-red-700 border border-red-200" // rood = fout
      : pts >= full
      ? "bg-pitch text-white border border-pitch"
      : "bg-amber-100 text-amber-800 border border-amber-200";
  return (
    <span className="inline-flex items-center gap-1.5 min-w-0 pl-[9px]">
      <span className="flag-emoji text-base leading-none shrink-0" aria-hidden>{flagEmoji(code)}</span>
      <span className="truncate text-fg">{name}</span>
      <span className={`shrink-0 px-1 py-0.5 rounded text-[10px] font-semibold tabular-nums ${chip}`}>
        {pts === 0 ? "mis" : `+${pts}`}
      </span>
    </span>
  );
}

function ResetButton({
  enabled, onClick, ariaLabel, wide = false,
}: {
  enabled: boolean;
  onClick: () => void;
  ariaLabel: string;
  wide?: boolean;
}) {
  // wide = mobile: vol-breed klikbaar onder de pill (geen ↺-icoon achter pill-naam)
  if (wide) {
    return (
      <button
        type="button"
        disabled={!enabled}
        onClick={onClick}
        aria-label={ariaLabel}
        className={`w-full h-7 rounded-md border text-[11px] leading-none transition flex items-center justify-center gap-1 ${
          enabled
            ? "border-border text-muted hover:border-pitch hover:text-pitch active:bg-bg/40 cursor-pointer"
            : "border-transparent text-transparent cursor-default"
        }`}
      >
        ↺ wis
      </button>
    );
  }
  return (
    <button
      type="button"
      disabled={!enabled}
      onClick={onClick}
      aria-label={ariaLabel}
      title={ariaLabel}
      className={`shrink-0 w-6 h-6 rounded-md border text-xs leading-none transition ${
        enabled
          ? "border-border text-muted hover:border-pitch hover:text-pitch cursor-pointer"
          : "border-transparent text-transparent cursor-default"
      }`}
    >
      ↺
    </button>
  );
}

function TeamPill({
  code,
  emptyLabel,
  isWinner,
  isOverride,
  isLocked,
  teamsByCode,
  allTeams,
  onClickPill,
  onPickFromList,
}: {
  code: string | undefined;
  emptyLabel?: string;
  isWinner: boolean;
  isOverride: boolean;
  isLocked: boolean;
  teamsByCode: ReadonlyMap<string, TeamLite>;
  allTeams: ReadonlyArray<TeamLite>;
  onClickPill: () => void;
  onPickFromList: (code: string) => void;
}) {
  const t = code ? teamsByCode.get(code) : undefined;

  // Winnaars: groen (pitch). Overrides die GEEN winnaar zijn: lichter groen
  // gloed met override-indicator (~"O"). Neutraal: cascade-default.
  const baseClass = isWinner
    ? "bg-pitch text-white border-pitch font-semibold"
    : isOverride
    ? "bg-pitch-soft border-pitch/40 hover:border-pitch text-fg"
    : "bg-bg border-border hover:border-pitch";

  const emptySlot = !code;

  return (
    <div className={`relative flex items-stretch rounded border overflow-hidden ${baseClass} ${isLocked ? "opacity-70" : ""}`}>
      {emptySlot ? (
        <div className="flex-1 flex items-center justify-center px-2 py-2 text-[11px] text-muted italic truncate">
          {emptyLabel ?? "nog niet bekend"}
        </div>
      ) : (
        <button
          type="button"
          disabled={isLocked}
          onClick={onClickPill}
          className={`flex-1 flex items-center gap-1.5 px-2 py-2 text-sm text-left min-w-0 ${isLocked ? "cursor-not-allowed" : ""}`}
        >
          <span className="flag-emoji text-base leading-none shrink-0" aria-hidden>{flagEmoji(code!)}</span>
          <span className="truncate flex-1">{t?.name ?? code}</span>
        </button>
      )}

      {!isLocked && (
        <CountryDropdown
          teams={allTeams}
          selectedCode={code}
          onPick={onPickFromList}
          triggerClassName={`flex items-center justify-center px-3 self-stretch cursor-pointer border-l shrink-0 ${
            isWinner ? "border-white/30 hover:bg-white/15" : "border-border hover:bg-bg/60"
          }`}
          triggerLabelClassName={`text-sm leading-none ${isWinner ? "text-white/90" : "text-muted"}`}
        />
      )}
    </div>
  );
}
