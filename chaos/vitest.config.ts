import { defineConfig } from "vitest/config";

/**
 * EN-20: the chaos experiments that run in CI. They need the `Load and chaos` workflow's containers
 * (Toxiproxy, Redpanda) and its throwaway Postgres, so they are not part of `npm test`.
 * Run from the repository root: `npx vitest run --config chaos/vitest.config.ts`.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["chaos/experiments/**/*.test.ts"],
    // The experiments share one database, one broker and one Toxiproxy.
    fileParallelism: false,
    sequence: { concurrent: false },
    testTimeout: 300_000,
    hookTimeout: 120_000,
    reporters: ["default", "json"],
    outputFile: { json: "chaos/out/results.json" },
  },
});
