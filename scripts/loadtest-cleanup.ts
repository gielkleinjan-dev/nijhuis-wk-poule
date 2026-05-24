#!/usr/bin/env tsx
/**
 * Opruim-script voor de load-test. Verwijdert alle rijen die het loadtest-
 * script heeft achtergelaten — gemarkeerd via department='__LOADTEST__'.
 *
 * Veilig: raakt alleen profiles waar department exact die marker is. Echte
 * gebruikers gebruiken nooit die string als afdeling.
 *
 *   npx tsx scripts/loadtest-cleanup.ts          # toont wat het ZOU wissen
 *   npx tsx scripts/loadtest-cleanup.ts --confirm  # voert wis uit
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { existsSync } from "node:fs";

for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) {
    config({ path: file });
    break;
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("❌ Vereist: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in env.");
  process.exit(1);
}

const confirm = process.argv.includes("--confirm");
const supabase = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  // 1. Vind alle test-user-IDs
  const { data: testUsers, error: findErr } = await supabase
    .from("profiles")
    .select("id, display_name")
    .eq("department", "__LOADTEST__");

  if (findErr) {
    console.error("Lookup mislukt:", findErr);
    process.exit(1);
  }

  const userIds = (testUsers ?? []).map((u) => u.id);
  console.log(`\n🧹 Cleanup load-test data`);
  console.log(`Gevonden: ${userIds.length} test-users (department='__LOADTEST__')\n`);

  if (userIds.length === 0) {
    console.log("Niets om op te ruimen. Klaar.\n");
    return;
  }

  if (!confirm) {
    console.log("Geplande deletes:");
    console.log(`  - predictions waar user_id in test-users`);
    console.log(`  - bracket_picks waar user_id in test-users`);
    console.log(`  - bonus_picks waar user_id in test-users`);
    console.log(`  - points waar user_id in test-users`);
    console.log(`  - profiles waar department='__LOADTEST__'`);
    console.log(`\n⚠️  Dry-run. Run met --confirm om echt te wissen.\n`);
    return;
  }

  console.log("Wissen...\n");

  const ops = [
    { table: "predictions", filter: { col: "user_id", in: userIds } },
    { table: "bracket_picks", filter: { col: "user_id", in: userIds } },
    { table: "bonus_picks", filter: { col: "user_id", in: userIds } },
    { table: "points", filter: { col: "user_id", in: userIds } },
    { table: "bracket_match_overrides", filter: { col: "user_id", in: userIds } },
    { table: "profiles", filter: { col: "department", eq: "__LOADTEST__" } },
  ] as const;

  for (const op of ops) {
    let q = supabase.from(op.table).delete();
    if ("in" in op.filter) q = q.in(op.filter.col, op.filter.in as string[]);
    else q = q.eq(op.filter.col, op.filter.eq);
    const { error, count } = await q;
    if (error) {
      console.log(`  ❌ ${op.table.padEnd(28)} ${error.message}`);
    } else {
      console.log(`  ✅ ${op.table.padEnd(28)} verwijderd (${count ?? "?"} rijen)`);
    }
  }

  console.log("\nKlaar. Test-data is weg.\n");
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
