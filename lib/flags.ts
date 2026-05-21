// Vlag-emoji's bleken in de praktijk problematisch:
// - Citrix / oudere Windows-builds renderen de regional-indicator emoji's niet,
//   wat na Twemoji-rewrite leidt tot broken-image placeholders.
// - De drielettercodes (MX, BA, BR…) en landnamen staan overal toch al naast
//   de vlag, dus we verliezen geen informatie door ze weg te laten.
// De functie blijft bestaan zodat alle bestaande JSX (`<span>{flagEmoji(code)}</span>`)
// gewoon blijft werken — hij rendert nu simpelweg niks.
export function flagEmoji(_tla: string | null | undefined): string {
  return "";
}
