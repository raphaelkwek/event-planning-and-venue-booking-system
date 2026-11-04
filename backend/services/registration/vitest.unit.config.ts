import { defineConfig } from "vitest/config";

/**
 * Unit tests only: anything that touches no database or broker. CI runs these
 * on every pull request (SPM-114). A test is a unit test when it lives under a
 * domain/ folder or is named *.unit.test.ts (implementation.md §8.1).
 */
export default defineConfig({
  test: {
    // EN-22: CI also writes a JSON report, which the traceability job reads.
    reporters: process.env.CI ? ["default", "json"] : ["default"],
    outputFile: { json: "reports/vitest-unit.json" },
    environment: "node",
    include: ["tests/**/domain/**/*.test.ts", "tests/**/*.unit.test.ts"],
    // SPM-116. `npm run test:unit` turns coverage on; CI fails below these.
    coverage: {
      provider: "v8",
      include: ["src/**"],
      reporter: ["text-summary", "html", "json-summary"],
      thresholds: {
        // The seat rules are pure: every line and branch is tested.
        "src/**/domain/**": { lines: 100, branches: 100, functions: 100, statements: 100 },
        // Elsewhere the seat SQL, the consumer's transaction and the Kafka wiring are tested here with a
        // scripted database client (tests/support/scriptedSql.ts); the integration tests still prove them
        // against Postgres in CI. These floors sit just under today's unit-only figures for the files outside
        // domain/ (97.95% lines and statements, 96.83% branches, 96.22% functions; the whole service is 98.23%
        // statements, up from 71.28%) and should only ever go up.
        lines: 97,
        statements: 97,
        branches: 96,
        functions: 96,
      },
    },
  },
});
