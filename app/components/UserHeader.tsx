import LockBadge from "./LockBadge";
import ThemeToggle from "./ThemeToggle";

export default function UserHeader({
  displayName,
  isLocked,
  lockAt,
}: {
  displayName: string;
  isAdmin?: boolean;
  isLocked: boolean;
  lockAt: string;
}) {
  return (
    <div className="flex items-center gap-2 sm:gap-3 shrink-0">
      <div className="text-right text-xs hidden sm:block">
        <div className="font-medium">{displayName}</div>
        {/* Sluittijd staat al in de LockCountdown-balk bovenaan — hier weggelaten
            om dubbele info te voorkomen (en SSR-timezone-issues: server rendered
            in UTC waardoor hier ooit "15:00" stond i.p.v. de NL 17:00). */}
      </div>
      <LockBadge isLocked={isLocked} />
      <ThemeToggle />
      <form action="/api/logout" method="post">
        <button
          type="submit"
          title="Uitloggen"
          aria-label="Uitloggen"
          className="inline-flex items-center justify-center text-muted hover:text-brand transition border border-border rounded-md hover:border-brand px-2 py-1.5 sm:px-3"
        >
          <span className="sm:hidden text-base leading-none">↪</span>
          <span className="hidden sm:inline text-xs font-medium">Uitloggen</span>
        </button>
      </form>
    </div>
  );
}
