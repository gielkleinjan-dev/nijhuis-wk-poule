export const ROUNDS = [
  {
    key: "LAST_32",
    label: "1/16e finale",
    count: 32,
    points: 4,
    hint: "De nummers 1 en 2 van alle 12 poules (24 teams) plus de 8 beste nummers 3 plaatsen zich voor de 1/16e finale. Dat zijn 32 landen. Kies welke 32 volgens jou de groepsfase overleven.",
  },
  {
    key: "LAST_16",
    label: "1/8e finale",
    count: 16,
    points: 7,
    hint: "Vanuit de groepsfase plaatsen zich 32 teams (nummers 1 en 2 van elke poule plus de 8 beste nummers 3). Die 32 spelen onderling de 1/16e finale, telkens tegen een team uit een andere poule. De 16 winnaars gaan door naar de 1/8e finale — kies welke 16 landen volgens jou die 1/16e finale winnen.",
  },
  {
    key: "QUARTER_FINALS",
    label: "Kwartfinale",
    count: 8,
    points: 12,
    hint: "De 16 teams uit de 1/8e finale spelen tegen elkaar. De 8 winnaars gaan door naar de kwartfinale — kies jouw 8.",
  },
  {
    key: "SEMI_FINALS",
    label: "Halve finale",
    count: 4,
    points: 18,
    hint: "De 4 winnaars van de kwartfinales gaan door. Kies welke 4 landen jij in de halve finale verwacht.",
  },
  {
    key: "FINAL",
    label: "Finale",
    count: 2,
    points: 28,
    hint: "De 2 winnaars van de halve finales staan in de finale. Kies jouw twee finalisten.",
  },
  {
    key: "CHAMPION",
    label: "Wereldkampioen",
    count: 1,
    points: 40,
    hint: "De winnaar van de finale. Kies het land dat volgens jou wereldkampioen wordt.",
  },
] as const;

export type Team = { code: string; name: string; group: string };
export type Picks = Record<string, Set<string>>;
