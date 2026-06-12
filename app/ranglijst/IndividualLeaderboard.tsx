"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

export type LeaderboardEntry = {
  userId: string;
  rank: number;
  displayName: string;
  depLabel: string;
  totalPoints: number;
  delta: number | null;
  isMe: boolean;
  rockets: number;
  chutes: number;
};

// Diacritics-ongevoelig vergelijken zodat "joel" ook "Joël" vindt.
const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export default function IndividualLeaderboard({
  rows,
  showMedals,
  hasMovement,
  afdeling,
}: {
  rows: LeaderboardEntry[];
  showMedals: boolean;
  hasMovement: boolean;
  afdeling?: string | null;
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const needle = norm(q.trim());
    if (!needle) return rows;
    return rows.filter((r) => norm(r.displayName).includes(needle));
  }, [q, rows]);

  return (
    <>
      {/* Zoekbalk — eigen grid-rij (rij 2, kolom 1) zodat de teamtabel hieronder
          even ver opschuift en beide tabellen op dezelfde hoogte beginnen. */}
      <div className="order-2 lg:col-start-1 lg:row-start-2 relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden>🔍</span>
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Zoek een naam…"
          className="w-full border border-border bg-surface rounded-lg pl-9 pr-9 py-2.5 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand"
        />
        {q && (
          <button
            type="button"
            onClick={() => setQ("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-fg px-1.5"
            aria-label="Wissen"
          >
            ✕
          </button>
        )}
      </div>

      {/* Individuele tabel — rij 3, kolom 1 */}
      <div className="order-3 lg:col-start-1 lg:row-start-3 space-y-4">
      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        {rows.length === 0 ? (
          <p className="p-6 text-muted text-sm text-center">Geen deelnemers gevonden.</p>
        ) : filtered.length === 0 ? (
          <p className="p-6 text-muted text-sm text-center">
            Geen naam gevonden voor <strong>{q}</strong>.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg/50 text-left text-xs font-semibold text-muted uppercase tracking-wide">
                <th className="px-2 sm:px-4 py-3 w-10 sm:w-12">#</th>
                <th className="px-2 sm:px-4 py-3">Naam</th>
                <th className="px-4 py-3 hidden md:table-cell">Team</th>
                {hasMovement && <th className="px-2 sm:px-3 py-3 text-center w-10 sm:w-14">+/−</th>}
                <th className="px-2 sm:px-4 py-3 text-right">Punten</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => {
                const d = row.delta;
                return (
                  <tr
                    key={row.userId}
                    className={`border-b border-border last:border-0 transition ${
                      row.isMe ? "bg-brand-soft" : i % 2 === 0 ? "bg-surface" : "bg-bg/30"
                    }`}
                  >
                    <td className="px-4 py-3 tabular-nums font-medium">
                      {row.rank === 1 && showMedals ? (
                        <span className="text-lg">🥇</span>
                      ) : row.rank === 2 && showMedals ? (
                        <span className="text-lg">🥈</span>
                      ) : row.rank === 3 && showMedals ? (
                        <span className="text-lg">🥉</span>
                      ) : (
                        <span className={row.isMe ? "text-brand font-bold" : "text-muted"}>
                          {row.rank}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      <span className="inline-flex items-center gap-1.5 flex-wrap">
                        <Link
                          href={`/voorspellingen/${row.userId}`}
                          className="hover:text-brand hover:underline underline-offset-2 transition"
                        >
                          {row.displayName}
                        </Link>
                        {row.isMe && <span className="text-xs text-brand font-normal">(jij)</span>}
                        {row.rockets > 0 && <span title="Stijger">{"🚀".repeat(row.rockets)}</span>}
                        {row.chutes > 0 && <span title="Daler">{"🪂".repeat(row.chutes)}</span>}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted hidden sm:table-cell text-xs">
                      {row.depLabel}
                    </td>
                    {hasMovement && (
                      <td className="px-3 py-3 text-center tabular-nums text-xs font-semibold">
                        {d == null ? (
                          <span className="text-muted">—</span>
                        ) : d > 0 ? (
                          <span className="text-green-600">▲{d}</span>
                        ) : d < 0 ? (
                          <span className="text-brand">▼{Math.abs(d)}</span>
                        ) : (
                          <span className="text-blue-400">=</span>
                        )}
                      </td>
                    )}
                    <td className="px-4 py-3 text-right tabular-nums font-bold">
                      {row.totalPoints}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {afdeling && (
        <p className="text-sm text-muted text-center">
          Gefilterd op team <strong>{afdeling}</strong> ·{" "}
          <Link href="/ranglijst" className="text-brand underline">
            toon iedereen
          </Link>
        </p>
      )}
      </div>
    </>
  );
}
