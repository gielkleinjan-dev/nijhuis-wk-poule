import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const { code, email, name, department, password } = await req.json();

  if (!code || !email || !name || !password) {
    return NextResponse.json({ error: "Vul alle velden in" }, { status: 400 });
  }
  if (typeof password !== "string" || password.length < 6) {
    return NextResponse.json({ error: "Wachtwoord moet minstens 6 tekens zijn" }, { status: 400 });
  }

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

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: name, department: department || null },
    },
  });
  if (error) {
    const msg = /registered|exists/i.test(error.message)
      ? "Dit e-mailadres is al geregistreerd. Gebruik 'Al ingeschreven' om in te loggen."
      : error.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  if (data.user) {
    await supabase.from("profiles").upsert(
      {
        id: data.user.id,
        display_name: name,
        department: department || null,
      },
      { onConflict: "id", ignoreDuplicates: false }
    );
  }

  return NextResponse.json({ ok: true, session: !!data.session });
}
