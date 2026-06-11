"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const BASE_TABS = [
  { href: "/invullen", label: "Mijn poule" },
  { href: "/ranglijst", label: "Ranglijst" },
];

export default function MainNav({
  isAdmin,
  isLocked,
  maxWidth = "max-w-5xl",
}: {
  isAdmin: boolean;
  isLocked?: boolean;
  lockAt?: string;
  maxWidth?: string;
}) {
  const path = usePathname();
  const tabs = [
    ...BASE_TABS,
    // "Voorspellingen" en "Stats" verschijnen voor iedereen zodra de poule
    // gesloten is. Admins zien ze altijd voor preview.
    ...((isLocked || isAdmin)
      ? [
          { href: "/voorspellingen", label: "Voorspellingen" },
          { href: "/voorspellingen/stats", label: "Stats" },
        ]
      : []),
    ...(isAdmin ? [{ href: "/admin", label: "Admin" }] : []),
  ];

  // Langste-match-wint: /voorspellingen/stats moet Stats actief maken,
  // niet Voorspellingen (zou allebei matchen op simple startsWith).
  const activeHref = tabs
    .filter((t) => path === t.href || path.startsWith(t.href + "/"))
    .reduce((best, t) => (t.href.length > best.length ? t.href : best), "");

  return (
    <nav className="bg-surface border-b border-border">
      <div className={`mx-auto ${maxWidth} px-4 sm:px-6`}>
        <div className="flex gap-2 min-w-0 overflow-x-auto overflow-y-hidden touch-pan-x overscroll-x-contain no-scrollbar">
          {tabs.map((t) => {
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
  );
}
