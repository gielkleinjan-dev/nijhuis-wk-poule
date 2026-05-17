import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";

// June 11 00:00 Amsterdam CEST = June 10 22:00 UTC
const SCHEDULED_LOCK_AT = "2026-06-10T22:00:00Z";

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const action = body.action as "lock" | "unlock";

  const newLockAt =
    action === "lock" ? new Date().toISOString() : SCHEDULED_LOCK_AT;

  const { error } = await supabase.rpc("admin_set_lock_at", {
    new_lock_at: newLockAt,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, lock_at: newLockAt });
}
