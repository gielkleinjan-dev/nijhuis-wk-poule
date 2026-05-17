import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const { email } = await req.json();
  if (!email) {
    return NextResponse.json({ error: "Vul je e-mailadres in" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const origin = new URL(req.url).origin;

  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/wachtwoord-instellen`,
  });

  // Verklap niet of het adres bestaat.
  return NextResponse.json({ ok: true });
}
