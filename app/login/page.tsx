"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DEPARTMENTS } from "@/lib/departments";
import BrandLogo from "@/app/components/BrandLogo";
import ThemeToggle from "@/app/components/ThemeToggle";

type Mode = "new" | "returning";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("new");

  // New user form
  const [inviteCode, setInviteCode] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const [password, setPassword] = useState("");

  // Returning user form
  const [returnEmail, setReturnEmail] = useState("");
  const [returnPassword, setReturnPassword] = useState("");

  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const u = new URL(window.location.href);
    const err = u.searchParams.get("error");
    if (err) {
      setErrorMsg(`Inloggen mislukt: ${err}. Probeer opnieuw.`);
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
      body: JSON.stringify({ code: inviteCode, email, name, department, password }),
    });
    if (res.ok) {
      router.push("/invullen");
      router.refresh();
    } else {
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
      body: JSON.stringify({ email: returnEmail, password: returnPassword }),
    });
    if (res.ok) {
      router.push("/invullen");
      router.refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      setErrorMsg(body.error || "Er ging iets mis");
      setStatus("error");
    }
  }

  return (
    <main className="min-h-screen relative">
      {/* Compact brand-logo linksboven + theme-toggle rechtsboven */}
      <div className="absolute top-4 left-4 sm:top-6 sm:left-6 z-20">
        <BrandLogo size="compact" />
      </div>
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20">
        <ThemeToggle />
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-20 sm:pt-24 pb-12 lg:pb-16">
        <div className="grid lg:grid-cols-[1.1fr_minmax(0,28rem)] gap-6 lg:gap-10 items-stretch">

          {/* ── Hero block (links op desktop, boven op mobile) ── */}
          <div className="tab-hero bg-surface border border-border rounded-2xl p-8 sm:p-10 lg:p-12 flex flex-col justify-center">
            <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur border border-white/25 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider mb-5 self-start">
              <span className="w-2 h-2 rounded-full bg-trophy animate-pulse" />
              WK 2026 · 11 juni – 19 juli
            </div>
            <h1 className="display text-3xl sm:text-5xl leading-[1.05] mb-4">
              De Nijhuis Bouw<br />
              <span className="text-trophy">WK Poule</span>
            </h1>
            <p className="text-base sm:text-lg text-muted max-w-md mb-6">
              Voorspel alle 104 wedstrijden, volg je stand live tijdens het toernooi.
              Inschrijven kan tot 11 juni 18:00.
            </p>
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold">
              <span className="inline-flex items-center gap-1.5"><span className="text-trophy">48</span> landen</span>
              <span className="inline-flex items-center gap-1.5"><span className="text-trophy">104</span> wedstrijden</span>
              <span className="inline-flex items-center gap-1.5"><span className="text-trophy">1</span> winnaar</span>
            </div>
          </div>

          {/* ── Form card (rechts op desktop, onder op mobile) ── */}
          <div className="w-full bg-surface border border-border rounded-2xl shadow-sm overflow-hidden">
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
                Vul je gegevens in en kies een wachtwoord. Daarna kun je direct meedoen.
              </p>
              <form onSubmit={onSubmitNew} className="space-y-4">
                <Field
                  label="Invite-code"
                  value={inviteCode}
                  onChange={(v) => setInviteCode(v.toUpperCase())}
                  required
                  hint="Vraag de poule-beheerder als je deze niet hebt."
                />
                <Field label="Jouw naam" value={name} onChange={setName} required />
                <label className="block">
                  <span className="block text-sm font-medium mb-1.5">Afdeling</span>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    required
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
                <Field
                  label="Wachtwoord"
                  value={password}
                  onChange={setPassword}
                  type="password"
                  required
                  hint="Minstens 6 tekens. Onthoud 'm — je hebt 'm elke keer nodig."
                />
                <div className="bg-amber-50 border border-amber-300 text-amber-900 rounded-md px-3 py-2 text-xs">
                  <strong>Let op:</strong> gebruik <u>niet</u> je gewone Nijhuis-wachtwoord.
                </div>
                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="w-full bg-brand text-white py-3 rounded-md font-semibold hover:opacity-90 transition disabled:opacity-50"
                >
                  {status === "loading" ? "Bezig…" : "Registreren"}
                </button>
                {errorMsg && <ErrorMsg msg={errorMsg} />}
              </form>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold mb-1">Inloggen</h1>
              <p className="text-muted text-sm mb-6">
                Vul je e-mailadres en wachtwoord in.
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
                <Field
                  label="Wachtwoord"
                  value={returnPassword}
                  onChange={setReturnPassword}
                  type="password"
                  required
                />
                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="w-full bg-brand text-white py-3 rounded-md font-semibold hover:opacity-90 transition disabled:opacity-50"
                >
                  {status === "loading" ? "Inloggen…" : "Inloggen"}
                </button>
                {errorMsg && <ErrorMsg msg={errorMsg} />}
                <p className="text-xs text-muted text-center pt-1">
                  <Link href="/wachtwoord-vergeten" className="text-brand underline">
                    Wachtwoord vergeten?
                  </Link>
                </p>
              </form>
            </>
          )}
          </div>
          </div>
        </div>

        <p className="text-xs text-muted mt-8 text-center">
          Met liefde gebouwd voor collega&apos;s • WK 2026
        </p>
      </div>
    </main>
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
        autoComplete={
          type === "password" ? (required ? "new-password" : "current-password") : undefined
        }
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
