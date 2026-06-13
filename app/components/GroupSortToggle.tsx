import Link from "next/link";

export type GroupSort = "datum" | "poule";

// Kleine segmented toggle om de groepsfase op datum/tijd of op poule te tonen.
// Werkt via de URL (?sort=…) zodat de pagina server-side gesorteerd rendert —
// zelfde patroon als het afdelingsfilter. scroll={false} houdt je op je plek.
export default function GroupSortToggle({
  basePath,
  current,
}: {
  basePath: string;
  current: GroupSort;
}) {
  const opts: { val: GroupSort; label: string; href: string }[] = [
    { val: "datum", label: "Datum", href: basePath },
    { val: "poule", label: "Poule", href: `${basePath}?sort=poule` },
  ];
  return (
    <div className="inline-flex rounded-lg border border-border overflow-hidden text-xs shrink-0">
      {opts.map((o) => (
        <Link
          key={o.val}
          href={o.href}
          scroll={false}
          aria-pressed={current === o.val}
          className={`px-3 py-1.5 font-medium transition ${
            current === o.val
              ? "bg-brand text-white"
              : "bg-surface text-muted hover:text-brand"
          }`}
        >
          {o.label}
        </Link>
      ))}
    </div>
  );
}
