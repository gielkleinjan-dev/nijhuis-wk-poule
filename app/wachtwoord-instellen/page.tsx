"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import BrandLogo from "@/app/components/BrandLogo";

export default function SetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      setErrorMsg("Minstens 6 tekens");
      setStatus("error");
      return;
    }
    if (password !== confirm) {
      setErrorMsg("Wachtwoorden komen niet overeen");
      setStatus("error");
      return;
    }
    setStatus("loading");
    setErrorMsg("");

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setErrorMsg(error.message);
      setStatus("error");
      return;
    }

    router.push("/invullen");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <header className="mb-8">
        <BrandLogo size="large" />
      </header>

      <div className="w-full max-w-md bg-surface border border-border rounded-lg shadow-sm p-8 space-y-5">
        <div>
          <h1 className="text-2xl font-bold mb-1">Nieuw wachtwoord</h1>
          <p className="text-muted text-sm">
            Kies een nieuw wachtwoord. Hierna ben je direct ingelogd.
          </p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block">
            <span className="block text-sm font-medium mb-1.5">Nieuw wachtwoord</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
              className="w-full border border-border bg-surface rounded-md px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand"
            />
          </label>
          <label className="block">
            <span className="block text-sm font-medium mb-1.5">Herhaal wachtwoord</span>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              required
              className="w-full border border-border bg-surface rounded-md px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand"
            />
          </label>
          <button
            type="submit"
            disabled={status === "loading"}
            className="w-full bg-brand text-white py-3 rounded-md font-semibold hover:opacity-90 transition disabled:opacity-50"
          >
            {status === "loading" ? "Opslaan…" : "Wachtwoord opslaan"}
          </button>
          {errorMsg && (
            <p className="text-brand text-sm bg-brand-soft border border-brand/20 rounded px-3 py-2">
              {errorMsg}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
