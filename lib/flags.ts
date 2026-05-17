// Map FIFA 3-letter code (TLA) to emoji flag using ISO-2 country code.
// Quick & dirty map for the 48 teams in WC 2026.
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

export function flagEmoji(tla: string | null | undefined): string {
  if (!tla) return "🏳️";
  const iso = TLA_TO_ISO2[tla];
  if (!iso) return "🏳️";
  // Special: England + Scotland (no emoji for sub-regions reliably) → use plain
  if (iso === "GB-ENG") return "🏴󠁧󠁢󠁥󠁮󠁧󠁿";
  if (iso === "GB-SCT") return "🏴󠁧󠁢󠁳󠁣󠁴󠁿";
  // Convert ISO-2 to regional indicator emoji
  const codePoints = iso
    .split("")
    .map((c) => 127397 + c.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}
