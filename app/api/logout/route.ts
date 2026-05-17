import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  const origin = new URL(req.url).origin;
  return NextResponse.redirect(`${origin}/login`, { status: 303 });
}
