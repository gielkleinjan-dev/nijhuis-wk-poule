import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  buildWinnerMap,
  fetchWcMatches,
  toMatchUpdates,
} from "@/lib/footballData";
import { computeUserPointRows } from "@/lib/scoring";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "FOOTBALL_DATA_API_KEY not configured" }, { status: 500 });
  }

  // Service role key bypasses RLS — required so the cron can read every user's
  // predictions, bracket_picks, and bonus_picks without being authenticated as them.
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY not configured" }, { status: 500 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { persistSession: false } },
  );

  // 1. Fetch live results from football-data.org.
  const apiMatches = await fetchWcMatches(apiKey);
  const updates = toMatchUpdates(apiMatches);

  // 2. Apply score updates via SECURITY DEFINER RPC. Returns number of changed rows.
  const { data: changed, error: updErr } = await supabase.rpc("cron_update_match_scores", {
    p_secret: cronSecret,
    p_updates: updates,
  });
  if (updErr) {
    return NextResponse.json({ error: "match_update_failed", detail: updErr.message }, { status: 500 });
  }

  const changedCount = (changed as number) ?? 0;
  if (changedCount === 0) {
    return NextResponse.json({ ok: true, changed: 0, recomputed: 0 });
  }

  // 3. Build internal match-id → winner map from the API response.
  const { data: matchRows, error: mErr } = await supabase
    .from("matches")
    .select("id, external_id");
  if (mErr) {
    return NextResponse.json({ error: "match_lookup_failed", detail: mErr.message }, { status: 500 });
  }
  const extToInternal = new Map<number, number>();
  for (const m of matchRows ?? []) {
    if (m.external_id != null) extToInternal.set(Number(m.external_id), m.id);
  }
  const winnerByMatchId = buildWinnerMap(apiMatches, extToInternal);

  // 4. Fetch bonus context: admin-entered results + total goals from finished matches.
  const [{ data: settings }, { data: finishedMatches }, { data: profiles, error: pErr }] =
    await Promise.all([
      supabase.from("settings").select("actual_top_scorer, actual_yellow_cards").eq("id", 1).single(),
      supabase.from("matches").select("home_score, away_score").eq("status", "FINISHED"),
      supabase.from("profiles").select("id"),
    ]);

  if (pErr) {
    return NextResponse.json({ error: "profiles_lookup_failed", detail: pErr.message }, { status: 500 });
  }

  const topScorer = settings?.actual_top_scorer ?? null;
  const totalYellowCards = settings?.actual_yellow_cards ?? null;
  const totalGoals = finishedMatches
    ? finishedMatches.reduce((sum, m) => sum + (m.home_score ?? 0) + (m.away_score ?? 0), 0)
    : null;

  // 5. Snapshot the CURRENT ranking before we recompute — drives the up/down arrows
  // on the ranglijst page. Saves profiles.rank_prev + a team_rank_snapshots row dated
  // yesterday. Failure is non-fatal: arrows simply won't show, but points are still
  // recomputed correctly.
  const { error: snapErr } = await supabase.rpc("cron_snapshot_ranks", {
    p_secret: cronSecret,
  });
  if (snapErr) {
    console.warn("snapshot_ranks_failed", snapErr.message);
  }

  // 6. Recompute and store points for every user.
  let recomputed = 0;
  const errors: { user_id: string; error: string }[] = [];
  for (const profile of profiles ?? []) {
    try {
      const rows = await computeUserPointRows(profile.id, supabase, {
        winnerByMatchId,
        topScorer,
        totalGoals,
        totalYellowCards,
      });
      const { error: rpcErr } = await supabase.rpc("cron_replace_user_points", {
        p_secret: cronSecret,
        p_user_id: profile.id,
        p_rows: rows,
      });
      if (rpcErr) {
        errors.push({ user_id: profile.id, error: rpcErr.message });
      } else {
        recomputed++;
      }
    } catch (e) {
      errors.push({ user_id: profile.id, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return NextResponse.json({
    ok: errors.length === 0,
    changed: changedCount,
    recomputed,
    errors: errors.length > 0 ? errors : undefined,
  });
}
