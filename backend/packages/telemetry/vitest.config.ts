import { defineConfig } from "vitest/config";

/**
 * Every test here is a unit test: nothing connects to a collector, Kafka or a
 * database that works (the one Postgres is an address that refuses). `npm run
 * test:unit` turns coverage on (SPM-116).
 */
export default defineConfig({
  test: {
    // EN-22: CI also writes a JSON report, which the traceability job reads.
    reporters: process.env.CI ? ["default", "json"] : ["default"],
    outputFile: { json: "reports/vitest-unit.json" },
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // The OpenTelemetry API is a process-wide singleton, and each file starts its own SDK.
    pool: "forks",
    coverage: {
      provider: "v8",
      include: ["src/**"],
      reporter: ["text-summary", "html", "json-summary"],
      thresholds: { lines: 95, statements: 95, branches: 85, functions: 95 },
    },
  },
});
