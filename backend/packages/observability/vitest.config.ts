import { defineConfig } from "vitest/config";

/** Every test here is a unit test: nothing opens a socket but supertest's loopback. */
export default defineConfig({
  test: {
    // EN-22: CI also writes a JSON report, which the traceability job reads.
    reporters: process.env.CI ? ["default", "json"] : ["default"],
    outputFile: { json: "reports/vitest-unit.json" },
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**"],
      exclude: ["src/index.ts"],
      reporter: ["text-summary", "html", "json-summary"],
      thresholds: { lines: 100, statements: 100, branches: 100, functions: 100 },
    },
  },
});
