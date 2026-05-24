// Setup voor integratie-tests: laadt .env.local zodat Supabase-credentials
// beschikbaar zijn in process.env tijdens de test-run.

import { config } from "dotenv";
import { existsSync } from "node:fs";

for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) {
    config({ path: file });
    break;
  }
}

// Hard-fail vroeg als de vereiste env-vars ontbreken — voorkomt dat tests
// stilletjes tegen niets-of-iets-anders draaien.
const required = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
for (const key of required) {
  if (!process.env[key]) {
    throw new Error(
      `Integratie-tests vereisen ${key} in .env.local (of .env). ` +
        `Run met de service-role-key, NIET met een gebruikerskey.`,
    );
  }
}
