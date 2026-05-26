"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

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
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("rank");
  const [paidState, setPaidState] = useState<Record<string, boolean>>(() => {
    const m: Record<string, boolean> = {};
    participants.forEach((p) => (m[p.user_id] = p.paid));
    return m;
  });
  const [savingId, setSavingId] = useState<string | null>(null);
  // Verwijder-modal state — open voor een specifieke deelnemer, tekst-bevestiging
  const [deleteTarget, setDeleteTarget] = useState<Participant | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function confirmDelete() {
    if (!deleteTarget || deleteConfirm !== "verwijderen") return;
    setDeleting(true);
    setDeleteError(null);
    const res = await fetch("/api/admin/delete-user", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: deleteTarget.user_id, confirm: deleteConfirm }),
    });
    setDeleting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setDeleteError(body?.error ?? "Verwijderen mislukt");
      return;
    }
    setDeleteTarget(null);
    setDeleteConfirm("");
    router.refresh();
  }

  function closeDeleteModal() {
    if (deleting) return;
    setDeleteTarget(null);
    setDeleteConfirm("");
    setDeleteError(null);
  }

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
                      <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                        <Link
                          href={`/voorspellingen/${p.user_id}`}
                          className="text-brand text-xs font-medium hover:underline"
                        >
                          bekijk →
                        </Link>
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteTarget(p);
                            setDeleteConfirm("");
                            setDeleteError(null);
                          }}
                          title="Deelnemer verwijderen"
                          aria-label={`Verwijder ${p.display_name}`}
                          className="text-muted/60 hover:text-brand transition text-base leading-none px-1.5"
                        >
                          ✕
                        </button>
                      </div>
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

      {/* ── Verwijder-modal ── */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-sm"
          onClick={closeDeleteModal}
        >
          <div
            className="w-full max-w-md bg-surface border border-border rounded-lg shadow-xl p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3 className="text-lg font-bold">Deelnemer verwijderen?</h3>
              <p className="text-sm text-muted mt-1">
                <strong>{deleteTarget.display_name}</strong>
                {deleteTarget.department && (
                  <span className="text-muted"> · {deleteTarget.department}</span>
                )}
                <br />
                Dit wist alle voorspellingen, knock-out picks, bonus, punten én het
                account. <strong>Niet terug te draaien.</strong>
              </p>
            </div>

            <label className="block">
              <span className="block text-sm font-medium mb-1.5">
                Typ <code className="bg-bg/60 px-1 rounded text-brand font-mono">verwijderen</code> om te bevestigen:
              </span>
              <input
                type="text"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                disabled={deleting}
                autoFocus
                placeholder="verwijderen"
                className="w-full border border-border bg-surface rounded-md px-3 py-2.5 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </label>

            {deleteError && (
              <div className="text-sm text-brand bg-brand-soft border border-brand/20 rounded px-3 py-2">
                {deleteError}
              </div>
            )}

            <div className="flex gap-2 justify-end pt-1">
              <button
                type="button"
                onClick={closeDeleteModal}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium border border-border rounded-md hover:bg-bg/60 transition disabled:opacity-50"
              >
                Annuleren
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting || deleteConfirm !== "verwijderen"}
                className="px-4 py-2 text-sm font-semibold bg-brand text-white rounded-md hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {deleting ? "Bezig…" : "Definitief verwijderen"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
