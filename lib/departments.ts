export const DEPARTMENTS = [
  "Team Administratie & Secretariaat",
  "Team Centraal",
  "Team Enschede",
  "Team Explorius",
  "Team Klant en Markt",
  "Team Koale kante",
  "Team Maatwerk",
  "Team Materieeldienst",
  "Team Service en Garantie",
  "Team Trento",
  "Team Zwolle",
] as const;

export type Department = (typeof DEPARTMENTS)[number];
