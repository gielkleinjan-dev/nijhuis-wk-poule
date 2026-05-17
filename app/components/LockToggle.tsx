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
    setLoading(true);
    const res = await fetch("/api/admin/lock", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: locked ? "unlock" : "lock" }),
    });
    if (res.ok) {
      setLocked(!locked);
      router.refresh();
    }
    setLoading(false);
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      title={locked ? "Poule gesloten — klik om te openen" : "Poule open — klik om te sluiten"}
      className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border transition shrink-0 ${
        locked
          ? "bg-brand-soft border-brand/30 text-brand"
          : "bg-pitch-soft border-pitch/30 text-pitch"
      } disabled:opacity-50`}
    >
      {locked ? "🔒" : "🔓"}
      <span className="hidden sm:inline">{locked ? "Gesloten" : "Open"}</span>
    </button>
  );
}
