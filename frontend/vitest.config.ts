import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  define: {
    __SUPABASE_URL__: JSON.stringify("http://supabase.test"),
    __SUPABASE_ANON_KEY__: JSON.stringify("test-anon-key"),
    __API_BASE_URL__: JSON.stringify(""),
  },
  test: {
    // EN-22: CI also writes a JSON report, which the traceability job reads.
    reporters: process.env.CI ? ["default", "json"] : ["default"],
    outputFile: { json: "reports/vitest-unit.json" },
    environment: "jsdom",
    include: ["tests/**/*.test.{ts,tsx}"],
    setupFiles: ["tests/setup.ts"],
    // SPM-116. `npm run test:unit` turns coverage on; CI fails below these.
    // The floor sits just under today's figures and should only ever go up.
    coverage: {
      provider: "v8",
      include: ["src/**"],
      reporter: ["text-summary", "html", "json-summary"],
      thresholds: { lines: 60, statements: 60, branches: 70, functions: 40 },
    },
  },
});
