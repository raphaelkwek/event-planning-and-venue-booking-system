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
  },
});
