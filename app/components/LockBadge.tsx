export default function LockBadge({ isLocked }: { isLocked: boolean }) {
  return (
    <span
      title={
        isLocked
          ? "Poule gesloten — invullen kan niet meer"
          : "Poule open — invullen kan nog"
      }
      className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border-2 shrink-0 ${
        isLocked
          ? "bg-brand text-white border-brand"
          : "bg-pitch-soft border-pitch/30 text-pitch"
      }`}
    >
      {isLocked ? "🔒" : "🔓"}
      <span className="hidden sm:inline">
        {isLocked ? "Invullen & wijzigen gesloten" : "Invullen & wijzigen kan nog"}
      </span>
    </span>
  );
}
