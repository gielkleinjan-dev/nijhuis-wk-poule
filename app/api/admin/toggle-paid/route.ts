import { NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";

export async function POST(req: Request) {
  const { userId, paid } = await req.json();
  if (!userId || typeof paid !== "boolean") {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createSupabaseServiceRoleClient();
  const { error } = await admin.from("profiles").update({ paid }).eq("id", userId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
