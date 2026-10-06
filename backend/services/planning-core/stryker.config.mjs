// Mutation testing for the pure rules (EN-06.2, SPM-167, implementation.md §8.1).
// Stryker plants small bugs in src/**/domain/**, such as `>` becoming `>=`, and
// checks that some unit test fails for each. The score is the share of planted
// bugs the tests caught; below 80 the run fails.
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  testRunner: "vitest",
  vitest: { configFile: "vitest.mutation.config.ts" },
  mutate: ["src/**/domain/**/*.ts"],
  coverageAnalysis: "perTest",
  thresholds: { high: 90, low: 80, break: 80 },
  reporters: ["clear-text", "progress", "html", "json"],
  htmlReporter: { fileName: "reports/mutation/index.html" },
  jsonReporter: { fileName: "reports/mutation/mutation.json" },
  tempDirName: ".stryker-tmp",
  cleanTempDir: "always",
};
