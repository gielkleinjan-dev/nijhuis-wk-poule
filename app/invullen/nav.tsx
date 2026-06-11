"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const BASE_TABS = [
  { href: "/invullen", label: "Mijn poule" },
  { href: "/ranglijst", label: "Ranglijst" },
];

const SUBTABS = [
  { href: "/invullen", label: "Groepsfase" },
  { href: "/invullen/knockout", label: "Knock-out" },
  { href: "/invullen/bonus", label: "Bonus" },
];

export default function InvullenNav({
  isAdmin,
  isLocked,
}: {
  isAdmin: boolean;
  isLocked?: boolean;
  lockAt?: string;
}) {
  const path = usePathname();
  const mainTabs = [
    ...BASE_TABS,
    ...((isLocked || isAdmin)
      ? [
          { href: "/voorspellingen", label: "Voorspellingen" },
          { href: "/voorspellingen/stats", label: "Stats" },
        ]
      : []),
    ...(isAdmin ? [{ href: "/admin", label: "Admin" }] : []),
  ];

  // Langste-match-wint: /voorspellingen/stats moet Stats actief maken,
  // niet Voorspellingen.
  const activeHref = mainTabs
    .filter((t) => path === t.href || path.startsWith(t.href + "/"))
    .reduce((best, t) => (t.href.length > best.length ? t.href : best), "");

  return (
    <>
      {/* Hoofdtabs */}
      <nav className="bg-surface border-b border-border">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="flex gap-2 min-w-0 overflow-x-auto overflow-y-hidden touch-pan-x overscroll-x-contain no-scrollbar">
            {mainTabs.map((t) => {
              const active = t.href === activeHref;
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  className={`px-3 sm:px-4 py-3 text-sm font-medium border-b-2 transition -mb-px whitespace-nowrap ${
                    active
                      ? "border-brand text-brand"
                      : "border-transparent text-muted hover:text-ink"
                  }`}
                >
                  {t.label}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
      {/* Subtabs — pill-stijl op zachte achtergrond, duidelijk een sub-niveau van Invullen */}
      <div className="bg-bg/60 border-b border-border">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 py-2 flex gap-1.5 items-center overflow-x-auto overflow-y-hidden touch-pan-x overscroll-x-contain no-scrollbar">
          <span className="text-[10px] uppercase tracking-wider text-muted font-semibold mr-1 hidden sm:inline">
            Onderdeel:
          </span>
          {SUBTABS.map((t) => {
            const active = path === t.href;
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`px-3 py-1.5 text-xs font-semibold rounded-full transition ${
                  active
                    ? "bg-brand text-white"
                    : "bg-surface border border-border text-muted hover:text-ink hover:border-brand/40"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
