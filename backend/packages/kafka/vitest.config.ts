import { defineConfig } from "vitest/config";

/**
 * Every test here is a unit test: nothing connects to Kafka. `npm run
 * test:unit` turns coverage on (SPM-116), and this code handles credentials,
 * so it is held to the same 100% as domain code.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**"],
      reporter: ["text-summary", "html", "json-summary"],
      thresholds: { lines: 100, statements: 100, branches: 100, functions: 100 },
    },
  },
});
