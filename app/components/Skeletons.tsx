// Herbruikbare laad-skeletons. Tonen direct grijze placeholder-vormen bij
// tab-navigatie, zodat de app meteen reageert i.p.v. een bevroren scherm te
// laten staan tot de server klaar is. Puur visueel, geen data.

export function HeroSkeleton() {
  return (
    <div className="bg-surface border border-border rounded-lg p-5 space-y-3">
      <div className="skeleton h-7 w-48" />
      <div className="skeleton h-4 w-64" />
    </div>
  );
}

export function RowsSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden divide-y divide-border">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <div className="skeleton h-4 w-6 shrink-0" />
          <div className="skeleton h-4 w-1/3" />
          <div className="skeleton h-4 w-10 ml-auto shrink-0" />
        </div>
      ))}
    </div>
  );
}

// Header- + nav-balk placeholder voor pagina's die hun eigen chrome renderen
// (ranglijst, uitslagen) — daar valt de skeleton niet onder een layout-nav.
export function ChromeSkeleton({ maxWidth = "max-w-4xl" }: { maxWidth?: string }) {
  return (
    <>
      <header className="border-b border-border bg-surface">
        <div className={`mx-auto ${maxWidth} px-4 sm:px-6 py-4 flex items-center justify-between gap-4`}>
          <div className="skeleton h-7 w-32" />
          <div className="skeleton h-8 w-8 rounded-full" />
        </div>
      </header>
      <div className="bg-surface border-b border-border">
        <div className={`mx-auto ${maxWidth} px-4 sm:px-6 flex gap-5 py-3.5`}>
          {["w-20", "w-16", "w-24", "w-12"].map((w, i) => (
            <div key={i} className={`skeleton h-4 ${w}`} />
          ))}
        </div>
      </div>
    </>
  );
}
