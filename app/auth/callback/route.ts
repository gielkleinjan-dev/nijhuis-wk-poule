import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const next = url.searchParams.get("next") || "/invullen";

  // Bouw de success-redirect NU al — sessie-cookies worden direct op dit
  // response-object gezet (via setAll hieronder). Een later aangemaakte
  // NextResponse.redirect() zou die cookies NIET meekrijgen.
  const successRedirect = NextResponse.redirect(`${url.origin}${next}`);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            // Schrijf naar req.cookies zodat getAll() de verse waarden teruggeeft
            // én naar successRedirect zodat de browser ze ontvangt via Set-Cookie.
            req.cookies.set(name, value);
            successRedirect.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error)
      return NextResponse.redirect(
        `${url.origin}/login?error=${encodeURIComponent(error.message)}`
      );
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      // type kan "recovery" zijn bij wachtwoord-reset; cast naar any om TS-smalle
      // union te omzeilen — runtime-waarde klopt en wordt door Supabase geaccepteerd.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      type: type as any,
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

  return successRedirect;
}
