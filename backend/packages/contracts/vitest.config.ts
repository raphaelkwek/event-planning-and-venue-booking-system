import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // SPM-116. `npm run test:unit` turns coverage on; CI fails below these.
    // Most of contracts is schema declarations its own tests don't import;
    // planning-core's tests exercise them. The floor sits just under today's
    // figure and should only ever go up.
    coverage: {
      provider: "v8",
      include: ["src/**"],
      reporter: ["text-summary", "html", "json-summary"],
      thresholds: { lines: 15, statements: 15, branches: 10, functions: 0 },
    },
  },
});
