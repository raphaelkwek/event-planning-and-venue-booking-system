import { defineConfig } from "vitest/config";

/**
 * Unit tests only: pure rules and anything that touches no database. CI runs
 * these on every pull request (SPM-114). Integration tests need a database and
 * run locally against Supabase until EN-06.1 gives CI a throwaway Postgres.
 *
 * A test is a unit test when it lives under a domain/ or boundaries/ folder,
 * or is named *.unit.test.ts.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/domain/**/*.test.ts", "tests/boundaries/**/*.test.ts", "tests/**/*.unit.test.ts"],
    // SPM-116. `npm run test:unit` turns coverage on; CI fails below these.
    coverage: {
      provider: "v8",
      include: ["src/**"],
      reporter: ["text-summary", "html", "json-summary"],
      thresholds: {
        // implementation.md §8.1: every line and branch of the pure rules is
        // tested. If one genuinely can't be, say why in the test file instead
        // of lowering this.
        "src/**/domain/**": { lines: 100, branches: 100, functions: 100, statements: 100 },
        // Everything outside domain/ (Vitest leaves the files matched above out
        // of these): mostly api/ and repo/, which the integration tests cover
        // against a database. CI can't run those until EN-06.1, so this floor
        // sits just under today's unit-only figures and should only ever go up.
        lines: 39,
        statements: 39,
        branches: 93,
        functions: 24,
      },
    },
  },
});
