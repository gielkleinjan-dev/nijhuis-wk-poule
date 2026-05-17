"use client";

import { useState } from "react";
import Link from "next/link";
import BrandLogo from "@/app/components/BrandLogo";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent">("idle");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    await fetch("/api/forgot-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setStatus("sent");
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <header className="mb-8">
        <BrandLogo size="large" />
      </header>

      <div className="w-full max-w-md bg-surface border border-border rounded-lg shadow-sm p-8 space-y-5">
        {status === "sent" ? (
          <div className="text-center space-y-2">
            <div className="text-4xl">📬</div>
            <h1 className="text-2xl font-bold">Mail onderweg</h1>
            <p className="text-muted text-sm">
              Als <b className="text-ink">{email}</b> bekend is, krijg je een mail met een
              link om een nieuw wachtwoord in te stellen.
            </p>
            <p className="pt-4">
              <Link href="/login" className="text-brand underline text-sm">
                ← Terug naar inloggen
              </Link>
            </p>
          </div>
        ) : (
          <>
            <div>
              <h1 className="text-2xl font-bold mb-1">Wachtwoord vergeten</h1>
              <p className="text-muted text-sm">
                Vul je e-mailadres in. Je krijgt een link om een nieuw wachtwoord te kiezen.
              </p>
            </div>
            <form onSubmit={onSubmit} className="space-y-4">
              <label className="block">
                <span className="block text-sm font-medium mb-1.5">E-mailadres</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full border border-border bg-surface rounded-md px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand"
                />
              </label>
              <button
                type="submit"
                disabled={status === "loading"}
                className="w-full bg-brand text-white py-3 rounded-md font-semibold hover:opacity-90 transition disabled:opacity-50"
              >
                {status === "loading" ? "Versturen…" : "Stuur reset-link"}
              </button>
              <p className="text-xs text-muted text-center pt-1">
                <Link href="/login" className="text-brand underline">
                  ← Terug naar inloggen
                </Link>
              </p>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
