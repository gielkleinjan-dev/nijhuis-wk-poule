"use client";

import { useState } from "react";
import Link from "next/link";

type Participant = {
  user_id: string;
  display_name: string;
  department: string | null;
  total_points: number;
  rank: number;
  paid: boolean;
  group_filled: number;
  knockout_filled: number;
  bonus_filled: number;
  progress_pct: number;
};

type Sort = "rank" | "name" | "progress_asc" | "unpaid_first";

export default function AdminSearch({ participants }: { participants: Participant[] }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("rank");
  const [paidState, setPaidState] = useState<Record<string, boolean>>(() => {
    const m: Record<string, boolean> = {};
    participants.forEach((p) => (m[p.user_id] = p.paid));
    return m;
  });
  const [savingId, setSavingId] = useState<string | null>(null);

  async function togglePaid(userId: string, next: boolean) {
    setPaidState((s) => ({ ...s, [userId]: next }));
    setSavingId(userId);
    const res = await fetch("/api/admin/toggle-paid", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId, paid: next }),
    });
    if (!res.ok) {
      setPaidState((s) => ({ ...s, [userId]: !next }));
      alert("Opslaan mislukt");
    }
    setSavingId(null);
  }

  const filtered = query.trim()
    ? participants.filter((p) =>
        p.display_name.toLowerCase().includes(query.trim().toLowerCase())
      )
    : participants;

  const sorted = [...filtered].sort((a, b) => {
    if (sort === "name") return a.display_name.localeCompare(b.display_name, "nl");
    if (sort === "progress_asc") return a.progress_pct - b.progress_pct;
    if (sort === "unpaid_first") {
      const ap = paidState[a.user_id] ? 1 : 0;
      const bp = paidState[b.user_id] ? 1 : 0;
      if (ap !== bp) return ap - bp;
      return a.rank - b.rank;
    }
    return a.rank - b.rank;
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="text"
          placeholder="Zoek op naam…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 min-w-48 border border-border rounded-lg px-4 py-2.5 text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-brand"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className="border border-border rounded-lg px-3 py-2.5 text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-brand"
        >
          <option value="rank">Sorteer: ranglijst</option>
          <option value="name">Sorteer: naam A-Z</option>
          <option value="progress_asc">Sorteer: minste voortgang eerst</option>
          <option value="unpaid_first">Sorteer: niet betaald eerst</option>
        </select>
      </div>

      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        {sorted.length === 0 ? (
          <p className="p-6 text-muted text-sm text-center">Geen deelnemers gevonden.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg/50 text-left text-xs font-semibold text-muted uppercase tracking-wide">
                <th className="px-2 sm:px-3 py-3 w-8 sm:w-10">#</th>
                <th className="px-2 sm:px-3 py-3">Naam</th>
                <th className="px-3 py-3 hidden md:table-cell">Team</th>
                <th className="px-2 sm:px-3 py-3 w-14 sm:w-20 text-center">Betaald</th>
                <th className="px-2 sm:px-3 py-3 w-24 sm:w-44">Voortgang</th>
                <th className="px-2 sm:px-3 py-3 text-right w-12 sm:w-16 hidden sm:table-cell">Punten</th>
                <th className="px-2 sm:px-3 py-3 w-14 sm:w-20" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((p, i) => {
                const isPaid = paidState[p.user_id] ?? false;
                return (
                  <tr
                    key={p.user_id}
                    className={`border-b border-border last:border-0 transition ${
                      i % 2 === 0 ? "bg-surface" : "bg-bg/30"
                    }`}
                  >
                    <td className="px-2 sm:px-3 py-3 tabular-nums text-muted">{p.rank}</td>
                    <td className="px-2 sm:px-3 py-3 font-medium">
                      {p.display_name}
                      <span className="md:hidden block text-xs text-muted">
                        {p.department ?? "—"}
                      </span>
                      <span className="sm:hidden block text-xs text-muted tabular-nums">
                        {p.total_points} pt
                      </span>
                    </td>
                    <td className="px-3 py-3 text-muted text-xs hidden md:table-cell">
                      {p.department ?? "—"}
                    </td>
                    <td className="px-2 sm:px-3 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={isPaid}
                        disabled={savingId === p.user_id}
                        onChange={(e) => togglePaid(p.user_id, e.target.checked)}
                        className="w-4 h-4 accent-pitch cursor-pointer"
                        aria-label="Betaald"
                      />
                    </td>
                    <td className="px-2 sm:px-3 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-bg rounded-full overflow-hidden">
                          <div
                            className={`h-full ${
                              p.progress_pct === 100 ? "bg-pitch" : "bg-brand"
                            }`}
                            style={{ width: `${p.progress_pct}%` }}
                          />
                        </div>
                        <span className="text-xs tabular-nums text-muted w-9 text-right">
                          {p.progress_pct}%
                        </span>
                      </div>
                      <div className="text-[10px] text-muted mt-1 tabular-nums hidden sm:block">
                        {p.group_filled}/72 groep · {p.knockout_filled}/31 ko · {p.bonus_filled}/3 bonus
                      </div>
                    </td>
                    <td className="px-2 sm:px-3 py-3 text-right tabular-nums font-bold hidden sm:table-cell">
                      {p.total_points}
                    </td>
                    <td className="px-2 sm:px-3 py-3 text-right">
                      <Link
                        href={`/admin/${p.user_id}`}
                        className="text-brand text-xs font-medium hover:underline whitespace-nowrap"
                      >
                        bekijk →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {query.trim() && (
        <p className="text-xs text-muted text-center">
          {sorted.length} van {participants.length} ·{" "}
          <button onClick={() => setQuery("")} className="text-brand underline">
            wis filter
          </button>
        </p>
      )}
    </div>
  );
}
