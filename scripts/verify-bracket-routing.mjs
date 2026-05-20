// Verificatie van de FIFA 3rd-placed routing-tabel tegen de bracket-graaf.
//
// Twee checks:
// 1. CROSS-CONSTRAINT: voor elk van de 495 scenario's moet de routing per
//    groep verwijzen naar een R32-slot waarvan die groep ook in de
//    bracket-graaf's "from"-lijst staat. Als die niet matcht is de tabel
//    intern inconsistent.
// 2. VOORBEELD-RAPPORT: 10 scenarios (FIFA's canonieke + 8 willekeurige)
//    met het volledige R32-schema voor visuele inspectie.
//
// Run: node scripts/verify-bracket-routing.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SOURCE_PATH = path.join(ROOT, "lib/bracket/fifa-thirds-source.json");
const REPORT_PATH = path.join(ROOT, "BRACKET-VERIFICATION.md");

const ALL_GROUPS = ["A","B","C","D","E","F","G","H","I","J","K","L"];

// Bracket-graaf: per R32-match met 3rd-placed slot, welke 5 groepen kunnen die slot leveren.
// Bron: lib/bracket/bracket-graph.ts (FIFA Article 12.6 / Annex C).
const THIRD_PLACED_SLOTS = {
  "R32-2":  ["A","B","C","D","F"],
  "R32-5":  ["C","D","F","G","H"],
  "R32-7":  ["C","E","F","H","I"],
  "R32-8":  ["E","H","I","J","K"],
  "R32-9":  ["B","E","F","I","J"],
  "R32-10": ["A","E","H","I","J"],
  "R32-13": ["E","F","G","I","J"],
  "R32-15": ["D","E","I","J","L"],
};

// Vaste home-teams (groepswinnaars en runners-up) per R32-match.
// Voor matches met een 3rd-placed slot: home = vaste groep-winnaar.
// Voor matches zonder 3rd-placed: home + away = vaste seeds.
const R32_FIXTURES = {
  "R32-1":  { home: "2A", away: "2B" },
  "R32-2":  { home: "1E", away: null /* 3rd from R32-2 */ },
  "R32-3":  { home: "1F", away: "2C" },
  "R32-4":  { home: "1C", away: "2F" },
  "R32-5":  { home: "1I", away: null },
  "R32-6":  { home: "2E", away: "2I" },
  "R32-7":  { home: "1A", away: null },
  "R32-8":  { home: "1L", away: null },
  "R32-9":  { home: "1D", away: null },
  "R32-10": { home: "1G", away: null },
  "R32-11": { home: "1B", away: "2J" },
  "R32-12": { home: "1J", away: "2D" },
  "R32-13": { home: "1H", away: null },
  "R32-14": { home: "2L", away: "2H" },
  "R32-15": { home: "1K", away: null },
  "R32-16": { home: "2K", away: "2G" },
};

// Laad de FIFA-tabel
const source = JSON.parse(fs.readFileSync(SOURCE_PATH, "utf8"));

function makeKey(groups) {
  return [...groups].sort().join("");
}

function getRouting(groups) {
  return source[makeKey(groups)];
}

// ── CHECK 1: Cross-constraint (alle 495 × 8 = 3960 routings) ────────────────
function crossConstraintCheck() {
  const errors = [];
  for (const [key, routing] of Object.entries(source)) {
    for (const [group, r] of Object.entries(routing)) {
      const allowedGroups = THIRD_PLACED_SLOTS[r.match];
      if (!allowedGroups) {
        errors.push(`${key}: routing ${group} → ${r.match} (onbekende match)`);
        continue;
      }
      if (!allowedGroups.includes(group)) {
        errors.push(
          `${key}: groep ${group} wordt naar ${r.match} gerouteerd, maar ${r.match} accepteert alleen ${allowedGroups.join("/")} als 3rd-placed`
        );
      }
    }
  }
  return errors;
}

// ── CHECK 2: 8 sample scenario's met volledig R32-schema ────────────────────
function renderScenario(label, groups) {
  const routing = getRouting(groups);
  if (!routing) return `**${label}** — geen routing gevonden voor ${groups.join(",")} ❌\n`;

  const lines = [];
  lines.push(`### ${label}`);
  lines.push(`8 beste nummers 3 uit poules: **${groups.join(", ")}**`);
  lines.push(`Niet-doorgaande nrs 3: ${ALL_GROUPS.filter(g => !groups.includes(g)).join(", ")}`);
  lines.push("");
  lines.push("| Wedstrijd | Home | Away |");
  lines.push("|---|---|---|");
  for (let i = 1; i <= 16; i++) {
    const matchId = `R32-${i}`;
    const fix = R32_FIXTURES[matchId];
    let away = fix.away;
    if (away === null) {
      // 3rd-placed slot — vind welke groep deze slot vult
      const thirdGroup = Object.entries(routing).find(([, r]) => r.match === matchId)?.[0];
      away = thirdGroup ? `3${thirdGroup}` : "?";
    }
    lines.push(`| ${matchId} (M${72 + i}) | ${fix.home} | ${away} |`);
  }
  return lines.join("\n") + "\n";
}

function pickRandom(seed) {
  // Deterministische pseudo-random per seed, kies 8 van 12 groepen
  let x = seed;
  function rand() {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    return x / 0x7fffffff;
  }
  const pool = [...ALL_GROUPS];
  const out = [];
  for (let i = 0; i < 8; i++) {
    const idx = Math.floor(rand() * pool.length);
    out.push(pool.splice(idx, 1)[0]);
  }
  return out.sort();
}

// ── Genereer het rapport ────────────────────────────────────────────────────
const errors = crossConstraintCheck();

const lines = [];
lines.push("# Bracket-routing verificatie\n");
lines.push("Gegenereerd op: " + new Date().toISOString() + "\n");
lines.push("## Check 1 — cross-constraint over alle 495 scenarios\n");
lines.push("Voor elk van de 495 routings checken we: als een groep wordt gerouteerd naar bv. R32-7,");
lines.push("moet die groep ook in de bracket-graaf op die plek toegestaan zijn (5-groepen-lijst per slot).");
lines.push("Bij inconsistentie zou de FIFA-tabel intern fout zijn.\n");

if (errors.length === 0) {
  lines.push(`✅ Alle 3960 routings (495 scenarios × 8 routings) consistent met de bracket-graaf.\n`);
} else {
  lines.push(`❌ ${errors.length} inconsistenties:\n`);
  for (const e of errors.slice(0, 20)) lines.push(`- ${e}`);
  if (errors.length > 20) lines.push(`- (... +${errors.length - 20} meer)`);
}

lines.push("\n## Check 2 — 10 sample scenarios met volledig R32-schema\n");
lines.push("Iedere wedstrijd toont home (groepswinnaar of runner-up) en away (de andere kant).");
lines.push("`1E` = winnaar Poule E, `2A` = runner-up Poule A, `3F` = nummer 3 van Poule F.");
lines.push("De 8 R32-wedstrijden met een 3rd-placed komen automatisch uit de FIFA-tabel.\n");

// 2 canonieke FIFA-voorbeelden + 8 willekeurig
const scenarios = [
  { label: "Scenario 1 — FIFA's canonieke optie 1 (E,F,G,H,I,J,K,L)", groups: ["E","F","G","H","I","J","K","L"] },
  { label: "Scenario 2 — FIFA's canonieke optie 495 (A,B,C,D,E,F,G,H)", groups: ["A","B","C","D","E","F","G","H"] },
];

const seeds = [42, 137, 256, 512, 1024, 2048, 4096, 8192];
for (let i = 0; i < seeds.length; i++) {
  scenarios.push({ label: `Scenario ${i + 3} — willekeurig (seed ${seeds[i]})`, groups: pickRandom(seeds[i]) });
}

for (const s of scenarios) {
  lines.push(renderScenario(s.label, s.groups));
  lines.push("");
}

fs.writeFileSync(REPORT_PATH, lines.join("\n"));
console.log(`✓ Rapport geschreven naar ${REPORT_PATH}`);
console.log(`  Check 1: ${errors.length === 0 ? "✅ geen inconsistenties" : `❌ ${errors.length} fouten`}`);
console.log(`  Check 2: ${scenarios.length} scenario's met volledig R32-schema`);

if (errors.length > 0) process.exit(1);
