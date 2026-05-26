import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin";
import Link from "next/link";
import { flagEmoji } from "@/lib/flags";

export const dynamic = "force-dynamic";

/**
 * Stats van de poule — geaggregeerde voorspellingen van alle deelnemers.
 * Nooit individuele picks tonen, alleen tellingen + verdelingen.
 *
 * Toegankelijk:
 *   - Voor admin: altijd (preview vóór lock OK)
 *   - Voor niet-admin: alleen na lock (zelfde regel als /voorspellingen)
 */

// ── Helpers ────────────────────────────────────────────────────────────────
type Tally = { code: string; n: number; pct: number };

function tally<T extends string | null>(values: T[]): Tally[] {
  const counts = new Map<string, number>();
  let total = 0;
  for (const v of values) {
    if (v == null || v === "") continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
    total++;
  }
  return Array.from(counts.entries())
    .map(([code, n]) => ({ code, n, pct: total > 0 ? (n / total) * 100 : 0 }))
    .sort((a, b) => b.n - a.n);
}

const NL_PROGRESS_LABEL: Record<string, string> = {
  GROUP_STAGE: "Uit in groepsfase",
  LAST_32: "Uit in 1/16e finale",
  LAST_16: "Uit in 1/8e finale",
  QUARTER_FINALS: "Uit in kwartfinale",
  SEMI_FINALS: "Uit in halve finale",
  FINAL_LOSER: "Verliest finale",
  CHAMPION: "Wereldkampioen!",
};

function Bar({ pct, color = "bg-brand" }: { pct: number; color?: string }) {
  return (
    <div className="h-2 bg-border rounded-full overflow-hidden">
      <div className={`h-full ${color} rounded-full`} style={{ width: `${Math.max(2, pct)}%` }} />
    </div>
  );
}

function StatCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-surface border border-border rounded-lg p-5">
      <h3 className="font-bold text-base leading-tight mb-0.5">{title}</h3>
      {subtitle && <p className="text-xs text-muted mb-3">{subtitle}</p>}
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function TallyList({
  tally,
  limit = 5,
  teamName,
  showFlag = true,
}: {
  tally: Tally[];
  limit?: number;
  teamName?: Map<string, string>;
  showFlag?: boolean;
}) {
  if (tally.length === 0) {
    return <div className="text-sm text-muted italic">Nog geen data.</div>;
  }
  return (
    <div className="space-y-1.5">
      {tally.slice(0, limit).map((t) => (
        <div key={t.code}>
          <div className="flex items-baseline justify-between gap-2 mb-0.5 text-sm">
            <div className="flex items-center gap-1.5 min-w-0">
              {showFlag && <span className="flag-emoji" aria-hidden>{flagEmoji(t.code)}</span>}
              <span className="font-medium truncate">{teamName?.get(t.code) ?? t.code}</span>
            </div>
            <span className="tabular-nums text-xs text-muted shrink-0">
              {t.n}× <span className="font-semibold">({Math.round(t.pct)}%)</span>
            </span>
          </div>
          <Bar pct={t.pct} />
        </div>
      ))}
    </div>
  );
}

// ── Hoofd-page ─────────────────────────────────────────────────────────────
export default async function StatsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Lock-check: niet-admins mogen pas na lock
  const { data: settings } = await supabase
    .from("settings")
    .select("lock_at")
    .eq("id", 1)
    .maybeSingle();
  const lockAt = settings?.lock_at ? new Date(settings.lock_at) : null;
  const isLocked = lockAt ? lockAt.getTime() <= Date.now() : false;
  if (!isLocked && !isAdmin(user.email)) redirect("/voorspellingen");

  // ── Fetch all the data we need ───────────────────────────────────────────
  const [
    { data: bracketPicks },
    { data: bonusPicks },
    { data: predictions },
    { data: teamsRaw },
    { data: matchesRaw },
    { count: totalUsers },
  ] = await Promise.all([
    supabase.from("bracket_picks").select("round, slot, team_code, user_id"),
    supabase.from("bonus_picks").select("top_scorer, total_goals_tiebreak, nl_top_scorer, nl_total_goals, nl_progress"),
    supabase.from("predictions").select("match_id, home_score, away_score, toto_pick"),
    supabase.from("teams").select("code, name"),
    supabase
      .from("matches")
      .select("id, group_name, stage, home_team, away_team")
      .eq("stage", "GROUP_STAGE"),
    supabase.from("profiles").select("id", { count: "exact", head: true }).neq("department", "__LOADTEST__").neq("department", "__SCORING_TEST__"),
  ]);

  const teamName = new Map((teamsRaw ?? []).map((t) => [t.code, t.name]));
  const teamCount = (teamsRaw ?? []).length;

  // ── Aggregations ────────────────────────────────────────────────────────

  // Wereldkampioen-picks: round=FINAL slot=1 = de winnaar van de finale
  const championPicks = (bracketPicks ?? []).filter((p) => p.round === "FINAL" && p.slot === 1);
  const championTally = tally(championPicks.map((p) => p.team_code));

  // Finalisten: round=SEMI_FINALS = de twee winnaars van de halve finales (slot 1+2)
  const finalistPicks = (bracketPicks ?? []).filter((p) => p.round === "SEMI_FINALS");
  const finalistTally = tally(finalistPicks.map((p) => p.team_code));

  // Halve finalisten: round=QUARTER_FINALS = de 4 winnaars
  const semiPicks = (bracketPicks ?? []).filter((p) => p.round === "QUARTER_FINALS");
  const semiTally = tally(semiPicks.map((p) => p.team_code));

  // Top scorers
  const topScorerTally = tally((bonusPicks ?? []).map((b) => b.top_scorer));
  const nlTopScorerTally = tally((bonusPicks ?? []).map((b) => b.nl_top_scorer));

  // NL progress
  const nlProgressTally = tally((bonusPicks ?? []).map((b) => b.nl_progress as string | null));

  // NL totaal goals (gemiddelde + verdeling)
  const nlGoals = (bonusPicks ?? []).map((b) => b.nl_total_goals).filter((n): n is number => n != null);
  const nlGoalsAvg = nlGoals.length > 0 ? nlGoals.reduce((s, n) => s + n, 0) / nlGoals.length : 0;
  const nlGoalsMax = nlGoals.length > 0 ? Math.max(...nlGoals) : 0;
  const nlGoalsMin = nlGoals.length > 0 ? Math.min(...nlGoals) : 0;

  // Totaal goals toernooi
  const totalGoalsValues = (bonusPicks ?? []).map((b) => b.total_goals_tiebreak).filter((n): n is number => n != null);
  const totalGoalsAvg = totalGoalsValues.length > 0 ? totalGoalsValues.reduce((s, n) => s + n, 0) / totalGoalsValues.length : 0;

  // Beste nummers 3
  const bestThirdsPicks = (bracketPicks ?? []).filter((p) => p.round === "BEST_THIRDS");
  const bestThirdsTally = tally(bestThirdsPicks.map((p) => p.team_code));

  // Top-2 per poule (rank 1)
  // slot 0..11 = rank1 per groep A..L
  const rank1ByGroup = new Map<string, Tally[]>();
  for (let g = 0; g < 12; g++) {
    const groupLetter = String.fromCharCode(65 + g);
    const picks = (bracketPicks ?? [])
      .filter((p) => p.round === "GROUP_TOP_2" && p.slot === g)
      .map((p) => p.team_code);
    rank1ByGroup.set(groupLetter, tally(picks));
  }

  // Vaakste exacte uitslag (alle predictions samen)
  const exactScores = (predictions ?? [])
    .filter((p) => p.home_score != null && p.away_score != null)
    .map((p) => `${p.home_score}-${p.away_score}`);
  const exactScoreTally = tally(exactScores);

  // Toto-verdeling
  const totoTally = tally((predictions ?? []).map((p) => p.toto_pick));

  // Underdog: team in finale dat het minste werd gekozen (maar wel ≥1)
  const allTeams = new Set(teamName.keys());
  const championedTeams = new Set(championTally.map((t) => t.code));
  const lonelyTeams = championTally.filter((t) => t.n === 1).slice(0, 5);
  const neverPickedAsChampion = Array.from(allTeams).filter((c) => !championedTeams.has(c));

  const users = totalUsers ?? 0;

  // Afdelingsgemiddelde optimisme: gemiddelde voorspelde doelpunten per wedstrijd
  // (over alle predictions). Vereist join, doen we per user.
  // Simpel: gemiddeld doelpunten per match over alle predictions.
  const goalsPerMatch = (predictions ?? [])
    .filter((p) => p.home_score != null && p.away_score != null)
    .map((p) => (p.home_score ?? 0) + (p.away_score ?? 0));
  const avgGoalsPerMatchPredicted =
    goalsPerMatch.length > 0 ? goalsPerMatch.reduce((s, n) => s + n, 0) / goalsPerMatch.length : 0;

  // ── Extra stats (Niels-suggesties) ──────────────────────────────────────

  // #4 Unieke voorspellingen %: aandeel van predictions waar de exacte (home,
  //    away, toto) combinatie maar door 1 user gemaakt is. Per match groeperen,
  //    binnen de match kijken naar tuples.
  const predictionsByMatch = new Map<number, string[]>();
  for (const p of predictions ?? []) {
    if (p.home_score == null || p.away_score == null) continue;
    const key = `${p.home_score}-${p.away_score}-${p.toto_pick ?? "_"}`;
    const arr = predictionsByMatch.get(p.match_id) ?? [];
    arr.push(key);
    predictionsByMatch.set(p.match_id, arr);
  }
  let uniqueCount = 0;
  let totalPredCount = 0;
  for (const tuples of predictionsByMatch.values()) {
    const tupleCounts = new Map<string, number>();
    for (const t of tuples) tupleCounts.set(t, (tupleCounts.get(t) ?? 0) + 1);
    for (const c of tupleCounts.values()) {
      if (c === 1) uniqueCount++;
      totalPredCount++;
    }
  }
  const uniquePct = totalPredCount > 0 ? (uniqueCount / totalPredCount) * 100 : 0;

  // #6 Clean sheets: predictions waarin minstens één team 0 scoort.
  //    Aggregated over alle predictions (user_id niet nodig — we tellen
  //    pure fractie 0-tot-een-zijde predictions).
  const cleanSheetCount = (predictions ?? []).filter(
    (p) => p.home_score === 0 || p.away_score === 0,
  ).length;
  const predWithScores = (predictions ?? []).filter(
    (p) => p.home_score != null && p.away_score != null,
  ).length;
  const cleanSheetPct = predWithScores > 0 ? (cleanSheetCount / predWithScores) * 100 : 0;
  // Geprojecteerd over 104 wedstrijden:
  const projectedCleanSheets = Math.round((cleanSheetPct / 100) * 104);

  // #8 Meest doelpunt-rijke wedstrijd: per match-id de gemiddelde (home+away)
  //    over alle deelnemers. Sorteer desc, neem top.
  const matchById = new Map((matchesRaw ?? []).map((m) => [m.id, m]));
  const totalGoalsByMatch = new Map<number, { sum: number; n: number }>();
  for (const p of predictions ?? []) {
    if (p.home_score == null || p.away_score == null) continue;
    const cur = totalGoalsByMatch.get(p.match_id) ?? { sum: 0, n: 0 };
    cur.sum += (p.home_score ?? 0) + (p.away_score ?? 0);
    cur.n += 1;
    totalGoalsByMatch.set(p.match_id, cur);
  }
  const matchSpectacle = Array.from(totalGoalsByMatch.entries())
    .map(([id, v]) => {
      const m = matchById.get(id);
      return {
        matchId: id,
        homeCode: m?.home_team ?? "?",
        awayCode: m?.away_team ?? "?",
        avg: v.n > 0 ? v.sum / v.n : 0,
        n: v.n,
      };
    })
    .filter((x) => x.homeCode !== "?" && x.n >= 3) // min 3 voorspellingen voor zinvol gemiddelde
    .sort((a, b) => b.avg - a.avg);
  const topSpectacle = matchSpectacle.slice(0, 3);

  // #9 Verwachte beste verdediging: per team, gemiddeld voorspelde tegengoals
  //    over alle wedstrijden waarin ze speelden (groepsfase).
  const goalsAgainstByTeam = new Map<string, { sum: number; n: number }>();
  for (const p of predictions ?? []) {
    if (p.home_score == null || p.away_score == null) continue;
    const m = matchById.get(p.match_id);
    if (!m?.home_team || !m?.away_team) continue;
    // home team krijgt away_score tegen, en omgekeerd
    const homeCur = goalsAgainstByTeam.get(m.home_team) ?? { sum: 0, n: 0 };
    homeCur.sum += p.away_score ?? 0;
    homeCur.n += 1;
    goalsAgainstByTeam.set(m.home_team, homeCur);

    const awayCur = goalsAgainstByTeam.get(m.away_team) ?? { sum: 0, n: 0 };
    awayCur.sum += p.home_score ?? 0;
    awayCur.n += 1;
    goalsAgainstByTeam.set(m.away_team, awayCur);
  }
  const defenseRank = Array.from(goalsAgainstByTeam.entries())
    .map(([code, v]) => ({ code, avg: v.n > 0 ? v.sum / v.n : 0, n: v.n }))
    .filter((x) => x.n >= 10) // minimaal 10 voorspellingen voor signaal-ruis-ratio
    .sort((a, b) => a.avg - b.avg);
  const topDefense = defenseRank.slice(0, 5);

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-8 space-y-8">
      <div className="tab-hero bg-surface border border-border rounded-lg p-5">
        <div className="flex items-baseline justify-between gap-3 mb-1 flex-wrap">
          <h1 className="text-2xl font-bold leading-tight">Stats van de poule</h1>
          <Link href="/voorspellingen" className="text-xs text-muted hover:text-fg underline shrink-0">
            ← terug naar lijst
          </Link>
        </div>
        <p className="text-sm text-muted">
          Iedereens voorspellingen op één hoop. Niet wie wat koos, maar hoe
          vaak: favoriete wereldkampioen, vaakst voorspelde uitslag, de
          eenzaamste outsider.
        </p>
      </div>

      {/* ── 1. Team highlights ── */}
      <section>
        <h2 className="text-xl font-bold mb-4">Team highlights</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <StatCard title="🏆 Wereldkampioen" subtitle="Top 5 picks — wie pakt de trofee?">
            <TallyList tally={championTally} teamName={teamName} />
          </StatCard>
          <StatCard title="🥈 Finalisten" subtitle="Top 5 — welke 2 landen halen de finale?">
            <TallyList tally={finalistTally} teamName={teamName} />
          </StatCard>
          <StatCard title="🎯 Halve finale" subtitle="Top 5 — wie pakt het laatste stukje brons of beter?">
            <TallyList tally={semiTally} teamName={teamName} />
          </StatCard>
          <StatCard title="⚽ Topscorer toernooi" subtitle="Top 5 picks">
            <TallyList tally={topScorerTally} showFlag={false} />
          </StatCard>
        </div>
      </section>

      {/* ── 2. Rondom NL ── */}
      <section>
        <h2 className="text-xl font-bold mb-4">🇳🇱 Rondom Nederland</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <StatCard title="Hoever komt NL?" subtitle="Verdeling onder alle deelnemers">
            <div className="space-y-1.5">
              {nlProgressTally.map((t) => (
                <div key={t.code}>
                  <div className="flex items-baseline justify-between gap-2 mb-0.5 text-sm">
                    <span className="font-medium">{NL_PROGRESS_LABEL[t.code] ?? t.code}</span>
                    <span className="tabular-nums text-xs text-muted shrink-0">
                      {t.n}× <span className="font-semibold">({Math.round(t.pct)}%)</span>
                    </span>
                  </div>
                  <Bar
                    pct={t.pct}
                    color={t.code === "CHAMPION" ? "bg-trophy" : t.code === "GROUP_STAGE" ? "bg-brand" : "bg-pitch"}
                  />
                </div>
              ))}
            </div>
          </StatCard>
          <StatCard title="⚽ Topscorer NL" subtitle="Top 5 voorspellingen">
            <TallyList tally={nlTopScorerTally} showFlag={false} />
          </StatCard>
          <StatCard
            title="📊 Doelpunten van NL"
            subtitle={`Gemiddelde voorspelling: ${nlGoalsAvg.toFixed(1)}`}
          >
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Pessimist:</span>
                <span className="font-semibold tabular-nums">{nlGoalsMin}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Gemiddelde:</span>
                <span className="font-semibold tabular-nums text-pitch">{nlGoalsAvg.toFixed(1)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Optimist:</span>
                <span className="font-semibold tabular-nums">{nlGoalsMax}</span>
              </div>
            </div>
          </StatCard>
          <StatCard
            title="🌍 Totaal goals toernooi"
            subtitle="Gemiddelde voorspelling van alle 104 matches samen"
          >
            <div className="text-3xl font-bold tabular-nums text-brand">
              {Math.round(totalGoalsAvg)}
            </div>
            <p className="text-xs text-muted">
              Iets om bij stil te staan: {Math.round(avgGoalsPerMatchPredicted * 100) / 100} doelpunten per wedstrijd gemiddeld.
            </p>
          </StatCard>
        </div>
      </section>

      {/* ── 3. Groepsfase (uitgebreid met spektakel-stats) ── */}
      <section>
        <h2 className="text-xl font-bold mb-4">Groepsfase</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <StatCard title="📊 Vaakste exacte uitslag" subtitle="Over alle 72 voorspelde groepsfase-matches">
            <div className="space-y-1.5">
              {exactScoreTally.slice(0, 6).map((t) => (
                <div key={t.code} className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="font-mono font-bold tabular-nums">{t.code}</span>
                  <span className="tabular-nums text-xs text-muted">
                    {t.n}× <span className="font-semibold">({Math.round(t.pct)}%)</span>
                  </span>
                </div>
              ))}
            </div>
          </StatCard>
          <StatCard
            title="⚖️ Toto-verdeling"
            subtitle="Bij wie wint Nijhuis gemiddeld op: thuis (1), gelijk (X) of uit (2)?"
          >
            <div className="space-y-2">
              {totoTally.map((t) => (
                <div key={t.code}>
                  <div className="flex items-baseline justify-between gap-2 mb-0.5 text-sm">
                    <span className="font-bold">{t.code}</span>
                    <span className="tabular-nums text-xs text-muted">
                      {t.n}× <span className="font-semibold">({Math.round(t.pct)}%)</span>
                    </span>
                  </div>
                  <Bar pct={t.pct} />
                </div>
              ))}
            </div>
          </StatCard>
          <StatCard
            title="🎆 Meest doelpunt-rijke wedstrijden"
            subtitle="Top 3 — waar verwacht Nijhuis het meeste spektakel?"
          >
            {topSpectacle.length === 0 ? (
              <div className="text-sm text-muted italic">Nog geen data.</div>
            ) : (
              <ol className="space-y-1.5 text-sm">
                {topSpectacle.map((m) => (
                  <li key={m.matchId} className="flex items-center gap-2">
                    <span className="flag-emoji" aria-hidden>{flagEmoji(m.homeCode)}</span>
                    <span className="text-xs font-medium truncate">{teamName.get(m.homeCode) ?? m.homeCode}</span>
                    <span className="text-muted text-xs">vs</span>
                    <span className="text-xs font-medium truncate">{teamName.get(m.awayCode) ?? m.awayCode}</span>
                    <span className="flag-emoji" aria-hidden>{flagEmoji(m.awayCode)}</span>
                    <span className="ml-auto font-bold tabular-nums text-pitch text-sm">
                      {m.avg.toFixed(1)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
            <p className="text-xs text-muted mt-2">Gemiddelde voorspelde totaal-doelpunten per wedstrijd.</p>
          </StatCard>
          <StatCard
            title="🧱 Verwachte beste verdediging"
            subtitle="Top 5 landen met de minste verwachte tegengoals (groepsfase)"
          >
            {topDefense.length === 0 ? (
              <div className="text-sm text-muted italic">Nog niet genoeg data.</div>
            ) : (
              <ol className="space-y-1 text-sm">
                {topDefense.map((d) => (
                  <li key={d.code} className="flex items-center gap-2">
                    <span className="flag-emoji" aria-hidden>{flagEmoji(d.code)}</span>
                    <span className="font-medium truncate">{teamName.get(d.code) ?? d.code}</span>
                    <span className="ml-auto font-bold tabular-nums text-pitch text-xs">
                      {d.avg.toFixed(2)}
                    </span>
                    <span className="text-[10px] text-muted">/wedstrijd</span>
                  </li>
                ))}
              </ol>
            )}
          </StatCard>
          <StatCard
            title="🛡️ Verwachte clean sheets"
            subtitle="Hoeveel wedstrijden eindigen met minstens één team op nul?"
          >
            <div className="flex items-baseline gap-2">
              <div className="text-3xl font-bold tabular-nums text-brand">
                {projectedCleanSheets}
              </div>
              <div className="text-sm text-muted">van de 104 wedstrijden</div>
            </div>
            <p className="text-xs text-muted mt-1">
              {Math.round(cleanSheetPct)}% van alle voorspelde scores heeft een 0 voor één van de teams.
            </p>
          </StatCard>
          <StatCard title="📈 Voorspelde productiviteit" subtitle="Gemiddeld doelpunten per wedstrijd">
            <div className="text-3xl font-bold tabular-nums text-pitch">
              {avgGoalsPerMatchPredicted.toFixed(2)}
            </div>
            <p className="text-xs text-muted">
              Nijhuis-collectief is{" "}
              <strong>
                {avgGoalsPerMatchPredicted > 2.5 ? "optimistisch" : "voorzichtig"}
              </strong>{" "}
              over de hoeveelheid spektakel.
            </p>
          </StatCard>
        </div>

        {/* Per poule top-pick — full-width 12-tile grid onder de cards */}
        <div className="bg-surface border border-border rounded-lg p-5 mt-4">
          <h3 className="font-bold text-base mb-1">🏟️ Favoriete nummer 1 per poule</h3>
          <p className="text-xs text-muted mb-3">
            Wie zien de meeste deelnemers winnen in elke groep?
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {Array.from(rank1ByGroup.entries()).map(([group, tallyForGroup]) => {
              const top = tallyForGroup[0];
              return (
                <div key={group} className="bg-bg/40 border border-border rounded p-2 text-sm">
                  <div className="text-[10px] text-muted uppercase tracking-wider font-semibold">
                    Poule {group}
                  </div>
                  {top ? (
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="flag-emoji" aria-hidden>{flagEmoji(top.code)}</span>
                      <span className="font-medium text-sm truncate">
                        {teamName.get(top.code) ?? top.code}
                      </span>
                    </div>
                  ) : (
                    <div className="text-xs text-muted italic mt-0.5">geen data</div>
                  )}
                  {top && (
                    <div className="text-[10px] text-muted mt-0.5">
                      {top.n}× ({Math.round(top.pct)}%)
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── 4. Knock-out ── */}
      <section>
        <h2 className="text-xl font-bold mb-4">Knock-out</h2>
        <div className="grid sm:grid-cols-1 gap-4">
          <StatCard
            title="🥉 Meest gekozen 'beste nummer 3'"
            subtitle="Welke nummers 3 worden het vaakst doorgestuurd naar de knock-out fase?"
          >
            <TallyList tally={bestThirdsTally} teamName={teamName} limit={8} />
          </StatCard>
        </div>
      </section>

      {/* ── 5. Afwijkende keuzes (luchtige afsluiter) ── */}
      <section>
        <h2 className="text-xl font-bold mb-4">Afwijkende keuzes</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <StatCard
            title="🐺 Lonely wolves"
            subtitle="Eenzame deelnemers met een unieke pick voor wereldkampioen"
          >
            {lonelyTeams.length === 0 ? (
              <div className="text-sm text-muted italic">Iedereen kiest mainstream.</div>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {lonelyTeams.map((t) => (
                  <li key={t.code} className="flex items-center gap-2">
                    <span className="flag-emoji" aria-hidden>{flagEmoji(t.code)}</span>
                    <span className="font-medium">{teamName.get(t.code) ?? t.code}</span>
                    <span className="text-xs text-muted">— 1 deelnemer</span>
                  </li>
                ))}
              </ul>
            )}
          </StatCard>
          <StatCard
            title="🚫 Nooit gekozen"
            subtitle={`${neverPickedAsChampion.length} van de ${teamCount} landen door niemand als wereldkampioen gekozen`}
          >
            <div className="text-sm text-muted">
              {neverPickedAsChampion.length === 0 ? (
                <em>Elke land heeft minstens één fan.</em>
              ) : (
                <>
                  {neverPickedAsChampion.length <= 12 ? (
                    <div className="flex flex-wrap gap-1">
                      {neverPickedAsChampion.map((c) => (
                        <span
                          key={c}
                          className="inline-flex items-center gap-1 bg-bg/60 border border-border rounded px-1.5 py-0.5 text-xs"
                        >
                          <span className="flag-emoji" aria-hidden>{flagEmoji(c)}</span>
                          {teamName.get(c) ?? c}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span>
                      {neverPickedAsChampion.length} landen die niemand bij Nijhuis ziet winnen — te
                      veel om allemaal te tonen.
                    </span>
                  )}
                </>
              )}
            </div>
          </StatCard>
          <StatCard
            title="🦄 Unieke voorspellingen"
            subtitle="Aandeel picks dat door slechts één deelnemer is gedaan"
          >
            <div className="flex items-baseline gap-2">
              <div className="text-3xl font-bold tabular-nums text-trophy">
                {Math.round(uniquePct)}%
              </div>
              <div className="text-sm text-muted">van alle picks is uniek</div>
            </div>
            <p className="text-xs text-muted mt-1">
              {uniquePct >= 30
                ? "Nijhuis denkt erg verschillend over deze wedstrijden."
                : uniquePct >= 15
                ? "Een mooie mix van consensus en eigenwijsheid."
                : "Iedereen gokt vooral hetzelfde — weinig verrassingen."}
            </p>
          </StatCard>
        </div>
      </section>

      <div className="text-xs text-muted text-center pt-4">
        Geüpdatet: {new Date().toLocaleString("nl-NL")} · Aggregaties — geen individuele picks getoond.
      </div>
    </div>
  );
}
