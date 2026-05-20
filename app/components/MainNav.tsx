"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const BASE_TABS = [
  { href: "/invullen", label: "Invullen" },
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
    // "Voorspellingen" verschijnt voor iedereen zodra de poule gesloten is.
    // Admins kunnen 'm altijd zien.
    ...((isLocked || isAdmin) ? [{ href: "/voorspellingen", label: "Voorspellingen" }] : []),
    ...(isAdmin ? [{ href: "/admin", label: "Admin" }] : []),
  ];

  return (
    <nav className="bg-surface border-b border-border">
      <div className={`mx-auto ${maxWidth} px-6 flex items-center gap-2`}>
        <div className="flex gap-2 flex-1">
          {tabs.map((t) => {
            const active = path.startsWith(t.href);
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition -mb-px ${
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
