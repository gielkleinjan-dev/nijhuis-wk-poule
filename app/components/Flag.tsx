import { flagEmoji } from "@/lib/flags";

// Theme-aware vlag-render: zichtbaar in scorito-mode (iets groter dan tekstgrootte),
// verborgen in nijhuis-mode (Citrix-fix). De class .flag-emoji wordt in globals.css
// per data-theme aan/uit gezet, dus we kunnen overal gewoon <Flag code={tla}/>
// renderen zonder per pagina te checken welk thema actief is.
//
// className: extra classes voor positionering/spacing op de plek van gebruik.
export default function Flag({
  code,
  className = "",
}: {
  code: string | null | undefined;
  className?: string;
}) {
  return (
    <span aria-hidden className={`flag-emoji ${className}`.trim()}>
      {flagEmoji(code)}
    </span>
  );
}
