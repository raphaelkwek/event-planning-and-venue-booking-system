import { defineConfig } from "vitest/config";
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

loadEnv({ path: resolve(__dirname, "../../../.env") });

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // These suites share one database, including the single assignment-cursor
    // row that E1 locks. Running files in parallel makes them contend for it.
    fileParallelism: false,
    testTimeout: 20000,
    // SPM-116, moved here from vitest.unit.config.ts on 2026-10-07. Applies
    // when coverage is on (`npm run test:coverage`, CI's integration job), the
    // one run that executes repo/ and api/ against a database. Domain code is
    // still held at 100% by the unit run.
    coverage: {
      provider: "v8",
      include: ["src/**"],
      reporter: ["text-summary", "json-summary"],
      thresholds: {
        // Just under CI's first measurement of main (2026-10-07, all 493 tests
        // on the throwaway Postgres: lines and statements 94.59%, branches
        // 89.68%, functions 95.03%). Only ever raise these.
        lines: 94,
        statements: 94,
        branches: 89,
        functions: 94,
      },
    },
  },
});
