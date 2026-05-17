"use client";

import { useState } from "react";
import Link from "next/link";

type Participant = {
  user_id: string;
  display_name: string;
  department: string | null;
  total_points: number;
  rank: number;
};

export default function AdminSearch({ participants }: { participants: Participant[] }) {
  const [query, setQuery] = useState("");

  const filtered = query.trim()
    ? participants.filter((p) =>
        p.display_name.toLowerCase().includes(query.trim().toLowerCase())
      )
    : participants;

  return (
    <div className="space-y-3">
      <input
        type="text"
        placeholder="Zoek op naam…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full border border-border rounded-lg px-4 py-2.5 text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-brand"
      />

      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        {filtered.length === 0 ? (
          <p className="p-6 text-muted text-sm text-center">Geen deelnemers gevonden.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg/50 text-left text-xs font-semibold text-muted uppercase tracking-wide">
                <th className="px-4 py-3 w-10">#</th>
                <th className="px-4 py-3">Naam</th>
                <th className="px-4 py-3 hidden sm:table-cell">Team</th>
                <th className="px-4 py-3 text-right">Punten</th>
                <th className="px-4 py-3 w-16" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => (
                <tr
                  key={p.user_id}
                  className={`border-b border-border last:border-0 transition ${
                    i % 2 === 0 ? "bg-surface" : "bg-bg/30"
                  }`}
                >
                  <td className="px-4 py-3 tabular-nums text-muted">{p.rank}</td>
                  <td className="px-4 py-3 font-medium">{p.display_name}</td>
                  <td className="px-4 py-3 text-muted text-xs hidden sm:table-cell">
                    {p.department ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-bold">
                    {p.total_points}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/${p.user_id}`}
                      className="text-brand text-xs font-medium hover:underline"
                    >
                      bekijk →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {query.trim() && (
        <p className="text-xs text-muted text-center">
          {filtered.length} van {participants.length} ·{" "}
          <button onClick={() => setQuery("")} className="text-brand underline">
            wis filter
          </button>
        </p>
      )}
    </div>
  );
}
