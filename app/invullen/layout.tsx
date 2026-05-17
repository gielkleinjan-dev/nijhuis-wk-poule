import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin";
import InvullenNav from "./nav";
import ProgressBar from "./ProgressBar";
import BrandLogo from "@/app/components/BrandLogo";
import UserHeader from "@/app/components/UserHeader";
import { ROUNDS } from "./knockout/rounds";

const KO_TOTAL = ROUNDS.reduce((s, r) => s + r.count, 0);
const GROUP_TOTAL = 72;
const BONUS_TOTAL = 3;

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
    supabase.from("bonus_picks").select("top_scorer, total_goals_tiebreak, total_yellow_cards_tiebreak").eq("user_id", user.id).maybeSingle(),
  ]);

  const lockAt = settings?.lock_at ?? "2026-06-11T17:00:00Z";
  const isLocked = new Date(lockAt) <= new Date();

  // Count knockout picks per round, capped at round.count
  const picksByRound = new Map<string, number>();
  for (const row of bracketRows ?? []) {
    picksByRound.set(row.round, (picksByRound.get(row.round) ?? 0) + 1);
  }
  const koFilled = ROUNDS.reduce((s, r) => s + Math.min(picksByRound.get(r.key) ?? 0, r.count), 0);

  const bonusFilled = bonusRow
    ? [bonusRow.top_scorer, bonusRow.total_goals_tiebreak, bonusRow.total_yellow_cards_tiebreak].filter((v) => v != null && v !== "").length
    : 0;

  const sections = [
    { label: "Groepsfase", filled: predCount ?? 0, total: GROUP_TOTAL },
    { label: "Knock-out", filled: koFilled, total: KO_TOTAL },
    { label: "Bonus", filled: bonusFilled, total: BONUS_TOTAL },
  ];

  return (
    <main className="min-h-screen">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto max-w-4xl px-6 py-4 flex items-center justify-between gap-4">
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
      <div className="mx-auto max-w-4xl px-6 py-8">{children}</div>
    </main>
  );
}
