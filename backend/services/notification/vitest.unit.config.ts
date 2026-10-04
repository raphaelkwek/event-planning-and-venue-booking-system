import { defineConfig } from "vitest/config";

/**
 * Unit tests only: anything that touches no database or broker. CI runs these
 * on every pull request (SPM-114). A test is a unit test when it lives under a
 * domain/ folder or is named *.unit.test.ts (implementation.md §8.1).
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/domain/**/*.test.ts", "tests/**/*.unit.test.ts"],
    // SPM-116. `npm run test:unit` turns coverage on; CI fails below these.
    coverage: {
      provider: "v8",
      include: ["src/**"],
      reporter: ["text-summary", "html", "json-summary"],
      thresholds: {
        // The recipient rules and the retry policy are pure: every line and branch is tested.
        "src/**/domain/**": { lines: 100, branches: 100, functions: 100, statements: 100 },
        // Elsewhere the inbox and the consumer are covered by integration tests
        // against a database, which CI runs from EN-06.1. Only ever raise these.
        lines: 30,
        statements: 30,
        branches: 80,
        functions: 30,
      },
    },
  },
});
