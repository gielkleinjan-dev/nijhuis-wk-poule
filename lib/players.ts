// Bekende aanvallers / topscorer-kandidaten per WK 2026 deelnemend land.
// TLA-codes volgen football-data.org (CUR ipv CUW, URY ipv URU).

export type Player = { name: string; tla: string };

export const PLAYERS: Player[] = [
  // Argentinië — WK 2026 selectie
  { name: "Lionel Messi", tla: "ARG" },
  { name: "Julián Álvarez", tla: "ARG" },
  { name: "Lautaro Martínez", tla: "ARG" },
  { name: "Nicolás González", tla: "ARG" },
  { name: "Thiago Almada", tla: "ARG" },

  // Australië
  { name: "Mathew Leckie", tla: "AUS" },
  { name: "Martin Boyle", tla: "AUS" },
  { name: "Mitchell Duke", tla: "AUS" },

  // België — WK 2026 selectie
  { name: "Romelu Lukaku", tla: "BEL" },
  { name: "Jeremy Doku", tla: "BEL" },
  { name: "Kevin De Bruyne", tla: "BEL" },
  { name: "Leandro Trossard", tla: "BEL" },
  { name: "Charles De Ketelaere", tla: "BEL" },

  // Bosnië-Herzegovina
  { name: "Edin Džeko", tla: "BIH" },
  { name: "Ermedin Demirović", tla: "BIH" },
  { name: "Sead Kolašinac", tla: "BIH" },

  // Brazilië — WK 2026 selectie (Rodrygo & G. Jesus niet in selectie)
  { name: "Vinícius Jr.", tla: "BRA" },
  { name: "Raphinha", tla: "BRA" },
  { name: "Gabriel Martinelli", tla: "BRA" },
  { name: "Endrick", tla: "BRA" },
  { name: "Neymar", tla: "BRA" },
  { name: "Matheus Cunha", tla: "BRA" },

  // Canada
  { name: "Jonathan David", tla: "CAN" },
  { name: "Alphonso Davies", tla: "CAN" },
  { name: "Cyle Larin", tla: "CAN" },
  { name: "Tajon Buchanan", tla: "CAN" },

  // Ivoorkust — WK 2026 selectie (Haller standby, Zaha gedropt)
  { name: "Nicolas Pépé", tla: "CIV" },
  { name: "Ange-Yoan Bonny", tla: "CIV" },
  { name: "Amad Diallo", tla: "CIV" },
  { name: "Simon Adingra", tla: "CIV" },

  // Democratische Republiek Congo
  { name: "Cédric Bakambu", tla: "COD" },
  { name: "Yannick Carrasco", tla: "COD" },

  // Colombia — WK 2026 selectie
  { name: "Luis Díaz", tla: "COL" },
  { name: "James Rodríguez", tla: "COL" },
  { name: "Luis Suárez", tla: "COL" },
  { name: "Jhon Córdoba", tla: "COL" },
  { name: "Juan Camilo Hernández", tla: "COL" },

  // Kaapverdië
  { name: "Gilson Tavares", tla: "CPV" },

  // Kroatië — WK 2026 selectie (Petković niet in)
  { name: "Andrej Kramarić", tla: "CRO" },
  { name: "Luka Modrić", tla: "CRO" },
  { name: "Ivan Perišić", tla: "CRO" },
  { name: "Ante Budimir", tla: "CRO" },
  { name: "Petar Musa", tla: "CRO" },

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

  // Engeland — WK 2026 selectie (Foden & Palmer gedropt door Tuchel)
  { name: "Harry Kane", tla: "ENG" },
  { name: "Jude Bellingham", tla: "ENG" },
  { name: "Bukayo Saka", tla: "ENG" },
  { name: "Marcus Rashford", tla: "ENG" },
  { name: "Ivan Toney", tla: "ENG" },
  { name: "Ollie Watkins", tla: "ENG" },
  { name: "Anthony Gordon", tla: "ENG" },

  // Frankrijk — WK 2026 selectie (Griezmann niet meer in)
  { name: "Kylian Mbappé", tla: "FRA" },
  { name: "Ousmane Dembélé", tla: "FRA" },
  { name: "Marcus Thuram", tla: "FRA" },
  { name: "Bradley Barcola", tla: "FRA" },
  { name: "Michael Olise", tla: "FRA" },
  { name: "Rayan Cherki", tla: "FRA" },
  { name: "Désiré Doué", tla: "FRA" },

  // Duitsland — WK 2026 selectie (Füllkrug niet meer in)
  { name: "Florian Wirtz", tla: "GER" },
  { name: "Jamal Musiala", tla: "GER" },
  { name: "Leroy Sané", tla: "GER" },
  { name: "Kai Havertz", tla: "GER" },
  { name: "Nick Woltemade", tla: "GER" },
  { name: "Deniz Undav", tla: "GER" },

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

  // Japan — WK 2026 selectie (Mitoma & Minamino geblesseerd, vallen af)
  { name: "Ritsu Doan", tla: "JPN" },
  { name: "Keito Nakamura", tla: "JPN" },
  { name: "Ayase Ueda", tla: "JPN" },
  { name: "Takefusa Kubo", tla: "JPN" },
  { name: "Daizen Maeda", tla: "JPN" },

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

  // Mexico — WK 2026 selectie (Lozano & Henry Martín niet in)
  { name: "Raúl Jiménez", tla: "MEX" },
  { name: "Santiago Giménez", tla: "MEX" },
  { name: "Alexis Vega", tla: "MEX" },
  { name: "Julián Quiñones", tla: "MEX" },

  // Marokko — WK 2026 selectie (En-Nesyri & Ziyech gedropt door Ouahbi)
  { name: "Achraf Hakimi", tla: "MAR" },
  { name: "Brahim Díaz", tla: "MAR" },
  { name: "Ayoub El Kaabi", tla: "MAR" },
  { name: "Soufiane Rahimi", tla: "MAR" },
  { name: "Abdessamad Ezzalzouli", tla: "MAR" },

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
  { name: "Xavi Simons", tla: "NED" },

  // Nieuw-Zeeland
  { name: "Chris Wood", tla: "NZL" },
  { name: "Oli Sail", tla: "NZL" },

  // Oostenrijk
  { name: "Marko Arnautović", tla: "AUT" },
  { name: "Marcel Sabitzer", tla: "AUT" },
  { name: "Michael Gregoritsch", tla: "AUT" },
  { name: "Christoph Baumgartner", tla: "AUT" },

  // Noorwegen — WK 2026 selectie
  { name: "Erling Haaland", tla: "NOR" },
  { name: "Martin Ødegaard", tla: "NOR" },
  { name: "Alexander Sørloth", tla: "NOR" },
  { name: "Antonio Nusa", tla: "NOR" },
  { name: "Jørgen Strand Larsen", tla: "NOR" },

  // Panama
  { name: "Rolando Blackburn", tla: "PAN" },
  { name: "Cecilio Waterman", tla: "PAN" },

  // Paraguay
  { name: "Miguel Almirón", tla: "PAR" },
  { name: "Julio Enciso", tla: "PAR" },
  { name: "Antonio Sanabria", tla: "PAR" },

  // Portugal — WK 2026 selectie
  { name: "Cristiano Ronaldo", tla: "POR" },
  { name: "Bruno Fernandes", tla: "POR" },
  { name: "Rafael Leão", tla: "POR" },
  { name: "João Félix", tla: "POR" },
  { name: "Bernardo Silva", tla: "POR" },
  { name: "Gonçalo Ramos", tla: "POR" },
  { name: "Pedro Neto", tla: "POR" },
  { name: "Francisco Conceição", tla: "POR" },

  // Qatar
  { name: "Akram Afif", tla: "QAT" },
  { name: "Almoez Ali", tla: "QAT" },
  { name: "Hasan Al-Haydos", tla: "QAT" },

  // Schotland
  { name: "Lyndon Dykes", tla: "SCO" },
  { name: "Lawrence Shankland", tla: "SCO" },
  { name: "Che Adams", tla: "SCO" },

  // Senegal — WK 2026 selectie (Habib Diallo niet in)
  { name: "Sadio Mané", tla: "SEN" },
  { name: "Ismaïla Sarr", tla: "SEN" },
  { name: "Nicolas Jackson", tla: "SEN" },
  { name: "Iliman Ndiaye", tla: "SEN" },

  // Zweden — WK 2026 selectie (Kulusevski geblesseerd, Forsberg niet in)
  { name: "Viktor Gyökeres", tla: "SWE" },
  { name: "Alexander Isak", tla: "SWE" },
  { name: "Anthony Elanga", tla: "SWE" },

  // Zwitserland — WK 2026 selectie
  { name: "Breel Embolo", tla: "SUI" },
  { name: "Xherdan Shaqiri", tla: "SUI" },
  { name: "Ruben Vargas", tla: "SUI" },
  { name: "Dan Ndoye", tla: "SUI" },
  { name: "Zeki Amdouni", tla: "SUI" },
  { name: "Noah Okafor", tla: "SUI" },

  // Zuid-Afrika
  { name: "Percy Tau", tla: "RSA" },
  { name: "Lyle Foster", tla: "RSA" },
  { name: "Evidence Makgopa", tla: "RSA" },

  // Spanje — WK 2026 selectie (Morata gedropt, geen Real-spelers)
  { name: "Lamine Yamal", tla: "ESP" },
  { name: "Nico Williams", tla: "ESP" },
  { name: "Ferran Torres", tla: "ESP" },
  { name: "Mikel Oyarzabal", tla: "ESP" },
  { name: "Dani Olmo", tla: "ESP" },
  { name: "Yéremy Pino", tla: "ESP" },

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

  // Uruguay — WK 2026 selectie (Suárez niet meer in, slechts 3 forwards)
  { name: "Darwin Núñez", tla: "URY" },
  { name: "Federico Valverde", tla: "URY" },
  { name: "Rodrigo Bentancur", tla: "URY" },
  { name: "Rodrigo Aguirre", tla: "URY" },
  { name: "Federico Viñas", tla: "URY" },

  // VS — WK 2026 selectie
  { name: "Christian Pulisic", tla: "USA" },
  { name: "Ricardo Pepi", tla: "USA" },
  { name: "Folarin Balogun", tla: "USA" },
  { name: "Timothy Weah", tla: "USA" },
  { name: "Haji Wright", tla: "USA" },

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
