import { defineConfig } from "vitest/config";

/**
 * The tests Stryker runs against mutated domain code (EN-06.2): the domain unit
 * tests only. They are what the pure rules are tested by, and they need nothing
 * outside this workspace, which matters because Stryker runs them in a copy of it.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/domain/**/*.test.ts"],
  },
});
