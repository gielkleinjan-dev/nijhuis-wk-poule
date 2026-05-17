"use client";

type Section = { label: string; filled: number; total: number };

export default function ProgressBar({ sections }: { sections: Section[] }) {
  const allDone = sections.every((s) => s.filled >= s.total);

  return (
    <div className="border-b border-border bg-surface">
      <div className="mx-auto max-w-4xl px-6 py-3 flex gap-4 flex-wrap">
        {sections.map((s) => {
          const pct = s.total === 0 ? 0 : Math.round((s.filled / s.total) * 100);
          const done = s.filled >= s.total;
          return (
            <div key={s.label} className="flex items-center gap-2 min-w-0 flex-1">
              <span
                className={`text-xs font-medium shrink-0 ${done ? "text-pitch" : "text-muted"}`}
              >
                {done ? "✓" : "○"} {s.label}
              </span>
              <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden min-w-[40px]">
                <div
                  className={`h-full rounded-full transition-all ${done ? "bg-pitch" : "bg-brand"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-[11px] text-muted tabular-nums shrink-0">
                {s.filled}/{s.total}
              </span>
            </div>
          );
        })}
        {allDone && (
          <span className="text-xs font-semibold text-pitch shrink-0 self-center">
            Alles ingevuld 🎉
          </span>
        )}
      </div>
    </div>
  );
}
