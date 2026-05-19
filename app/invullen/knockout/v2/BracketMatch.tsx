"use client";

import { flagEmoji } from "@/lib/flags";
import type { MatchId } from "@/lib/bracket/types";

type TeamLite = { code: string; name: string };

function formatKickoff(d: Date | undefined): string {
  if (!d) return "datum onbekend";
  const weekday = d.toLocaleDateString("nl-NL", { weekday: "short" });
  const day = d.toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
  const time = d.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
  return `${weekday} ${day} · ${time}`;
}

export function BracketMatch({
  matchId,
  fifaMatchNo,
  homeCand,
  awayCand,
  kickoff,
  winner,
  allTeams,
  isLocked,
  teamsByCode,
  onPick,
}: {
  matchId: MatchId;
  fifaMatchNo: number;
  homeCand: string | undefined;
  awayCand: string | undefined;
  kickoff: Date | undefined;
  winner: string | undefined;
  allTeams: ReadonlyArray<TeamLite>;
  isLocked: boolean;
  teamsByCode: ReadonlyMap<string, TeamLite>;
  onPick: (winner: string | undefined) => void;
}) {
  // Welke landen tonen we in de twee pills?
  // - homeCand/awayCand komen uit de cascade. Als winner een override is
  //   (= geen van beide cands), tonen we hem in de home-pill.
  const winnerIsOverride =
    winner != null && winner !== homeCand && winner !== awayCand;

  const homeShown: string | undefined = winnerIsOverride ? winner : homeCand;
  const awayShown: string | undefined = awayCand;

  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 bg-bg/40 border-b border-border text-[11px]">
        <span className="font-mono font-semibold text-muted">Wedstrijd {fifaMatchNo}</span>
        <span className="text-muted">{formatKickoff(kickoff)}</span>
      </div>

      <div className="p-2 grid grid-cols-[1fr_auto_1fr] gap-1.5 items-stretch">
        <TeamPill
          code={homeShown}
          isWinner={winner != null && winner === homeShown}
          isOverride={winnerIsOverride}
          isLocked={isLocked}
          teamsByCode={teamsByCode}
          allTeams={allTeams}
          onClickPill={() => homeShown && onPick(winner === homeShown ? undefined : homeShown)}
          onPickFromList={(code) => onPick(code)}
        />
        <div className="flex items-center justify-center text-[10px] text-muted px-1 font-medium">vs</div>
        <TeamPill
          code={awayShown}
          isWinner={winner != null && winner === awayShown}
          isOverride={false}
          isLocked={isLocked}
          teamsByCode={teamsByCode}
          allTeams={allTeams}
          onClickPill={() => awayShown && onPick(winner === awayShown ? undefined : awayShown)}
          onPickFromList={(code) => onPick(code)}
        />
      </div>

      <span className="hidden">{matchId}</span>
    </div>
  );
}

function TeamPill({
  code,
  isWinner,
  isOverride,
  isLocked,
  teamsByCode,
  allTeams,
  onClickPill,
  onPickFromList,
}: {
  code: string | undefined;
  isWinner: boolean;
  isOverride: boolean;
  isLocked: boolean;
  teamsByCode: ReadonlyMap<string, TeamLite>;
  allTeams: ReadonlyArray<TeamLite>;
  onClickPill: () => void;
  onPickFromList: (code: string) => void;
}) {
  const t = code ? teamsByCode.get(code) : undefined;

  const baseClass = isWinner
    ? isOverride
      ? "bg-amber-500 text-white border-amber-500 font-semibold"
      : "bg-brand text-white border-brand font-semibold"
    : "bg-bg border-border hover:border-brand";

  // Voor lege slots: ook dropdown beschikbaar (om handmatig een land te kiezen)
  const emptySlot = !code;

  return (
    <div className={`relative flex items-stretch rounded border overflow-hidden ${baseClass} ${isLocked ? "opacity-70" : ""}`}>
      {emptySlot ? (
        <div className="flex-1 flex items-center justify-center px-2 py-2 text-[11px] text-muted italic">
          nog niet bekend
        </div>
      ) : (
        <button
          type="button"
          disabled={isLocked}
          onClick={onClickPill}
          className={`flex-1 flex items-center gap-1.5 px-2 py-2 text-sm text-left ${isLocked ? "cursor-not-allowed" : ""}`}
        >
          <span className="text-base leading-none shrink-0" aria-hidden>{flagEmoji(code!)}</span>
          <span className="truncate flex-1">{t?.name ?? code}</span>
        </button>
      )}

      {/* Dropdown chevron: ander land kiezen voor deze slot */}
      {!isLocked && (
        <label className={`relative flex items-center justify-center px-1.5 cursor-pointer border-l ${isWinner ? "border-white/30 hover:bg-white/15" : "border-border hover:bg-bg/60"}`} aria-label="Kies ander land">
          <span className={`text-xs leading-none ${isWinner ? "text-white/80" : "text-muted"}`}>▾</span>
          <select
            value={code ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              if (v) onPickFromList(v);
            }}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            aria-label="Land kiezen"
          >
            <option value="">— kies een land —</option>
            {allTeams.map((tt) => (
              <option key={tt.code} value={tt.code}>{tt.name}</option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
