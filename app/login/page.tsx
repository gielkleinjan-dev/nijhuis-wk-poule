"use client";

import { useEffect, useState } from "react";
import { DEPARTMENTS } from "@/lib/departments";
import BrandLogo from "@/app/components/BrandLogo";

type Mode = "new" | "returning";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("new");

  // New user form
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");

  // Returning user form
  const [returnEmail, setReturnEmail] = useState("");

  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const u = new URL(window.location.href);
    const err = u.searchParams.get("error");
    if (err) {
      setErrorMsg(`Inloglink mislukt: ${err}. Probeer opnieuw.`);
      setStatus("error");
    }
  }, []);

  function switchMode(next: Mode) {
    setMode(next);
    setStatus("idle");
    setErrorMsg("");
  }

  async function onSubmitNew(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code, email, name, department }),
    });
    if (res.ok) setStatus("sent");
    else {
      const body = await res.json().catch(() => ({}));
      setErrorMsg(body.error || "Er ging iets mis");
      setStatus("error");
    }
  }

  async function onSubmitReturning(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: returnEmail }),
    });
    if (res.ok) setStatus("sent");
    else {
      const body = await res.json().catch(() => ({}));
      setErrorMsg(body.error || "Er ging iets mis");
      setStatus("error");
    }
  }

  const sentEmail = mode === "new" ? email : returnEmail;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <header className="mb-8">
        <BrandLogo size="large" />
      </header>

      <div className="w-full max-w-md bg-surface border border-border rounded-lg shadow-sm overflow-hidden">
        {status === "sent" ? (
          <div className="p-8 text-center space-y-3 py-10">
            <div className="text-4xl">📬</div>
            <h1 className="text-2xl font-bold">Check je mail</h1>
            <p className="text-muted">
              Een inloglink is verstuurd naar
              <br />
              <b className="text-ink">{sentEmail}</b>
            </p>
            <p className="text-sm text-muted pt-2">Niets gekregen? Check je spam.</p>
            <button
              onClick={() => setStatus("idle")}
              className="text-sm text-brand underline pt-1"
            >
              Opnieuw proberen
            </button>
          </div>
        ) : (
          <>
            {/* Mode tabs */}
            <div className="flex border-b border-border">
              <button
                onClick={() => switchMode("new")}
                className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition ${
                  mode === "new"
                    ? "border-brand text-brand"
                    : "border-transparent text-muted hover:text-ink"
                }`}
              >
                Eerste keer
              </button>
              <button
                onClick={() => switchMode("returning")}
                className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition ${
                  mode === "returning"
                    ? "border-brand text-brand"
                    : "border-transparent text-muted hover:text-ink"
                }`}
              >
                Al ingeschreven
              </button>
            </div>

            <div className="p-8">
              {mode === "new" ? (
                <>
                  <h1 className="text-2xl font-bold mb-1">Registreren</h1>
                  <p className="text-muted text-sm mb-6">
                    Vul je gegevens in en je krijgt een inloglink per mail.
                  </p>
                  <form onSubmit={onSubmitNew} className="space-y-4">
                    <Field
                      label="Invite-code"
                      value={code}
                      onChange={(v) => setCode(v.toUpperCase())}
                      required
                      hint="Vraag de poule-beheerder als je deze niet hebt."
                    />
                    <Field label="Jouw naam" value={name} onChange={setName} required />
                    <label className="block">
                      <span className="block text-sm font-medium mb-1.5">
                        Afdeling (optioneel)
                      </span>
                      <select
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        className="w-full border border-border bg-surface rounded-md px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand"
                      >
                        <option value="">— Kies je team —</option>
                        {DEPARTMENTS.map((d) => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </label>
                    <Field
                      label="E-mailadres"
                      value={email}
                      onChange={setEmail}
                      type="email"
                      required
                    />
                    <button
                      type="submit"
                      disabled={status === "loading"}
                      className="w-full bg-brand text-white py-3 rounded-md font-semibold hover:opacity-90 transition disabled:opacity-50"
                    >
                      {status === "loading" ? "Versturen…" : "Stuur inloglink"}
                    </button>
                    {errorMsg && <ErrorMsg msg={errorMsg} />}
                  </form>
                </>
              ) : (
                <>
                  <h1 className="text-2xl font-bold mb-1">Inloggen</h1>
                  <p className="text-muted text-sm mb-6">
                    Vul je e-mailadres in en je ontvangt een inloglink.
                  </p>
                  <form onSubmit={onSubmitReturning} className="space-y-4">
                    <Field
                      label="E-mailadres"
                      value={returnEmail}
                      onChange={setReturnEmail}
                      type="email"
                      required
                      placeholder="naam@nijhuis.nl"
                    />
                    <button
                      type="submit"
                      disabled={status === "loading"}
                      className="w-full bg-brand text-white py-3 rounded-md font-semibold hover:opacity-90 transition disabled:opacity-50"
                    >
                      {status === "loading" ? "Versturen…" : "Stuur inloglink"}
                    </button>
                    {errorMsg && <ErrorMsg msg={errorMsg} />}
                  </form>
                </>
              )}
            </div>
          </>
        )}
      </div>

      <p className="text-xs text-muted mt-6">
        Met liefde gebouwd voor collega&apos;s • WK 2026
      </p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium mb-1.5">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        className="w-full border border-border bg-surface rounded-md px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand"
      />
      {hint && <span className="block text-xs text-muted mt-1">{hint}</span>}
    </label>
  );
}

function ErrorMsg({ msg }: { msg: string }) {
  return (
    <p className="text-brand text-sm bg-brand-soft border border-brand/20 rounded px-3 py-2">
      {msg}
    </p>
  );
}
