import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin";
import MainNav from "@/app/components/MainNav";
import BrandLogo from "@/app/components/BrandLogo";
import UserHeader from "@/app/components/UserHeader";
import LockCountdown from "@/app/components/LockCountdown";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!isAdmin(user.email)) redirect("/ranglijst");

  const { data: settings } = await supabase
    .from("settings")
    .select("lock_at")
    .eq("id", 1)
    .single();

  const lockAt = settings?.lock_at ?? "2026-06-11T17:00:00Z";
  const isLocked = new Date(lockAt) <= new Date();
  const displayName = user.user_metadata?.display_name || user.email || "";

  return (
    <main className="min-h-screen">
      <LockCountdown lockAt={lockAt} />
      <header className="border-b border-border bg-surface">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-4 flex items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3">
            <BrandLogo href="/invullen" />
            <span className="text-xs bg-brand text-white px-2 py-0.5 rounded font-semibold">
              Admin
            </span>
          </div>
          <UserHeader
            displayName={displayName}
            isAdmin={true}
            isLocked={isLocked}
            lockAt={lockAt}
          />
        </div>
      </header>
      <MainNav isAdmin={true} isLocked={isLocked} lockAt={lockAt} maxWidth="max-w-5xl" />
      {children}
    </main>
  );
}
