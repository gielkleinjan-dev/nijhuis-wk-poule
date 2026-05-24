import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
  test: {
    // Standaard alleen unit-tests. Integratie- en e2e-tests draaien apart
    // (npm run test:integration / test:e2e) zodat 'npm test' nooit per ongeluk
    // tegen productie-DB hamert.
    exclude: ["**/node_modules/**", "tests/integration/**", "tests/e2e/**"],
  },
});
