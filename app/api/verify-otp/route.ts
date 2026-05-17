import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const { email, token } = await req.json();

  if (!email || !token) {
    return NextResponse.json({ error: "E-mail en code zijn vereist" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({
    email,
    token: String(token).trim(),
    type: "email",
  });

  if (error) {
    return NextResponse.json({ error: "Code klopt niet of is verlopen" }, { status: 401 });
  }

  // Upsert profile (mirrors /auth/callback)
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    await supabase.from("profiles").upsert(
      {
        id: user.id,
        display_name: user.user_metadata?.display_name || user.email!.split("@")[0],
        department: user.user_metadata?.department || null,
      },
      { onConflict: "id", ignoreDuplicates: false }
    );
  }

  return NextResponse.json({ ok: true });
}
