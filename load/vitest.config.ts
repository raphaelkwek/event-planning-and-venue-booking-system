import { defineConfig } from "vitest/config";

/** The harness's own unit tests (EN-18, EN-20): pure functions and manifests, no database, no Docker. Run from the repository root. */
export default defineConfig({
  test: {
    environment: "node",
    include: ["load/tests/**/*.unit.test.ts"],
  },
});
