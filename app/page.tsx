import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import BrandLogo from "@/app/components/BrandLogo";
import UserHeader from "@/app/components/UserHeader";
import ThemeToggle from "@/app/components/ThemeToggle";

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let lockAt = "2026-06-11T17:00:00Z";
  let isLocked = false;
  if (user) {
    const { data: settings } = await supabase
      .from("settings")
      .select("lock_at")
      .eq("id", 1)
      .single();
    lockAt = settings?.lock_at ?? lockAt;
    isLocked = new Date(lockAt) <= new Date();
  }

  return (
    <main className="min-h-screen flex flex-col">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-4 flex items-center justify-between gap-3 sm:gap-4">
          <BrandLogo />
          <div className="flex items-center gap-2 sm:gap-3">
            {user ? (
              <UserHeader
                displayName={user.user_metadata?.display_name || user.email || ""}
                isAdmin={isAdmin(user.email)}
                isLocked={isLocked}
                lockAt={lockAt}
              />
            ) : null}
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* ── Nijhuis hero (default) ─────────────────────────────── */}
      <section className="nijhuis-only mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-10 w-full space-y-6">
        <div className="nijhuis-hero relative px-6 sm:px-12 py-12 sm:py-20">
          <div className="relative max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur border border-white/25 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider mb-5">
              <span className="w-2 h-2 rounded-full bg-trophy animate-pulse" />
              WK 2026 · 11 juni – 19 juli
            </div>
            <h1 className="display text-4xl sm:text-6xl leading-[1.05] mb-4">
              De Nijhuis Bouw<br />
              <span className="text-trophy">WK Poule</span>
            </h1>
            <p className="text-base sm:text-lg text-white/90 max-w-xl mb-8">
              104 wedstrijden, 48 landen, één toernooi. Voorspel alles vooraf
              en volg live wie er bij Nijhuis bovenaan klimt.
            </p>
            {user ? (
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/invullen"
                  className="px-7 py-4 bg-white text-brand rounded-xl font-bold text-base shadow-lg hover:bg-trophy-soft transition"
                >
                  Vul je voorspelling in →
                </Link>
                <Link
                  href="/ranglijst"
                  className="px-7 py-4 border-2 border-white/40 bg-white/10 backdrop-blur text-white rounded-xl font-bold text-base hover:bg-white/20 transition"
                >
                  Stand bekijken
                </Link>
              </div>
            ) : (
              <Link
                href="/login"
                className="inline-block px-7 py-4 bg-white text-brand rounded-xl font-bold text-base shadow-lg hover:bg-trophy-soft transition"
              >
                Doe mee →
              </Link>
            )}
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <NijhuisPhotoFeature
            bgClass="nijhuis-photo-crowd"
            stat="48"
            label="Landen"
            text="Het eerste WK met 48 landen. Wie wordt de verrassing?"
          />
          <NijhuisPhotoFeature
            bgClass="nijhuis-photo-match"
            stat="104"
            label="Wedstrijden"
            text="Van openingsfluit tot wereldkampioen — voorspel alle 104."
          />
          <NijhuisPhotoFeature
            bgClass="nijhuis-photo-trophy"
            stat="1"
            label="Winnaar"
            text="Eén land pakt de trofee. Eén collega pakt de eer."
          />
        </div>

        <div className="bg-surface border border-border rounded-2xl p-6 sm:p-8 grid sm:grid-cols-3 gap-6">
          <Feature emoji="📝" title="Ineens invullen" text="Groepsfase, knock-out én bonusvragen — in één keer goed." />
          <Feature emoji="⚡" title="Live punten" text="Uitslagen komen live binnen, je stand bij elk fluitsignaal." />
          <Feature emoji="📈" title="Stijgers & dalers" text="Pijltjes per deelnemer en team — zie wie het hardst klimt." />
        </div>
      </section>

      {/* ── Scorito hero (alternatieve modus) ──────────────────── */}
      <section className="scorito-only mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-10 w-full space-y-6">
        <div className="scorito-hero relative px-6 sm:px-12 py-12 sm:py-20">
          <div className="relative max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur border border-white/20 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider mb-5">
              <span className="w-2 h-2 rounded-full bg-[#11c38b] animate-pulse" />
              WK 2026 · 11 juni – 19 juli
            </div>
            <h1 className="display text-4xl sm:text-6xl leading-[1.05] mb-4">
              Speel de poule.<br />
              <span className="text-[#11c38b]">Verover</span> de bouwplaats.
            </h1>
            <p className="text-base sm:text-lg text-white/80 max-w-xl mb-8">
              104 wedstrijden. 16 stadions. 1 winnaar in jouw kantoor. Voorspel
              alles vooraf, volg je stand live tijdens het toernooi.
            </p>
            {user ? (
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/invullen"
                  className="px-7 py-4 bg-brand text-white rounded-xl font-bold text-base shadow-lg hover:bg-brand-dark transition"
                >
                  Vul je voorspelling in →
                </Link>
                <Link
                  href="/ranglijst"
                  className="px-7 py-4 border-2 border-white/30 bg-white/5 backdrop-blur text-white rounded-xl font-bold text-base hover:bg-white/15 transition"
                >
                  Stand bekijken
                </Link>
              </div>
            ) : (
              <Link
                href="/login"
                className="inline-block px-7 py-4 bg-brand text-white rounded-xl font-bold text-base shadow-lg hover:bg-brand-dark transition"
              >
                Doe mee →
              </Link>
            )}
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <PhotoFeature
            bgClass="scorito-photo-ball"
            stat="48"
            label="Landen"
            text="Het eerste WK met 48 landen. Wie wordt de verrassing?"
          />
          <PhotoFeature
            bgClass="scorito-photo-stadium"
            stat="104"
            label="Wedstrijden"
            text="Van openingsfluit tot wereldkampioen — voorspel alle 104."
          />
          <PhotoFeature
            bgClass="scorito-photo-trophy"
            stat="1"
            label="Winnaar"
            text="Eén land pakt de trofee. Eén collega pakt de eer."
          />
        </div>

        <div className="bg-surface border border-border rounded-2xl p-6 sm:p-8 grid sm:grid-cols-3 gap-6">
          <ScoritoStat icon="📝" title="Ineens invullen" text="Groepsfase, knock-out én bonusvragen — in één keer goed." />
          <ScoritoStat icon="⚡" title="Live punten" text="Uitslagen komen live binnen, je stand bij elk fluitsignaal." />
          <ScoritoStat icon="📈" title="Stijgers & dalers" text="Pijltjes per deelnemer en team — zie wie het hardst klimt." />
        </div>
      </section>
    </main>
  );
}

function Feature({ emoji, title, text }: { emoji: string; title: string; text: string }) {
  return (
    <div>
      <div className="text-2xl mb-2">{emoji}</div>
      <div className="font-bold text-base mb-1">{title}</div>
      <div className="text-sm text-muted leading-snug">{text}</div>
    </div>
  );
}

function NijhuisPhotoFeature({
  bgClass,
  stat,
  label,
  text,
}: {
  bgClass: string;
  stat: string;
  label: string;
  text: string;
}) {
  return (
    <div className={`${bgClass} relative rounded-2xl p-6 min-h-[200px] flex flex-col justify-end text-white overflow-hidden`}>
      <div className="text-5xl font-extrabold leading-none mb-1">{stat}</div>
      <div className="text-sm uppercase tracking-wider font-bold text-white/90 mb-2">{label}</div>
      <div className="text-xs text-white/85 leading-snug">{text}</div>
    </div>
  );
}

function PhotoFeature({
  bgClass,
  stat,
  label,
  text,
}: {
  bgClass: string;
  stat: string;
  label: string;
  text: string;
}) {
  return (
    <div className={`${bgClass} relative rounded-2xl p-6 min-h-[200px] flex flex-col justify-end text-white overflow-hidden`}>
      <div className="text-5xl font-extrabold leading-none mb-1">{stat}</div>
      <div className="text-sm uppercase tracking-wider font-bold text-white/90 mb-2">{label}</div>
      <div className="text-xs text-white/75 leading-snug">{text}</div>
    </div>
  );
}

function ScoritoStat({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <div>
      <div className="text-2xl mb-2">{icon}</div>
      <div className="font-bold text-base mb-1">{title}</div>
      <div className="text-sm text-muted leading-snug">{text}</div>
    </div>
  );
}
