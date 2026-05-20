import { createSupabaseServerClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { flagEmoji } from "@/lib/flags";

const NL_PROGRESS_LABEL: Record<string, string> = {
  GROUP_STAGE: "Uitgeschakeld in groepsfase",
  LAST_32: "Uitgeschakeld in 1/16e finale",
  LAST_16: "Uitgeschakeld in 1/8e finale",
  QUARTER_FINALS: "Uitgeschakeld in kwartfinale",
  SEMI_FINALS: "Uitgeschakeld in halve finale",
  FINAL_LOSER: "Verliest finale (tweede plaats)",
  CHAMPION: "Wereldkampioen",
};

export default async function VoorspellingDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const supabase = await createSupabaseServerClient();

  const [
    { data: profile },
    { data: predictionsRaw },
    { data: bracketPicksRaw },
    { data: bonusRow },
    { data: teamsRaw },
    { data: groupMatches },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, department")
      .eq("id", userId)
      .single(),
    supabase
      .from("predictions")
      .select("match_id, home_score, away_score, toto_pick")
      .eq("user_id", userId),
    supabase
      .from("bracket_picks")
      .select("round, slot, team_code")
      .eq("user_id", userId),
    supabase
      .from("bonus_picks")
      .select("top_scorer, total_goals_tiebreak, total_yellow_cards_tiebreak, nl_top_scorer, nl_total_goals, nl_progress")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase.from("teams").select("code, name"),
    supabase
      .from("matches")
      .select("id, home_team, away_team, group_name, kickoff_at")
      .eq("stage", "GROUP_STAGE")
      .order("kickoff_at"),
  ]);

  if (!profile) notFound();

  const teamName = new Map((teamsRaw ?? []).map((t) => [t.code, t.name]));
  const predByMatch = new Map((predictionsRaw ?? []).map((p) => [p.match_id, p]));

  // Bracket picks per categorie
  const phaseA = new Map<string, { rank1?: string; rank2?: string; rank3?: string }>();
  const phaseB = new Set<string>();
  const koPicks: Record<string, string[]> = { LAST_32: [], LAST_16: [], QUARTER_FINALS: [], SEMI_FINALS: [], FINAL: [], CHAMPION: [] };

  for (const p of bracketPicksRaw ?? []) {
    if (!p.team_code) continue;
    if (p.round === "GROUP_TOP_2" && typeof p.slot === "number") {
      const rank = Math.floor(p.slot / 12) + 1;
      const groupIdx = p.slot % 12;
      const g = String.fromCharCode("A".charCodeAt(0) + groupIdx);
      const entry = phaseA.get(g) ?? {};
      if (rank === 1) entry.rank1 = p.team_code;
      else if (rank === 2) entry.rank2 = p.team_code;
      else if (rank === 3) entry.rank3 = p.team_code;
      phaseA.set(g, entry);
    } else if (p.round === "BEST_THIRDS") {
      phaseB.add(p.team_code);
    } else if (p.round in koPicks) {
      koPicks[p.round].push(p.team_code);
    }
  }

  // Groepsfase voorspellingen — per poule een tabel met de toto's
  const matchesByGroup = new Map<string, typeof groupMatches>();
  for (const m of groupMatches ?? []) {
    const g = m.group_name ?? "?";
    if (!matchesByGroup.has(g)) matchesByGroup.set(g, []);
    matchesByGroup.get(g)!.push(m);
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 space-y-6">
      <div>
        <Link href="/voorspellingen" className="text-sm text-muted hover:text-fg">← terug naar alle deelnemers</Link>
        <h1 className="text-2xl font-bold mt-2">{profile.display_name}</h1>
        {profile.department && <p className="text-sm text-muted">{profile.department}</p>}
      </div>

      {/* Groepsfase */}
      <section className="bg-surface border border-border rounded-lg p-5">
        <h2 className="text-lg font-bold mb-3">Groepsfase</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from(matchesByGroup.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([g, ms]) => (
            <div key={g} className="border border-border rounded-md p-3 bg-bg/30">
              <p className="font-semibold text-sm mb-2">{g.replace("GROUP_", "Poule ")}</p>
              <table className="w-full text-xs">
                <tbody className="divide-y divide-border">
                  {(ms ?? []).map((m) => {
                    const pred = predByMatch.get(m.id);
                    return (
                      <tr key={m.id}>
                        <td className="py-1 pr-1 truncate">{teamName.get(m.home_team ?? "") ?? m.home_team}</td>
                        <td className="py-1 px-1 text-center tabular-nums">
                          {pred?.home_score ?? "—"}-{pred?.away_score ?? "—"}
                        </td>
                        <td className="py-1 pl-1 truncate">{teamName.get(m.away_team ?? "") ?? m.away_team}</td>
                        <td className="py-1 pl-2 text-muted text-[10px]">{pred?.toto_pick ?? ""}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </section>

      {/* Knock-out stap 1 + 2 */}
      <section className="bg-surface border border-border rounded-lg p-5">
        <h2 className="text-lg font-bold mb-3">Knock-out — Top 2 per poule + beste nummers 3</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 text-sm">
          {Array.from(phaseA.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([g, ranks]) => (
            <div key={g} className="border border-border rounded-md p-2 bg-bg/30">
              <p className="font-semibold text-xs mb-1">Poule {g}</p>
              <ul className="space-y-0.5">
                {ranks.rank1 && (
                  <li className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold bg-pitch text-white px-1 rounded">1e</span>
                    <span aria-hidden>{flagEmoji(ranks.rank1)}</span>
                    <span>{teamName.get(ranks.rank1) ?? ranks.rank1}</span>
                  </li>
                )}
                {ranks.rank2 && (
                  <li className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold bg-pitch/70 text-white px-1 rounded">2e</span>
                    <span aria-hidden>{flagEmoji(ranks.rank2)}</span>
                    <span>{teamName.get(ranks.rank2) ?? ranks.rank2}</span>
                  </li>
                )}
                {phaseB.has(ranks.rank1 ?? "") || phaseB.has(ranks.rank2 ?? "") ? null : null}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-xs font-semibold text-muted mb-2">8 beste nummers 3 (doorgaande)</p>
          <div className="flex flex-wrap gap-2">
            {Array.from(phaseB).map((code) => (
              <span key={code} className="inline-flex items-center gap-1.5 bg-amber-500 text-white text-xs font-medium px-2 py-1 rounded">
                <span aria-hidden>{flagEmoji(code)}</span>
                <span>{teamName.get(code) ?? code}</span>
              </span>
            ))}
            {phaseB.size === 0 && <span className="text-xs text-muted italic">niets gekozen</span>}
          </div>
        </div>
      </section>

      {/* Bracket-winnaars per ronde */}
      <section className="bg-surface border border-border rounded-lg p-5">
        <h2 className="text-lg font-bold mb-3">Bracket — winnaars per ronde</h2>
        <div className="space-y-3">
          {[
            { key: "LAST_32", label: "1/16e finale", count: 16 },
            { key: "LAST_16", label: "1/8e finale", count: 8 },
            { key: "QUARTER_FINALS", label: "Kwartfinale", count: 4 },
            { key: "SEMI_FINALS", label: "Halve finale", count: 2 },
            { key: "FINAL", label: "Finale (wereldkampioen)", count: 1 },
          ].map(({ key, label }) => (
            <div key={key}>
              <p className="text-xs font-semibold text-muted mb-1">{label}</p>
              <div className="flex flex-wrap gap-1.5">
                {(koPicks[key] ?? []).map((code, i) => (
                  <span key={`${code}-${i}`} className="inline-flex items-center gap-1 bg-pitch-soft text-pitch text-xs font-medium px-2 py-0.5 rounded">
                    <span aria-hidden>{flagEmoji(code)}</span>
                    <span>{teamName.get(code) ?? code}</span>
                  </span>
                ))}
                {(koPicks[key] ?? []).length === 0 && <span className="text-xs text-muted italic">niets gekozen</span>}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Bonusvragen */}
      <section className="bg-surface border border-border rounded-lg p-5">
        <h2 className="text-lg font-bold mb-3">Bonusvragen</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <dt className="text-muted">Topscorer toernooi</dt>
          <dd>{bonusRow?.top_scorer || <span className="text-muted italic">—</span>}</dd>
          <dt className="text-muted">Totaal doelpunten</dt>
          <dd>{bonusRow?.total_goals_tiebreak ?? <span className="text-muted italic">—</span>}</dd>
          <dt className="text-muted">Totaal gele kaarten</dt>
          <dd>{bonusRow?.total_yellow_cards_tiebreak ?? <span className="text-muted italic">—</span>}</dd>
          <dt className="text-muted pt-2">🇳🇱 Topscorer NL</dt>
          <dd className="pt-2">{bonusRow?.nl_top_scorer || <span className="text-muted italic">—</span>}</dd>
          <dt className="text-muted">🇳🇱 Goals NL</dt>
          <dd>{bonusRow?.nl_total_goals ?? <span className="text-muted italic">—</span>}</dd>
          <dt className="text-muted">🇳🇱 Ronde NL</dt>
          <dd>{bonusRow?.nl_progress ? (NL_PROGRESS_LABEL[bonusRow.nl_progress] ?? bonusRow.nl_progress) : <span className="text-muted italic">—</span>}</dd>
        </dl>
      </section>
    </div>
  );
}
