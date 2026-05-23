import { createSupabaseServerClient } from "@/lib/supabase/server";
import Link from "next/link";
import { DEPARTMENTS } from "@/lib/departments";

export default async function VoorspellingenPage({
  searchParams,
}: {
  searchParams: Promise<{ afdeling?: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const { afdeling } = await searchParams;

  const { data: leaderboard } = await supabase
    .from("leaderboard")
    .select("user_id, display_name, department, total_points, rank")
    .order("rank", { ascending: true });

  const rows = leaderboard ?? [];
  const filtered = afdeling ? rows.filter((r) => r.department === afdeling) : rows;

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <div className="tab-hero bg-surface border border-border rounded-lg p-5">
        <div className="flex items-baseline justify-between gap-3 mb-1">
          <h1 className="text-2xl font-bold leading-tight">Voorspellingen van alle deelnemers</h1>
          <div className="shrink-0 text-right leading-tight">
            <div className="text-xl font-bold tabular-nums">
              {filtered.length}
              {afdeling && (
                <span className="text-sm text-muted font-normal">/{rows.length}</span>
              )}
            </div>
            <div className="text-[10px] text-muted">deelnemers</div>
          </div>
        </div>
        <p className="text-sm text-muted">
          De poule is gesloten en alle keuzes zijn vastgezet. Klik op een naam om iemands
          ingevulde voorspellingen te bekijken.
        </p>
      </div>

      {/* Filter-pillen op afdeling — zelfde patroon als /ranglijst */}
      <div>
        <p className="text-xs text-muted mb-2">Filteren op team:</p>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/voorspellingen"
            className={`px-3 py-1 rounded-full text-sm border transition ${
              !afdeling
                ? "bg-brand text-white border-brand"
                : "bg-surface border-border text-muted hover:border-brand"
            }`}
          >
            Alle
          </Link>
          {DEPARTMENTS.map((dep) => (
            <Link
              key={dep}
              href={`/voorspellingen?afdeling=${encodeURIComponent(dep)}`}
              className={`px-3 py-1 rounded-full text-sm border transition ${
                afdeling === dep
                  ? "bg-brand text-white border-brand"
                  : "bg-surface border-border text-muted hover:border-brand"
              }`}
            >
              {dep}
            </Link>
          ))}
        </div>
      </div>

      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        {filtered.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted">
            Geen deelnemers in {afdeling ? `team ${afdeling}` : "dit overzicht"}.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-bg/50 text-left text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-2.5 w-12">#</th>
                <th className="px-4 py-2.5">Naam</th>
                <th className="px-4 py-2.5 hidden sm:table-cell">Afdeling</th>
                <th className="px-4 py-2.5 text-right">Punten</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((p) => (
                <tr key={p.user_id} className="hover:bg-bg/40">
                  <td className="px-4 py-2.5 tabular-nums text-muted">{p.rank ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/voorspellingen/${p.user_id}`}
                      className="font-medium text-fg hover:text-brand"
                    >
                      {p.display_name}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-muted hidden sm:table-cell">{p.department ?? ""}</td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                    {p.total_points ?? 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
