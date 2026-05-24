import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Vitest-config voor de integratie-tests. Draait alleen tests/integration/**
 * en laadt .env.local zodat SUPABASE_SERVICE_ROLE_KEY beschikbaar is.
 *
 * Run met: npm run test:integration
 *
 * NB: deze tests schrijven écht in je Supabase-DB (markeer met
 * department='__SCORING_TEST__' voor cleanup). Niet draaien als de poule
 * gesloten en live is — alleen tijdens dev/preview.
 */
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
  test: {
    include: ["tests/integration/**/*.spec.ts"],
    // Integratie-tests doen netwerk-calls dus laat ze ruim de tijd
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Sequentiele runs voorkomen race-condities op de gedeelde test-user-id.
    fileParallelism: false,
    setupFiles: ["./tests/integration/setup.ts"],
  },
});
