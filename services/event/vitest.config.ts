import { defineConfig } from "vitest/config";
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

loadEnv({ path: resolve(__dirname, "../../.env") });

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // These suites share one database, including the single assignment-cursor
    // row that E1 locks. Running files in parallel makes them contend for it.
    fileParallelism: false,
    testTimeout: 20000,
  },
});
