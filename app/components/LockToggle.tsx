"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LockToggle({
  isLocked,
}: {
  isLocked: boolean;
  lockAt: string;
}) {
  const [locked, setLocked] = useState(isLocked);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function toggle() {
    const next = locked ? "unlock" : "lock";
    if (next === "lock") {
      const ok = confirm(
        "Weet je zeker dat je de poule wilt SLUITEN? Daarna kunnen deelnemers niets meer wijzigen."
      );
      if (!ok) return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/lock", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: next }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(`Mislukt (${res.status}): ${body.error ?? "onbekende fout"}`);
        return;
      }
      setLocked(!locked);
      router.refresh();
    } catch (e) {
      alert(`Netwerkfout: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      title={locked ? "Poule gesloten — klik om weer te openen" : "Poule open — klik om te sluiten"}
      className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border-2 transition shrink-0 disabled:opacity-50 ${
        locked
          ? "bg-brand text-white border-brand hover:opacity-90"
          : "bg-pitch-soft border-pitch/30 text-pitch hover:border-pitch/60"
      }`}
    >
      {locked ? "🔒" : "🔓"}
      <span>
        {locked ? "Invullen & wijzigen gesloten" : "Invullen & wijzigen kan nog"}
      </span>
    </button>
  );
}
