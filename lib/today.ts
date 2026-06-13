// NL-dag (Europe/Amsterdam) bepalen, zodat server (UTC) en client dezelfde
// "vandaag" gebruiken. Door data-today direct in de JSX te zetten (i.p.v.
// achteraf via TodayButton) blijft de gouden vandaag-arcering staan, ook na
// het wisselen van de sorteer-toggle of een navigatie.
export function nlDayKey(d: Date): string {
  const parts = new Intl.DateTimeFormat("nl-NL", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .formatToParts(d)
    .reduce<Record<string, string>>((acc, p) => {
      acc[p.type] = p.value;
      return acc;
    }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function isTodayNL(kickoff: string, now: Date = new Date()): boolean {
  return nlDayKey(new Date(kickoff)) === nlDayKey(now);
}
