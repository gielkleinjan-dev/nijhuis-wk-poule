import { createSupabaseServerClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function VoorspellingenPage() {
  const supabase = await createSupabaseServerClient();

  const { data: leaderboard } = await supabase
    .from("leaderboard")
    .select("user_id, display_name, department, total_points, rank")
    .order("rank", { ascending: true });

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 space-y-6">
      <div className="bg-surface border border-border rounded-lg p-5">
        <h1 className="text-2xl font-bold mb-1">Voorspellingen van alle deelnemers</h1>
        <p className="text-sm text-muted">
          De poule is gesloten en alle keuzes zijn vastgezet. Klik op een naam om iemands
          ingevulde poulebriefje te bekijken.
        </p>
      </div>

      <div className="bg-surface border border-border rounded-lg overflow-hidden">
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
            {(leaderboard ?? []).map((p) => (
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
      </div>
    </div>
  );
}
