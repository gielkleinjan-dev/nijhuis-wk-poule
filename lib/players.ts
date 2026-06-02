// Bekende aanvallers / topscorer-kandidaten per WK 2026 deelnemend land.
// TLA-codes volgen football-data.org (CUR ipv CUW, URY ipv URU).

export type Player = { name: string; tla: string };

export const PLAYERS: Player[] = [
  // Argentinië
  { name: "Lionel Messi", tla: "ARG" },
  { name: "Julián Álvarez", tla: "ARG" },
  { name: "Lautaro Martínez", tla: "ARG" },
  { name: "Ángel Di María", tla: "ARG" },

  // Australië
  { name: "Mathew Leckie", tla: "AUS" },
  { name: "Martin Boyle", tla: "AUS" },
  { name: "Mitchell Duke", tla: "AUS" },

  // België
  { name: "Romelu Lukaku", tla: "BEL" },
  { name: "Lois Openda", tla: "BEL" },
  { name: "Jeremy Doku", tla: "BEL" },
  { name: "Kevin De Bruyne", tla: "BEL" },

  // Bosnië-Herzegovina
  { name: "Edin Džeko", tla: "BIH" },
  { name: "Ermedin Demirović", tla: "BIH" },
  { name: "Sead Kolašinac", tla: "BIH" },

  // Brazilië
  { name: "Vinícius Jr.", tla: "BRA" },
  { name: "Rodrygo", tla: "BRA" },
  { name: "Raphinha", tla: "BRA" },
  { name: "Gabriel Martinelli", tla: "BRA" },
  { name: "Endrick", tla: "BRA" },
  { name: "Gabriel Jesus", tla: "BRA" },

  // Canada
  { name: "Jonathan David", tla: "CAN" },
  { name: "Alphonso Davies", tla: "CAN" },
  { name: "Cyle Larin", tla: "CAN" },
  { name: "Tajon Buchanan", tla: "CAN" },

  // Ivoorkust
  { name: "Sébastien Haller", tla: "CIV" },
  { name: "Wilfried Zaha", tla: "CIV" },
  { name: "Nicolas Pépé", tla: "CIV" },

  // Democratische Republiek Congo
  { name: "Cédric Bakambu", tla: "COD" },
  { name: "Yannick Carrasco", tla: "COD" },

  // Colombia
  { name: "Luis Díaz", tla: "COL" },
  { name: "James Rodríguez", tla: "COL" },
  { name: "Jhon Duran", tla: "COL" },
  { name: "Rafael Santos Borré", tla: "COL" },

  // Kaapverdië
  { name: "Gilson Tavares", tla: "CPV" },

  // Kroatië
  { name: "Andrej Kramarić", tla: "CRO" },
  { name: "Bruno Petković", tla: "CRO" },
  { name: "Luka Modrić", tla: "CRO" },
  { name: "Ivan Perišić", tla: "CRO" },

  // Curaçao
  { name: "Leandro Bacuna", tla: "CUR" },
  { name: "Juninho", tla: "CUR" },

  // Tsjechië
  { name: "Patrik Schick", tla: "CZE" },
  { name: "Mojmír Chytil", tla: "CZE" },
  { name: "Tomáš Souček", tla: "CZE" },

  // Ecuador
  { name: "Enner Valencia", tla: "ECU" },
  { name: "Jeremy Sarmiento", tla: "ECU" },
  { name: "Jordy Caicedo", tla: "ECU" },

  // Egypte
  { name: "Mohamed Salah", tla: "EGY" },
  { name: "Omar Marmoush", tla: "EGY" },
  { name: "Mostafa Mohamed", tla: "EGY" },

  // Engeland
  { name: "Harry Kane", tla: "ENG" },
  { name: "Jude Bellingham", tla: "ENG" },
  { name: "Phil Foden", tla: "ENG" },
  { name: "Bukayo Saka", tla: "ENG" },
  { name: "Marcus Rashford", tla: "ENG" },
  { name: "Cole Palmer", tla: "ENG" },

  // Frankrijk
  { name: "Kylian Mbappé", tla: "FRA" },
  { name: "Antoine Griezmann", tla: "FRA" },
  { name: "Ousmane Dembélé", tla: "FRA" },
  { name: "Marcus Thuram", tla: "FRA" },
  { name: "Bradley Barcola", tla: "FRA" },

  // Duitsland
  { name: "Florian Wirtz", tla: "GER" },
  { name: "Jamal Musiala", tla: "GER" },
  { name: "Leroy Sané", tla: "GER" },
  { name: "Kai Havertz", tla: "GER" },
  { name: "Niclas Füllkrug", tla: "GER" },

  // Ghana
  { name: "Jordan Ayew", tla: "GHA" },
  { name: "Antoine Semenyo", tla: "GHA" },
  { name: "André Ayew", tla: "GHA" },

  // Haïti
  { name: "Frantzdy Pierrot", tla: "HAI" },
  { name: "Duckens Nazon", tla: "HAI" },

  // Iran
  { name: "Mehdi Taremi", tla: "IRN" },
  { name: "Sardar Azmoun", tla: "IRN" },
  { name: "Karim Ansarifard", tla: "IRN" },
  { name: "Saman Ghoddos", tla: "IRN" },

  // Irak
  { name: "Amjed Attwan", tla: "IRQ" },
  { name: "Aymen Hussein", tla: "IRQ" },

  // Japan
  { name: "Kaoru Mitoma", tla: "JPN" },
  { name: "Takumi Minamino", tla: "JPN" },
  { name: "Ritsu Doan", tla: "JPN" },
  { name: "Keito Nakamura", tla: "JPN" },
  { name: "Ayase Ueda", tla: "JPN" },

  // Jordanië
  { name: "Yazan Al-Naimat", tla: "JOR" },
  { name: "Mohammad Abu Laila", tla: "JOR" },

  // Zuid-Korea
  { name: "Son Heung-min", tla: "KOR" },
  { name: "Hwang Hee-chan", tla: "KOR" },
  { name: "Oh Se-hun", tla: "KOR" },
  { name: "Lee Kang-in", tla: "KOR" },

  // Saudi-Arabië
  { name: "Salem Al-Dawsari", tla: "KSA" },
  { name: "Firas Al-Buraikan", tla: "KSA" },
  { name: "Saleh Al-Shehri", tla: "KSA" },

  // Mexico
  { name: "Hirving Lozano", tla: "MEX" },
  { name: "Raúl Jiménez", tla: "MEX" },
  { name: "Santiago Giménez", tla: "MEX" },
  { name: "Henry Martín", tla: "MEX" },

  // Marokko
  { name: "Youssef En-Nesyri", tla: "MAR" },
  { name: "Hakim Ziyech", tla: "MAR" },
  { name: "Sofiane Boufal", tla: "MAR" },
  { name: "Achraf Hakimi", tla: "MAR" },

  // Nederland — officiële WK 2026 selectie (aanvallend middenveld, buitenspelers, spitsen)
  { name: "Memphis Depay", tla: "NED" },
  { name: "Cody Gakpo", tla: "NED" },
  { name: "Donyell Malen", tla: "NED" },
  { name: "Wout Weghorst", tla: "NED" },
  { name: "Brian Brobbey", tla: "NED" },
  { name: "Noa Lang", tla: "NED" },
  { name: "Crysencio Summerville", tla: "NED" },
  { name: "Justin Kluivert", tla: "NED" },
  { name: "Guus Til", tla: "NED" },

  // Nieuw-Zeeland
  { name: "Chris Wood", tla: "NZL" },
  { name: "Oli Sail", tla: "NZL" },

  // Oostenrijk
  { name: "Marko Arnautović", tla: "AUT" },
  { name: "Marcel Sabitzer", tla: "AUT" },
  { name: "Michael Gregoritsch", tla: "AUT" },
  { name: "Christoph Baumgartner", tla: "AUT" },

  // Noorwegen
  { name: "Erling Haaland", tla: "NOR" },
  { name: "Martin Ødegaard", tla: "NOR" },
  { name: "Alexander Sørloth", tla: "NOR" },

  // Panama
  { name: "Rolando Blackburn", tla: "PAN" },
  { name: "Cecilio Waterman", tla: "PAN" },

  // Paraguay
  { name: "Miguel Almirón", tla: "PAR" },
  { name: "Julio Enciso", tla: "PAR" },
  { name: "Antonio Sanabria", tla: "PAR" },

  // Portugal
  { name: "Cristiano Ronaldo", tla: "POR" },
  { name: "Bruno Fernandes", tla: "POR" },
  { name: "Rafael Leão", tla: "POR" },
  { name: "João Félix", tla: "POR" },
  { name: "Bernardo Silva", tla: "POR" },
  { name: "Gonçalo Ramos", tla: "POR" },

  // Qatar
  { name: "Akram Afif", tla: "QAT" },
  { name: "Almoez Ali", tla: "QAT" },
  { name: "Hasan Al-Haydos", tla: "QAT" },

  // Schotland
  { name: "Lyndon Dykes", tla: "SCO" },
  { name: "Lawrence Shankland", tla: "SCO" },
  { name: "Che Adams", tla: "SCO" },

  // Senegal
  { name: "Sadio Mané", tla: "SEN" },
  { name: "Ismaïla Sarr", tla: "SEN" },
  { name: "Nicolas Jackson", tla: "SEN" },
  { name: "Habib Diallo", tla: "SEN" },

  // Zweden
  { name: "Viktor Gyökeres", tla: "SWE" },
  { name: "Alexander Isak", tla: "SWE" },
  { name: "Dejan Kulusevski", tla: "SWE" },
  { name: "Emil Forsberg", tla: "SWE" },

  // Zwitserland
  { name: "Breel Embolo", tla: "SUI" },
  { name: "Xherdan Shaqiri", tla: "SUI" },
  { name: "Ruben Vargas", tla: "SUI" },
  { name: "Dan Ndoye", tla: "SUI" },
  { name: "Zeki Amdouni", tla: "SUI" },

  // Zuid-Afrika
  { name: "Percy Tau", tla: "RSA" },
  { name: "Lyle Foster", tla: "RSA" },
  { name: "Evidence Makgopa", tla: "RSA" },

  // Spanje
  { name: "Álvaro Morata", tla: "ESP" },
  { name: "Lamine Yamal", tla: "ESP" },
  { name: "Nico Williams", tla: "ESP" },
  { name: "Ferran Torres", tla: "ESP" },
  { name: "Mikel Oyarzabal", tla: "ESP" },

  // Tunesië
  { name: "Wahbi Khazri", tla: "TUN" },
  { name: "Youssef Msakni", tla: "TUN" },
  { name: "Seifeddine Jaziri", tla: "TUN" },

  // Turkije
  { name: "Arda Güler", tla: "TUR" },
  { name: "Kenan Yıldız", tla: "TUR" },
  { name: "Hakan Çalhanoğlu", tla: "TUR" },
  { name: "Baris Alper Yilmaz", tla: "TUR" },
  { name: "Burak Yılmaz", tla: "TUR" },

  // Uruguay
  { name: "Darwin Núñez", tla: "URY" },
  { name: "Federico Valverde", tla: "URY" },
  { name: "Luis Suárez", tla: "URY" },
  { name: "Rodrigo Bentancur", tla: "URY" },

  // VS
  { name: "Christian Pulisic", tla: "USA" },
  { name: "Ricardo Pepi", tla: "USA" },
  { name: "Folarin Balogun", tla: "USA" },
  { name: "Timothy Weah", tla: "USA" },

  // Oezbekistan
  { name: "Eldor Shomurodov", tla: "UZB" },
  { name: "Dostonbek Tursunov", tla: "UZB" },

  // Algerije
  { name: "Riyad Mahrez", tla: "ALG" },
  { name: "Islam Slimani", tla: "ALG" },
  { name: "Andy Delort", tla: "ALG" },
  { name: "Said Benrahma", tla: "ALG" },
];

export function searchPlayers(query: string): Player[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");
  return PLAYERS.filter((p) => {
    const n = p.name.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");
    return n.includes(q);
  }).slice(0, 8);
}
