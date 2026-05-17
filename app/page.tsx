import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import BrandLogo from "@/app/components/BrandLogo";

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="min-h-screen flex flex-col">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between">
          <BrandLogo />
          {user && (
            <Link href="/ranglijst" className="text-sm font-medium hover:text-brand">
              Ranglijst
            </Link>
          )}
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 py-16">
        <p className="text-sm font-bold uppercase tracking-wider text-brand mb-3">
          WK 2026 · 11 juni – 19 juli
        </p>
        <h1 className="text-5xl md:text-6xl font-bold leading-tight mb-4 display">
          De WK-poule
          <br />
          van Nijhuis.
        </h1>
        <p className="text-lg text-muted max-w-xl mb-8">
          Voorspel alle 104 wedstrijden, van groepsfase tot finale. Punten
          worden automatisch bijgehouden — invullen kan tot 11 juni 18:00.
        </p>

        {user ? (
          <div className="flex flex-wrap gap-3">
            <Link
              href="/invullen"
              className="px-6 py-3 bg-brand text-white rounded-md font-semibold hover:bg-brand-dark transition"
            >
              Naar invulformulier
            </Link>
            <Link
              href="/ranglijst"
              className="px-6 py-3 border border-border bg-surface rounded-md font-semibold hover:bg-brand-soft transition"
            >
              Bekijk ranglijst
            </Link>
          </div>
        ) : (
          <Link
            href="/login"
            className="inline-block px-6 py-3 bg-brand text-white rounded-md font-semibold hover:bg-brand-dark transition"
          >
            Doe mee
          </Link>
        )}

        <div className="grid sm:grid-cols-3 gap-4 mt-16">
          <Feature
            emoji="📝"
            title="Ineens invullen"
            text="Voorspel groepsfase, knock-out én bonusvragen. Eén keer goed."
          />
          <Feature
            emoji="⚡"
            title="Automatische punten"
            text="Uitslagen komen live binnen, je stand ziet je direct."
          />
          <Feature
            emoji="📬"
            title="Dagelijkse mail"
            text="Wie steeg, wie zakte, wat zei de AI-commentator?"
          />
        </div>
      </section>
    </main>
  );
}

function Feature({ emoji, title, text }: { emoji: string; title: string; text: string }) {
  return (
    <div className="bg-surface border border-border rounded-lg p-5">
      <div className="text-2xl mb-2">{emoji}</div>
      <div className="font-semibold mb-1">{title}</div>
      <div className="text-sm text-muted">{text}</div>
    </div>
  );
}
