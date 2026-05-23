import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin";
import MainNav from "@/app/components/MainNav";
import LockCountdown from "@/app/components/LockCountdown";

export default async function VoorspellingenLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: settings } = await supabase
    .from("settings")
    .select("lock_at")
    .eq("id", 1)
    .single();

  const lockAt = settings?.lock_at ?? "2026-06-11T17:00:00Z";
  const isLocked = new Date(lockAt) <= new Date();

  // Niet-admins mogen pas naar deze pagina als de poule gesloten is.
  if (!isLocked && !isAdmin(user.email)) {
    redirect("/invullen");
  }

  return (
    <>
      <LockCountdown lockAt={lockAt} />
      <MainNav isAdmin={isAdmin(user.email)} isLocked={isLocked} lockAt={lockAt} maxWidth="max-w-5xl" />
      {children}
    </>
  );
}
