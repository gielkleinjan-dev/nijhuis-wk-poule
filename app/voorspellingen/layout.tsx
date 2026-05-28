import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin";
import MainNav from "@/app/components/MainNav";
import LockCountdown from "@/app/components/LockCountdown";
import BrandLogo from "@/app/components/BrandLogo";
import UserHeader from "@/app/components/UserHeader";

export default async function VoorspellingenLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: settings } = await supabase
    .from("settings")
    .select("lock_at")
    .eq("id", 1)
    .single();

  const lockAt = settings?.lock_at ?? "2026-06-10T15:00:00Z";
  const isLocked = new Date(lockAt) <= new Date();

  // Niet-admins mogen pas naar deze pagina als de poule gesloten is.
  if (!isLocked && !isAdmin(user.email)) {
    redirect("/invullen");
  }

  const userIsAdmin = isAdmin(user.email);
  const displayName = user.user_metadata?.display_name || user.email || "";

  return (
    <main className="min-h-screen">
      <LockCountdown lockAt={lockAt} />
      <header className="border-b border-border bg-surface">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-4 flex items-center justify-between gap-3 sm:gap-4">
          <BrandLogo href="/invullen" />
          <UserHeader
            displayName={displayName}
            isAdmin={userIsAdmin}
            isLocked={isLocked}
            lockAt={lockAt}
          />
        </div>
      </header>
      <MainNav isAdmin={userIsAdmin} isLocked={isLocked} lockAt={lockAt} maxWidth="max-w-5xl" />
      {children}
    </main>
  );
}
