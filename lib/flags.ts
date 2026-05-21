// FIFA drielettercode → ISO-2 land-code voor de 48 WK 2026 deelnemers.
const TLA_TO_ISO2: Record<string, string> = {
  ALG: "DZ", ARG: "AR", AUS: "AU", AUT: "AT",
  BEL: "BE", BIH: "BA", BRA: "BR", CAN: "CA",
  CIV: "CI", COD: "CD", COL: "CO", CPV: "CV",
  CRO: "HR", CUR: "CW", CZE: "CZ", ECU: "EC",
  EGY: "EG", ENG: "GB-ENG", ESP: "ES", FRA: "FR",
  GER: "DE", GHA: "GH", HAI: "HT", IRN: "IR",
  IRQ: "IQ", JOR: "JO", JPN: "JP", KOR: "KR",
  KSA: "SA", MAR: "MA", MEX: "MX", NED: "NL",
  NOR: "NO", NZL: "NZ", PAN: "PA", PAR: "PY",
  POR: "PT", QAT: "QA", RSA: "ZA", SCO: "GB-SCT",
  SEN: "SN", SUI: "CH", SWE: "SE", TUN: "TN",
  TUR: "TR", URY: "UY", USA: "US", UZB: "UZ",
};

// Echte emoji-string. NB: in de UI niet direct in een raw <span> renderen want
// dan worden de vlaggetjes in Citrix kapotte plaatjes. Gebruik in plaats daarvan
// het <Flag> React-component (app/components/Flag.tsx) — dat wrappt 'm in een
// .flag-emoji class waarmee we per thema kunnen tonen/verbergen.
export function flagEmoji(tla: string | null | undefined): string {
  if (!tla) return "🏳️";
  const iso = TLA_TO_ISO2[tla];
  if (!iso) return "🏳️";
  if (iso === "GB-ENG") return "🏴󠁧󠁢󠁥󠁮󠁧󠁿";
  if (iso === "GB-SCT") return "🏴󠁧󠁢󠁳󠁣󠁴󠁿";
  const codePoints = iso.split("").map((c) => 127397 + c.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}
