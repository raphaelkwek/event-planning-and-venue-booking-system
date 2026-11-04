import { defineConfig } from "vitest/config";

/** The harness's own unit tests (EN-18, EN-20): pure functions and manifests, no database, no Docker. Run from the repository root. */
export default defineConfig({
  test: {
    // EN-22: CI also writes a JSON report, which the traceability job reads. The path is from the
    // repository root, where this config runs.
    reporters: process.env.CI ? ["default", "json"] : ["default"],
    outputFile: { json: "load/reports/vitest-unit.json" },
    environment: "node",
    include: ["load/tests/**/*.unit.test.ts"],
  },
});
