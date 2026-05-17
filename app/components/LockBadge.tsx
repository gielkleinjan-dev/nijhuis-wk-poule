export default function LockBadge({ isLocked }: { isLocked: boolean }) {
  return (
    <span
      title={
        isLocked
          ? "Poule gesloten — invullen kan niet meer"
          : "Poule open — invullen kan nog"
      }
      className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border shrink-0 ${
        isLocked
          ? "bg-brand-soft border-brand/30 text-brand"
          : "bg-pitch-soft border-pitch/30 text-pitch"
      }`}
    >
      {isLocked ? "🔒" : "🔓"}
      <span className="hidden sm:inline">{isLocked ? "Gesloten" : "Open"}</span>
    </span>
  );
}
