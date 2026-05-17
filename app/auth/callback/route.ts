import { NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const next = url.searchParams.get("next") || "/invullen";

  const supabase = await createSupabaseServerClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error)
      return NextResponse.redirect(
        `${url.origin}/login?error=${encodeURIComponent(error.message)}`
      );
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as "magiclink" | "email",
      token_hash: tokenHash,
    });
    if (error)
      return NextResponse.redirect(
        `${url.origin}/login?error=${encodeURIComponent(error.message)}`
      );
  } else {
    return NextResponse.redirect(`${url.origin}/login?error=missing_code`);
  }

  // Profile upsert via service-role: PostgREST's upsert genereert een DO UPDATE
  // clause die UPDATE-rechten op alle kolommen vereist. 'authenticated' heeft die
  // bewust niet op id/paid/is_admin/rank_prev (security), dus de user-session
  // upsert faalt silent voor nieuwe registraties.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const admin = createSupabaseServiceRoleClient();
    await admin.from("profiles").upsert(
      {
        id: user.id,
        display_name: user.user_metadata?.display_name || user.email!.split("@")[0],
        department: user.user_metadata?.department || null,
      },
      { onConflict: "id", ignoreDuplicates: false }
    );
  }

  return NextResponse.redirect(`${url.origin}${next}`);
}
