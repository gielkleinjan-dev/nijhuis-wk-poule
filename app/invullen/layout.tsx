import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin";
import InvullenNav from "./nav";
import ProgressBar from "./ProgressBar";
import BrandLogo from "@/app/components/BrandLogo";
import UserHeader from "@/app/components/UserHeader";
import LockCountdown from "@/app/components/LockCountdown";

// Knock-out V2 telling: 24 (top 2 per poule) + 8 (beste nrs 3) + 16+8+4+2+1
// (winnaars per ronde) = 63 keuzes totaal. De oude ROUNDS-export is V1-spec
// en deugt hier niet voor — daar telde LAST_32 nog 32 'overlevende landen'
// in plaats van de 16 wedstrijd-winnaars die V2 heeft.
const KO_V2_ROUNDS: ReadonlyArray<{ key: string; count: number }> = [
  { key: "GROUP_TOP_2",     count: 24 },
  { key: "BEST_THIRDS",     count: 8 },
  { key: "LAST_32",         count: 16 },
  { key: "LAST_16",         count: 8 },
  { key: "QUARTER_FINALS",  count: 4 },
  { key: "SEMI_FINALS",     count: 2 },
  { key: "FINAL",           count: 1 },
];
const KO_TOTAL = KO_V2_ROUNDS.reduce((s, r) => s + r.count, 0);
const GROUP_TOTAL = 72;
// 6 bonusvragen: topscorer toernooi + gele kaarten + doelpunten + 3x NL
// (topscorer NL, doelpunten NL, hoever komt NL).
const BONUS_TOTAL = 6;

export default async function InvullenLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const userIsAdmin = isAdmin(user.email);

  const [
    { data: settings },
    { count: predCount },
    { data: bracketRows },
    { data: bonusRow },
  ] = await Promise.all([
    supabase.from("settings").select("lock_at").eq("id", 1).single(),
    supabase.from("predictions").select("*", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("bracket_picks").select("round").eq("user_id", user.id),
    supabase
      .from("bonus_picks")
      .select("top_scorer, total_goals_tiebreak, total_yellow_cards_tiebreak, nl_top_scorer, nl_total_goals, nl_progress")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const lockAt = settings?.lock_at ?? "2026-06-10T15:00:00Z";
  const isLocked = new Date(lockAt) <= new Date();

  // Tel knockout-picks per ronde, gecapt op de V2-count.
  const picksByRound = new Map<string, number>();
  for (const row of bracketRows ?? []) {
    picksByRound.set(row.round, (picksByRound.get(row.round) ?? 0) + 1);
  }
  const koFilled = KO_V2_ROUNDS.reduce(
    (s, r) => s + Math.min(picksByRound.get(r.key) ?? 0, r.count),
    0,
  );

  const bonusFilled = bonusRow
    ? [
        bonusRow.top_scorer,
        bonusRow.total_goals_tiebreak,
        bonusRow.total_yellow_cards_tiebreak,
        bonusRow.nl_top_scorer,
        bonusRow.nl_total_goals,
        bonusRow.nl_progress,
      ].filter((v) => v != null && v !== "").length
    : 0;

  const sections = [
    { label: "Groepsfase", filled: predCount ?? 0, total: GROUP_TOTAL },
    { label: "Knock-out", filled: koFilled, total: KO_TOTAL },
    { label: "Bonus", filled: bonusFilled, total: BONUS_TOTAL },
  ];

  return (
    <main className="min-h-screen">
      <LockCountdown lockAt={lockAt} />
      <header className="border-b border-border bg-surface">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 py-4 flex items-center justify-between gap-3 sm:gap-4">
          <BrandLogo href="/invullen" />
          <UserHeader
            displayName={user.user_metadata?.display_name || user.email || ""}
            isAdmin={userIsAdmin}
            isLocked={isLocked}
            lockAt={lockAt}
          />
        </div>
      </header>
      <ProgressBar sections={sections} />
      <InvullenNav isAdmin={userIsAdmin} isLocked={isLocked} lockAt={lockAt} />
      <div className="mx-auto max-w-4xl px-4 sm:px-6 py-6 sm:py-8">{children}</div>
    </main>
  );
}
