export const ROUNDS = [
  {
    key: "LAST_32",
    label: "1/16e finale",
    count: 32,
    points: 4,
    hint: "Nrs. 1 en 2 van alle 12 poules (24 teams) + de 8 beste nrs. 3 kwalificeren voor de 1/16e finale. Dat zijn 32 landen. Kies welke 32 jij denkt dat de groepsfase overleven.",
  },
  {
    key: "LAST_16",
    label: "1/8e finale",
    count: 16,
    points: 7,
    hint: "32 teams kwalificeren uit de groepsfase (nrs. 1 & 2 van alle 12 poules + 8 beste nrs. 3). Die 32 spelen eerst de 1/16e finale tegen een team uit een andere poule. De 16 winnaars komen in de 1/8e finale — kies welke 16 landen jij die 1/16e ziet winnen.",
  },
  {
    key: "QUARTER_FINALS",
    label: "Kwartfinale",
    count: 8,
    points: 12,
    hint: "De 16 teams uit de 1/8e finale spelen elkaar. De 8 winnaars gaan door naar de kwartfinale. Kies jouw 8.",
  },
  {
    key: "SEMI_FINALS",
    label: "Halve finale",
    count: 4,
    points: 18,
    hint: "De 4 kwartfinalewinnaar gaan door. Kies welke 4 landen jij in de halve finale verwacht.",
  },
  {
    key: "FINAL",
    label: "Finale",
    count: 2,
    points: 28,
    hint: "De 2 landen die de halve finale winnen spelen de finale. Kies jouw twee finalisten.",
  },
  {
    key: "CHAMPION",
    label: "Wereldkampioen",
    count: 1,
    points: 40,
    hint: "De winnaar van de finale. Kies het land dat jij wereldkampioen ziet worden.",
  },
] as const;

export type Team = { code: string; name: string; group: string };
export type Picks = Record<string, Set<string>>;
