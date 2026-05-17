import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin";
import AdminSearch from "./AdminSearch";

async function updateTournamentResults(formData: FormData) {
  "use server";
  const { createSupabaseServerClient: mkClient } = await import("@/lib/supabase/server");
  const { isAdmin: checkAdmin } = await import("@/lib/admin");
  const supabase = await mkClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !checkAdmin(user.email)) return;
  const topScorer = (formData.get("actual_top_scorer") as string)?.trim() || null;
  const yellowCards = formData.get("actual_yellow_cards") as string;
  await supabase.from("settings").update({
    actual_top_scorer: topScorer,
    actual_yellow_cards: yellowCards ? parseInt(yellowCards, 10) : null,
  }).eq("id", 1);
}

async function updateLockAt(formData: FormData) {
  "use server";
  const { createSupabaseServerClient: mkClient } = await import(
    "@/lib/supabase/server"
  );
  const { isAdmin: checkAdmin } = await import("@/lib/admin");
  const supabase = await mkClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !checkAdmin(user.email)) return;
  const val = formData.get("lock_at") as string;
  if (!val) return;
  // datetime-local is in local time — interpret as Amsterdam
  const dt = new Date(val + ":00");
  await supabase.rpc("admin_set_lock_at", { new_lock_at: dt.toISOString() });
}

export default async function AdminPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!isAdmin(user.email)) redirect("/ranglijst");

  const [{ data: participants }, { data: settings }] = await Promise.all([
    supabase
      .from("leaderboard")
      .select("user_id, display_name, department, total_points, rank")
      .order("rank", { ascending: true }),
    supabase.from("settings").select("lock_at, actual_top_scorer, actual_yellow_cards").eq("id", 1).single(),
  ]);

  const lockAt = settings?.lock_at ?? "2026-06-11T17:00:00+02:00";
  const lockAtLocal = new Date(lockAt)
    .toLocaleString("sv-SE", { timeZone: "Europe/Amsterdam" })
    .replace(" ", "T")
    .slice(0, 16);

  const resendSet = !!process.env.RESEND_API_KEY;
  const anthropicSet = !!process.env.ANTHROPIC_API_KEY;
  const serviceRoleSet = !!process.env.SUPABASE_SERVICE_ROLE_KEY;

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 space-y-10">

        {/* ── Instellingen ── */}
        <section className="space-y-4">
          <div className="bg-surface border border-border rounded-lg p-5">
            <h2 className="text-xl font-bold mb-0.5">Instellingen</h2>
            <p className="text-sm text-muted">Sluitingstijd en API-sleutels.</p>
          </div>

          <div className="bg-surface border border-border rounded-lg divide-y divide-border">

            {/* Lock datum */}
            <div className="p-5">
              <p className="text-sm font-semibold mb-1">Sluitingstijd poule</p>
              <p className="text-xs text-muted mb-3">
                Na dit moment kunnen deelnemers niets meer wijzigen. Huidig:{" "}
                <span className="font-mono">
                  {new Date(lockAt).toLocaleString("nl-NL", {
                    timeZone: "Europe/Amsterdam",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </p>
              <form action={updateLockAt} className="flex items-center gap-3 flex-wrap">
                <input
                  type="datetime-local"
                  name="lock_at"
                  defaultValue={lockAtLocal}
                  className="border border-border rounded-md px-3 py-2 text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-brand"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand text-white rounded-md text-sm font-medium hover:opacity-90 transition"
                >
                  Opslaan
                </button>
              </form>
            </div>

            {/* Toernooiresultaten (bonus) */}
            <div className="p-5">
              <p className="text-sm font-semibold mb-1">Toernooiresultaten (bonusvragen)</p>
              <p className="text-xs text-muted mb-3">
                Vul in na het toernooi. Worden direct zichtbaar als uitslag bij de bonusvragen.
              </p>
              <form action={updateTournamentResults} className="space-y-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <label className="text-xs text-muted w-32 shrink-0">Topscorer</label>
                  <input
                    type="text"
                    name="actual_top_scorer"
                    defaultValue={settings?.actual_top_scorer ?? ""}
                    placeholder="bijv. Kylian Mbappé"
                    className="border border-border rounded-md px-3 py-2 text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-brand flex-1 min-w-48"
                  />
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <label className="text-xs text-muted w-32 shrink-0">Gele kaarten</label>
                  <input
                    type="number"
                    name="actual_yellow_cards"
                    defaultValue={settings?.actual_yellow_cards ?? ""}
                    placeholder="bijv. 192"
                    className="border border-border rounded-md px-3 py-2 text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-brand w-32"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand text-white rounded-md text-sm font-medium hover:opacity-90 transition"
                >
                  Opslaan
                </button>
              </form>
            </div>

            {/* API keys */}
            <div className="p-5">
              <p className="text-sm font-semibold mb-3">API-sleutels (.env.local)</p>
              <div className="space-y-2">
                {[
                  {
                    key: "SUPABASE_SERVICE_ROLE_KEY",
                    set: serviceRoleSet,
                    missing: "cron kan geen punten berekenen",
                  },
                  {
                    key: "RESEND_API_KEY",
                    set: resendSet,
                    missing: "dagelijkse mails uitgeschakeld",
                  },
                  {
                    key: "ANTHROPIC_API_KEY",
                    set: anthropicSet,
                    missing: "AI-functies uitgeschakeld",
                  },
                ].map(({ key, set, missing }) => (
                  <div key={key} className="flex items-center gap-2.5 text-sm">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        set ? "bg-pitch" : "bg-brand"
                      }`}
                    />
                    <span className="font-mono text-xs">{key}</span>
                    <span className="text-muted text-xs">
                      {set ? "ingesteld" : `ontbreekt — ${missing}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </section>

      {/* ── Deelnemers ── */}
      <section className="space-y-4">
        <div className="bg-surface border border-border rounded-lg p-5">
          <h2 className="text-xl font-bold mb-0.5">Deelnemers</h2>
          <p className="text-sm text-muted">
            {participants?.length ?? 0} ingeschreven · klik op een naam om het ingevulde formulier te bekijken
          </p>
        </div>
        <AdminSearch participants={participants ?? []} />
      </section>

      </div>
  );
}
