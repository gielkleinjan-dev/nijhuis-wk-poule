import { createSupabaseServerClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

/**
 * Verwijder een gebruiker en al hun voorspellingen/bracket-picks/bonus.
 * Admin-only. Doorloopt alle gerelateerde tabellen en sluit met de
 * auth.users-row.
 *
 * Body: { userId: string, confirm: string }
 *   - confirm moet exact "verwijderen" zijn als extra controle.
 *
 * NB: dit is een irreversible operatie. De DELETE-cascade op profiles_id_fkey
 * zou theoretisch alles via auth.admin.deleteUser kunnen doen, maar we
 * doen het stap-voor-stap zodat we kunnen rapporteren wat er gewist is.
 */
export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null) as { userId?: string; confirm?: string } | null;
  const userId = body?.userId;
  const confirm = body?.confirm;

  if (!userId || typeof userId !== "string") {
    return NextResponse.json({ error: "userId is verplicht" }, { status: 400 });
  }
  if (confirm !== "verwijderen") {
    return NextResponse.json(
      { error: "Bevestiging incorrect — typ 'verwijderen' exact" },
      { status: 400 },
    );
  }
  if (userId === user.id) {
    return NextResponse.json(
      { error: "Je kunt jezelf niet verwijderen — laat een mede-admin dat doen" },
      { status: 400 },
    );
  }

  // Service-role gebruiken omdat we auth.users moeten kunnen aanraken.
  const sb = createSupabaseServiceRoleClient();

  // Profile-info ophalen voor de log/response
  const { data: profile } = await sb
    .from("profiles")
    .select("display_name, department")
    .eq("id", userId)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: "Gebruiker niet gevonden" }, { status: 404 });
  }

  const counts: Record<string, number> = {};
  for (const table of [
    "predictions",
    "bracket_picks",
    "bracket_match_overrides",
    "bonus_picks",
    "points",
  ]) {
    const { error, count } = await sb.from(table).delete({ count: "exact" }).eq("user_id", userId);
    if (error) {
      return NextResponse.json(
        { error: `delete uit ${table} mislukt: ${error.message}` },
        { status: 500 },
      );
    }
    counts[table] = count ?? 0;
  }

  const { error: profErr } = await sb.from("profiles").delete().eq("id", userId);
  if (profErr) {
    return NextResponse.json(
      { error: `delete uit profiles mislukt: ${profErr.message}` },
      { status: 500 },
    );
  }

  const { error: authErr } = await sb.auth.admin.deleteUser(userId);
  if (authErr) {
    return NextResponse.json(
      { error: `delete uit auth.users mislukt: ${authErr.message}` },
      { status: 500 },
    );
  }

  revalidatePath("/admin");

  return NextResponse.json({
    ok: true,
    deleted: {
      id: userId,
      display_name: profile.display_name,
      department: profile.department,
      counts,
    },
  });
}
