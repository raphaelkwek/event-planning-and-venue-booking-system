import { defineConfig } from "vitest/config";
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

loadEnv({ path: resolve(__dirname, "../../../.env") });

export default defineConfig({
  test: {
    // EN-22: CI also writes a JSON report, which the traceability job reads.
    reporters: process.env.CI ? ["default", "json"] : ["default"],
    outputFile: { json: "reports/vitest-integration.json" },
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // The integration tests share the registration schema on one database.
    fileParallelism: false,
    testTimeout: 20000,
  },
});
