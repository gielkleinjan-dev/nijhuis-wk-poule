import LockToggle from "./LockToggle";

export default function UserHeader({
  displayName,
  isAdmin,
  isLocked,
  lockAt,
}: {
  displayName: string;
  isAdmin: boolean;
  isLocked: boolean;
  lockAt: string;
}) {
  return (
    <div className="flex items-center gap-3 shrink-0">
      <div className="text-right text-xs">
        <div className="font-medium">{displayName}</div>
        {isLocked ? (
          <div className="text-brand font-semibold">Gesloten</div>
        ) : (
          <div className="text-muted">
            Sluit{" "}
            {new Intl.DateTimeFormat("nl-NL", {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            }).format(new Date(lockAt))}
          </div>
        )}
      </div>
      {isAdmin && <LockToggle isLocked={isLocked} lockAt={lockAt} />}
      <form action="/api/logout" method="post">
        <button
          type="submit"
          className="px-3 py-1.5 text-xs font-medium text-muted hover:text-brand transition border border-border rounded-md hover:border-brand"
        >
          Uitloggen
        </button>
      </form>
    </div>
  );
}
