"use client";

import { useState, useMemo, useCallback } from "react";
import { DEPARTMENTS } from "@/lib/departments";
import Link from "next/link";

type Row = {
  userId: string;
  displayName: string;
  department: string | null;
  secondaryDepartment: string | null;
  homePred: number | null;
  awayPred: number | null;
  totoPick: string | null;
};

type SortMode = "score" | "naam" | "team";

function deriveToto(r: Row): string | null {
  if (r.totoPick) return r.totoPick;
  if (r.homePred != null && r.awayPred != null) {
    return r.homePred > r.awayPred ? "1" : r.homePred < r.awayPred ? "2" : "X";
  }
  return null;
}

export default function MatchPredictionsClient({
  rows,
  actualHomeScore,
  actualAwayScore,
}: {
  rows: Row[];
  actualHomeScore: number | null;
  actualAwayScore: number | null;
}) {
  const [search, setSearch] = useState("");
  const [teamFilter, setTeamFilter] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("score");
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

  const toggleGroup = useCallback((key: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const filtered = useMemo(() => {
    let result = rows;

    if (teamFilter) {
      result = result.filter(
        (r) => r.department === teamFilter || r.secondaryDepartment === teamFilter
      );
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((r) => r.displayName.toLowerCase().includes(q));
    }

    if (sortMode === "score") {
      // Sorteer op uitslag, dan op naam binnen dezelfde uitslag
      result = [...result].sort((a, b) => {
        const aKey = `${String(a.homePred ?? -1).padStart(2, "0")}-${String(a.awayPred ?? -1).padStart(2, "0")}`;
        const bKey = `${String(b.homePred ?? -1).padStart(2, "0")}-${String(b.awayPred ?? -1).padStart(2, "0")}`;
        if (aKey !== bKey) return aKey < bKey ? 1 : -1;
        return a.displayName.localeCompare(b.displayName, "nl");
      });
    } else if (sortMode === "naam") {
      result = [...result].sort((a, b) =>
        a.displayName.localeCompare(b.displayName, "nl")
      );
    } else {
      result = [...result].sort((a, b) => {
        const aDep = a.department ?? "";
        const bDep = b.department ?? "";
        if (aDep !== bDep) return aDep.localeCompare(bDep, "nl");
        return a.displayName.localeCompare(b.displayName, "nl");
      });
    }

    return result;
  }, [rows, search, teamFilter, sortMode]);

  // Groepeer op uitslag als sortMode === "score"
  const grouped = useMemo(() => {
    if (sortMode !== "score") return null;
    const groups = new Map<string, Row[]>();
    for (const r of filtered) {
      const key =
        r.homePred != null && r.awayPred != null
          ? `${r.homePred}–${r.awayPred}`
          : "—";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(r);
    }
    // Sorteer groepen op populairiteit (meest voorkomend eerst)
    return Array.from(groups.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [filtered, sortMode]);

  const hasActual =
    actualHomeScore != null && actualAwayScore != null;
  const actualLabel = hasActual ? `${actualHomeScore}–${actualAwayScore}` : null;

  return (
    <div className="space-y-4">
      {/* Zoek + sorteerknopjes */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="search"
          placeholder="Zoek op naam…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
        />
        <div className="flex gap-1 shrink-0">
          {(["score", "naam", "team"] as SortMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setSortMode(mode)}
              className={`px-3 py-1.5 rounded-lg text-sm border transition ${
                sortMode === mode
                  ? "bg-brand text-white border-brand"
                  : "bg-surface border-border text-muted hover:border-brand"
              }`}
            >
              {mode === "score" ? "Uitslag" : mode === "naam" ? "Naam" : "Team"}
            </button>
          ))}
        </div>
      </div>

      {/* Teamfilter-pillen */}
      <div>
        <p className="text-xs text-muted mb-2">Filteren op team:</p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setTeamFilter(null)}
            className={`px-3 py-1 rounded-full text-sm border transition ${
              !teamFilter
                ? "bg-brand text-white border-brand"
                : "bg-surface border-border text-muted hover:border-brand"
            }`}
          >
            Alle
          </button>
          {DEPARTMENTS.map((dep) => (
            <button
              key={dep}
              onClick={() => setTeamFilter(teamFilter === dep ? null : dep)}
              className={`px-3 py-1 rounded-full text-sm border transition ${
                teamFilter === dep
                  ? "bg-brand text-white border-brand"
                  : "bg-surface border-border text-muted hover:border-brand"
              }`}
            >
              {dep.replace("Team ", "")}
            </button>
          ))}
        </div>
      </div>

      {/* Teller */}
      <div className="text-xs text-muted">
        {filtered.length}{" "}
        {filtered.length === 1 ? "deelnemer" : "deelnemers"}
        {(search.trim() || teamFilter) && " · gefilterd"}
      </div>

      {/* Gesorteerd op uitslag → gegroepeerde weergave */}
      {sortMode === "score" && grouped ? (
        <div className="bg-surface border border-border rounded-lg overflow-hidden divide-y divide-border">
          {grouped.map(([scoreLabel, members]) => {
            const isCorrect = hasActual && scoreLabel === actualLabel;
            const isOpen = openGroups.has(scoreLabel);
            return (
              <div key={scoreLabel}>
                {/* Klikbare header — altijd zichtbaar */}
                <button
                  type="button"
                  onClick={() => toggleGroup(scoreLabel)}
                  className={`w-full px-4 py-3 flex items-center justify-between gap-3 text-left transition hover:bg-bg/60 ${
                    isCorrect ? "bg-pitch/10" : "bg-bg/30"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className={`font-bold tabular-nums text-base ${isCorrect ? "text-pitch" : ""}`}>
                      {scoreLabel}
                    </span>
                    {isCorrect && (
                      <span className="text-[11px] font-normal text-pitch">✓</span>
                    )}
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-semibold text-muted tabular-nums">
                      {members.length}×
                    </span>
                    <span className="text-muted text-xs">{isOpen ? "▲" : "▼"}</span>
                  </span>
                </button>

                {/* Ingeklapte namen */}
                {isOpen && (
                  <ul className="divide-y divide-border border-t border-border">
                    {members.map((r) => {
                      const toto = deriveToto(r);
                      return (
                        <li
                          key={r.userId}
                          className="px-4 py-2.5 flex items-center justify-between gap-3 bg-surface"
                        >
                          <div className="min-w-0">
                            <Link
                              href={`/voorspellingen/${r.userId}`}
                              className="font-medium text-sm hover:text-brand transition"
                            >
                              {r.displayName}
                            </Link>
                            <div className="text-xs text-muted truncate">
                              {[r.department, r.secondaryDepartment]
                                .filter(Boolean)
                                .join(" · ") || "—"}
                            </div>
                          </div>
                          {toto && (
                            <span className="shrink-0 inline-block bg-brand text-white rounded px-1.5 py-0.5 text-xs font-bold">
                              {toto}
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* Naam / team-sort → platte tabel */
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted">
              Geen deelnemers gevonden.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-bg/50 text-left text-xs uppercase text-muted">
                <tr>
                  <th className="px-4 py-2.5">Naam</th>
                  <th className="px-4 py-2.5 hidden sm:table-cell">Team</th>
                  <th className="px-4 py-2.5 text-center">Voorspelling</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((r) => {
                  const toto = deriveToto(r);
                  const isCorrect =
                    hasActual &&
                    r.homePred === actualHomeScore &&
                    r.awayPred === actualAwayScore;
                  return (
                    <tr key={r.userId} className="hover:bg-bg/40">
                      <td className="px-4 py-2.5">
                        <Link
                          href={`/voorspellingen/${r.userId}`}
                          className="font-medium hover:text-brand transition"
                        >
                          {r.displayName}
                        </Link>
                        <div className="text-xs text-muted sm:hidden">
                          {[r.department, r.secondaryDepartment]
                            .filter(Boolean)
                            .join(" · ") || "—"}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-muted hidden sm:table-cell">
                        {[r.department, r.secondaryDepartment]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span
                          className={`font-semibold tabular-nums ${
                            isCorrect ? "text-pitch" : ""
                          }`}
                        >
                          {r.homePred != null && r.awayPred != null
                            ? `${r.homePred}–${r.awayPred}`
                            : "—"}
                        </span>
                        {toto && (
                          <span className="ml-1.5 inline-block bg-brand text-white rounded px-1.5 py-0.5 text-xs font-bold">
                            {toto}
                          </span>
                        )}
                        {isCorrect && (
                          <span className="ml-1 text-[10px] text-pitch">✓</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
