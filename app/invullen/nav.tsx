"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const BASE_TABS = [
  { href: "/invullen", label: "Invullen" },
  { href: "/ranglijst", label: "Ranglijst" },
];

const SUBTABS = [
  { href: "/invullen", label: "Groepsfase" },
  { href: "/invullen/knockout", label: "Knock-out" },
  { href: "/invullen/bonus", label: "Bonus" },
];

export default function InvullenNav({
  isAdmin,
}: {
  isAdmin: boolean;
  isLocked?: boolean;
  lockAt?: string;
}) {
  const path = usePathname();
  const mainTabs = [
    ...BASE_TABS,
    ...(isAdmin ? [{ href: "/admin", label: "Admin" }] : []),
  ];

  return (
    <nav className="bg-surface border-b border-border">
      {/* Hoofdtabs */}
      <div className="mx-auto max-w-4xl px-6 flex items-center gap-2 border-b border-border">
        <div className="flex gap-2 flex-1">
          {mainTabs.map((t) => {
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
      {/* Subtabs */}
      <div className="mx-auto max-w-4xl px-6 flex gap-2">
        {SUBTABS.map((t) => {
          const active = path === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${
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
    </nav>
  );
}
