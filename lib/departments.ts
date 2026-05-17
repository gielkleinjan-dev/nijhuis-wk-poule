export const DEPARTMENTS = [
  "Team Administratie & Secretariaat",
  "Team Centraal",
  "Team Enschede",
  "Team Familie leden",
  "Team Klant en Markt",
  "Team Maatwerk",
  "Team Materieeldienst",
  "Team Service en Garantie",
  "Team Trento",
  "Team Zwolle",
] as const;

export type Department = (typeof DEPARTMENTS)[number];
