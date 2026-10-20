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
    // EN-11: Temporal's native core (the Rust bridge behind @temporalio/worker and
    // @temporalio/testing) crashes the run with a segfault (exit 139) when it is
    // loaded in vitest's default worker threads. Child processes don't share it.
    // Forks are vitest 2's default; a per-file glob (poolMatchGlobs) for just the
    // Temporal tests did not take effect here on vitest 1.6.
    pool: "forks",
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
        // Everything outside domain/ (mostly api/ and repo/) is held to a floor
        // on the integration run instead (vitest.config.ts, CI's integration
        // job), because only a database run executes it. Measured here, that
        // code counts as uncovered and every new repo file fails the build.
      },
    },
  },
});
