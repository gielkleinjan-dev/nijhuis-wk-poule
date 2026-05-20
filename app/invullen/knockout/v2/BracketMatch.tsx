"use client";

import { flagEmoji } from "@/lib/flags";
import type { MatchId } from "@/lib/bracket/types";
import { CountryDropdown } from "./CountryDropdown";

type TeamLite = { code: string; name: string };

function formatKickoff(d: Date | undefined): string {
  if (!d) return "datum onbekend";
  const fmt = new Intl.DateTimeFormat("nl-NL", {
    weekday: "short", day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit",
  });
  return fmt.format(d);
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
  // homeCand/awayCand komen uit de cascade. Override = winner is geen van beide cands.
  const winnerIsOverride =
    winner != null && winner !== homeCand && winner !== awayCand;
  const homeShown: string | undefined = winnerIsOverride ? winner : homeCand;
  const awayShown: string | undefined = awayCand;

  const fmt = formatKickoff(kickoff);

  return (
    <li className="px-3 sm:px-4 py-3 border-b border-border last:border-b-0">
      {/* Desktop (sm+): alles op één rij */}
      <div className="hidden sm:flex items-center gap-3">
        <div className="w-28 shrink-0 leading-tight">
          <div className="text-xs text-muted">{fmt}</div>
          <div className="font-mono text-[10px] text-muted/70 mt-0.5">W{fifaMatchNo}</div>
        </div>

        <div className="flex-1 min-w-0">
          <TeamPill
            code={homeShown}
            isWinner={winner != null && winner === homeShown}
            isLocked={isLocked}
            teamsByCode={teamsByCode}
            allTeams={allTeams}
            onClickPill={() => homeShown && onPick(winner === homeShown ? undefined : homeShown)}
            onPickFromList={(code) => onPick(code)}
          />
        </div>

        <div className="text-xs text-muted shrink-0 font-medium">vs</div>

        <div className="flex-1 min-w-0">
          <TeamPill
            code={awayShown}
            isWinner={winner != null && winner === awayShown}
            isLocked={isLocked}
            teamsByCode={teamsByCode}
            allTeams={allTeams}
            onClickPill={() => awayShown && onPick(winner === awayShown ? undefined : awayShown)}
            onPickFromList={(code) => onPick(code)}
          />
        </div>
      </div>

      {/* Mobile (< sm): 2 regels — teams boven, datum onder */}
      <div className="sm:hidden space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <TeamPill
              code={homeShown}
              isWinner={winner != null && winner === homeShown}
              isLocked={isLocked}
              teamsByCode={teamsByCode}
              allTeams={allTeams}
              onClickPill={() => homeShown && onPick(winner === homeShown ? undefined : homeShown)}
              onPickFromList={(code) => onPick(code)}
            />
          </div>
          <div className="text-xs text-muted shrink-0">vs</div>
          <div className="flex-1 min-w-0">
            <TeamPill
              code={awayShown}
              isWinner={winner != null && winner === awayShown}
              isLocked={isLocked}
              teamsByCode={teamsByCode}
              allTeams={allTeams}
              onClickPill={() => awayShown && onPick(winner === awayShown ? undefined : awayShown)}
              onPickFromList={(code) => onPick(code)}
            />
          </div>
        </div>
        <div className="flex items-center justify-between text-[11px] text-muted">
          <span>{fmt}</span>
          <span className="font-mono text-muted/70">W{fifaMatchNo}</span>
        </div>
      </div>

      <span className="hidden">{matchId}</span>
    </li>
  );
}

function TeamPill({
  code,
  isWinner,
  isLocked,
  teamsByCode,
  allTeams,
  onClickPill,
  onPickFromList,
}: {
  code: string | undefined;
  isWinner: boolean;
  isLocked: boolean;
  teamsByCode: ReadonlyMap<string, TeamLite>;
  allTeams: ReadonlyArray<TeamLite>;
  onClickPill: () => void;
  onPickFromList: (code: string) => void;
}) {
  const t = code ? teamsByCode.get(code) : undefined;

  // Winnaars in pitch-groen — consistent met fase 1 (groen = "ik kies dit").
  // Rood blijft alleen voor brand/Nijhuis-elementen elders in de app.
  const baseClass = isWinner
    ? "bg-pitch text-white border-pitch font-semibold"
    : "bg-bg border-border hover:border-pitch";

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
          className={`flex-1 flex items-center gap-1.5 px-2 py-2 text-sm text-left min-w-0 ${isLocked ? "cursor-not-allowed" : ""}`}
        >
          <span className="text-base leading-none shrink-0" aria-hidden>{flagEmoji(code!)}</span>
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
