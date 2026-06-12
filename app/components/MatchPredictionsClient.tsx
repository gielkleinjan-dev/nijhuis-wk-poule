"use client";

import { useState, useMemo, useCallback } from "react";
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

type SortMode = "score" | "naam";

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
    } else {
      result = [...result].sort((a, b) =>
        a.displayName.localeCompare(b.displayName, "nl")
      );
    }

    return result;
  }, [rows, search, sortMode]);

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
  // Werkelijke toto (1/X/2) voor de +1-arcering bij een goede toto zonder exacte score.
  const actualToto = hasActual
    ? actualHomeScore! > actualAwayScore!
      ? "1"
      : actualHomeScore! < actualAwayScore!
        ? "2"
        : "X"
    : null;

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
          {(["score", "naam"] as SortMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setSortMode(mode)}
              className={`px-3 py-1.5 rounded-lg text-sm border transition ${
                sortMode === mode
                  ? "bg-brand text-white border-brand"
                  : "bg-surface border-border text-muted hover:border-brand"
              }`}
            >
              {mode === "score" ? "Uitslag" : "Naam"}
            </button>
          ))}
        </div>
      </div>

      {/* Teller */}
      <div className="text-xs text-muted">
        {filtered.length}{" "}
        {filtered.length === 1 ? "deelnemer" : "deelnemers"}
        {search.trim() && " · gefilterd"}
      </div>

      {/* Gesorteerd op uitslag → gegroepeerde weergave */}
      {sortMode === "score" && grouped ? (
        <div className="bg-surface border border-border rounded-lg overflow-hidden divide-y divide-border">
          {grouped.map(([scoreLabel, members]) => {
            const gh = members[0].homePred;
            const ga = members[0].awayPred;
            const hasScore = gh != null && ga != null;
            const homeOk = hasActual && gh != null && gh === actualHomeScore;
            const awayOk = hasActual && ga != null && ga === actualAwayScore;
            const isCorrect = homeOk && awayOk;
            const groupToto = hasScore ? (gh! > ga! ? "1" : gh! < ga! ? "2" : "X") : null;
            const totoOk = hasActual && !isCorrect && groupToto != null && groupToto === actualToto;
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
                    <span className="font-bold tabular-nums text-base">
                      {hasScore ? (
                        <>
                          <span className={homeOk ? "text-pitch" : ""} title={homeOk ? "thuisscore goed (+2)" : undefined}>{gh}</span>
                          <span className="text-muted font-normal mx-0.5">–</span>
                          <span className={awayOk ? "text-pitch" : ""} title={awayOk ? "uitscore goed (+2)" : undefined}>{ga}</span>
                        </>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </span>
                    {isCorrect && (
                      <span className="text-[11px] font-normal text-pitch">✓</span>
                    )}
                    {totoOk && (
                      <span className="text-[11px] font-medium text-pitch/70" title="toto goed (+1)">+1</span>
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
        /* Naam-sort → platte tabel */
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
                  const homeOk = hasActual && r.homePred != null && r.homePred === actualHomeScore;
                  const awayOk = hasActual && r.awayPred != null && r.awayPred === actualAwayScore;
                  const isCorrect = homeOk && awayOk;
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
                        <span className="font-semibold tabular-nums">
                          {r.homePred != null && r.awayPred != null ? (
                            <>
                              <span className={homeOk ? "text-pitch" : ""} title={homeOk ? "thuisscore goed (+2)" : undefined}>{r.homePred}</span>
                              <span className="text-muted font-normal mx-0.5">–</span>
                              <span className={awayOk ? "text-pitch" : ""} title={awayOk ? "uitscore goed (+2)" : undefined}>{r.awayPred}</span>
                            </>
                          ) : (
                            "—"
                          )}
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
