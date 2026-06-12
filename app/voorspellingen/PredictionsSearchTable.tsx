"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type Row = {
  userId: string;
  rank: number | null;
  displayName: string;
  department: string | null;
  totalPoints: number;
};

// Diacritics-ongevoelig vergelijken zodat "joel" ook "Joël" vindt.
const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export default function PredictionsSearchTable({ rows }: { rows: Row[] }) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const needle = norm(q.trim());
    if (!needle) return rows;
    return rows.filter((r) => norm(r.displayName).includes(needle));
  }, [q, rows]);

  return (
    <div className="space-y-3">
      <div className="relative">
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

      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        {rows.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted">
            Geen deelnemers in dit overzicht.
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted">
            Geen naam gevonden voor <strong>{q}</strong>.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-bg/50 text-left text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-2.5 w-12">#</th>
                <th className="px-4 py-2.5">Naam</th>
                <th className="px-4 py-2.5 hidden sm:table-cell">Afdeling</th>
                <th className="px-4 py-2.5 text-right">Punten</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((p) => (
                <tr key={p.userId} className="hover:bg-bg/40">
                  <td className="px-4 py-2.5 tabular-nums text-muted">{p.rank ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/voorspellingen/${p.userId}`}
                      className="font-medium text-fg hover:text-brand"
                    >
                      {p.displayName}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-muted hidden sm:table-cell">{p.department ?? ""}</td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                    {p.totalPoints ?? 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
