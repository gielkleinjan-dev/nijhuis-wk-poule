import { createSupabaseServerClient } from "@/lib/supabase/server";
import BonusForm from "./BonusForm";

export default async function BonusPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: bonusRaw }, { data: settings }, { data: matchTotals }, { data: pointRows }] = await Promise.all([
    supabase
      .from("bonus_picks")
      .select("top_scorer, total_goals_tiebreak, total_yellow_cards_tiebreak, nl_top_scorer, nl_total_goals, nl_progress")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("settings")
      .select("lock_at, actual_top_scorer, actual_yellow_cards, actual_nl_top_scorer, actual_nl_total_goals, actual_nl_progress")
      .eq("id", 1)
      .single(),
    supabase
      .from("matches")
      .select("stage, home_score, away_score")
      .eq("status", "FINISHED"),
    supabase.from("points").select("points").eq("user_id", user.id).eq("source", "bonus"),
  ]);

  const totalPoints = (pointRows ?? []).reduce((s, r) => s + (r.points ?? 0), 0);

  const lockAt = settings?.lock_at ?? "2026-06-10T15:00:00Z";
  const isLocked = new Date(lockAt) <= new Date();

  // Toernooi-doelpunten (beslisser) pas bekend als de finale gespeeld is.
  const tournamentComplete = (matchTotals ?? []).some((m) => m.stage === "FINAL");
  const actualTotalGoals = tournamentComplete
    ? ((matchTotals ?? []).reduce((sum, m) => sum + (m.home_score ?? 0) + (m.away_score ?? 0), 0) || null)
    : null;

  return (
    <BonusForm
      userId={user.id}
      totalPoints={totalPoints}
      initial={{
        top_scorer: bonusRaw?.top_scorer ?? "",
        total_goals_tiebreak: bonusRaw?.total_goals_tiebreak ?? null,
        total_yellow_cards_tiebreak: bonusRaw?.total_yellow_cards_tiebreak ?? null,
        nl_top_scorer: bonusRaw?.nl_top_scorer ?? "",
        nl_total_goals: bonusRaw?.nl_total_goals ?? null,
        nl_progress: bonusRaw?.nl_progress ?? null,
      }}
      isLocked={isLocked}
      actualTopScorer={settings?.actual_top_scorer ?? null}
      actualYellowCards={settings?.actual_yellow_cards ?? null}
      actualTotalGoals={actualTotalGoals}
      actualNLTopScorer={settings?.actual_nl_top_scorer ?? null}
      actualNLTotalGoals={settings?.actual_nl_total_goals ?? null}
      actualNLProgress={settings?.actual_nl_progress ?? null}
    />
  );
}
