import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const { code, email, name, department } = await req.json();

  if (!code || !email || !name) {
    return NextResponse.json({ error: "Vul alle velden in" }, { status: 400 });
  }

  // Server client met cookies — nodig zodat PKCE code_verifier opgeslagen wordt
  // en de /auth/callback hem kan uitwisselen voor een sessie.
  const supabase = await createSupabaseServerClient();

  const { data: valid, error: rpcError } = await supabase.rpc("validate_invite_code", {
    p_code: code,
  });
  if (rpcError) return NextResponse.json({ error: rpcError.message }, { status: 500 });
  if (!valid) {
    return NextResponse.json(
      { error: "Onbekende of inactieve invite-code" },
      { status: 403 }
    );
  }

  const origin = new URL(req.url).origin;
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
      shouldCreateUser: true,
      data: { display_name: name, department: department || null },
    },
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
