import assert from "node:assert/strict";
import { test } from "node:test";
import { DESIGN_PARTS, normaliseGitUrl, placeholderStatus, renderCoverageStatement, renderManifest, type Coverage, type CoverageCounts, type Part } from "./submission-package.ts";

test("a placeholder file counts as finished only once no TODO is left", () => {
  assert.equal(placeholderStatus("| Planning | TODO |"), "placeholder");
  assert.equal(placeholderStatus("| Planning | https://youtu.be/x |"), "present");
});

test("normaliseGitUrl turns ssh and .git remotes into the browsable URL", () => {
  assert.equal(normaliseGitUrl("git@github.com:a/b.git\n"), "https://github.com/a/b");
  assert.equal(normaliseGitUrl("https://github.com/a/b.git"), "https://github.com/a/b");
});

test("renderManifest ticks each part by status and totals them", () => {
  const parts: Part[] = [
    { folder: "1. Product Backlog", part: "Export", status: "present", detail: "a" },
    { folder: "4. Sprint Meetings", part: "Recordings", status: "placeholder", detail: "b" },
    { folder: "5. Slide Deck", part: "Deck", status: "missing", detail: "c|d" },
  ];
  const md = renderManifest(parts, { "1. Product Backlog": 2 }, "HEAD");
  assert.match(md, /1 present, 1 placeholder, 1 missing/);
  assert.match(md, /\[x\] present \| Export/);
  assert.match(md, /\[~\] PLACEHOLDER \| Recordings/);
  assert.match(md, /\[ \] MISSING \| Deck \| c\/d/);
  assert.match(md, /Files in the zip: 2/);
});

test("renderCoverageStatement quotes only the counts it is given", () => {
  const c: CoverageCounts = {
    repository: { url: "u", commit: "0123456789abcdef", commit_date: "2026-11-04" },
    e2e_cards: { total: 10, per_status: { Pass: 8, "Not Executed": 2 } },
    unit_tests: { total: 1875, files: 186, per_status: { Passed: 1856 }, cases_run: 2469 },
    integration_tests: { total: 1151, files: 105, per_status: { Passed: 1151 }, cases_run: 1215 },
    playwright_browser_tests: { test_calls_in_specs: 86, spec_files: 9 },
    integration_status_source: { url: "https://ci/run/1", headSha: "fedcba9876", date: "2026-11-03" },
  };
  const md = renderCoverageStatement(c);
  assert.match(md, /1,875 tests in 186 files/);
  assert.match(md, /https:\/\/ci\/run\/1/);
  assert.match(md, /8 Pass, 2 Not Executed/);
  assert.match(md, /01234567/);
  assert.doesNotMatch(md, /\d+\.\d+%/, "no percentage without a coverage source");
});

test("renderCoverageStatement adds each workspace's coverage when a CI coverage file is given", () => {
  const c: CoverageCounts = {
    repository: { url: "u", commit: "0123456789abcdef", commit_date: "2026-11-04" },
    e2e_cards: { total: 1, per_status: { Pass: 1 } },
    unit_tests: { total: 1, files: 1, per_status: { Passed: 1 }, cases_run: 1 },
    integration_tests: { total: 1, files: 1, per_status: { Passed: 1 }, cases_run: 1 },
    playwright_browser_tests: { test_calls_in_specs: 1, spec_files: 1 },
    integration_status_source: { url: "https://ci/run/1", headSha: "fedcba9876", date: "2026-11-03" },
  };
  const coverage: Coverage = {
    commit: "abcdef0123456789",
    run_url: "https://ci/run/2",
    workspaces: [
      { name: "planning-core", suite: "unit and integration", statements: "96.18%", branches: "92.11%" },
      { name: "registration", suite: "unit", statements: "98.23%", branches: "97.44%" },
    ],
  };
  const md = renderCoverageStatement(c, coverage);
  assert.match(md, /\| planning-core \| unit and integration \| 96\.18% \| 92\.11% \|/);
  assert.match(md, /\| registration \| unit \| 98\.23% \| 97\.44% \|/);
  assert.match(md, /https:\/\/ci\/run\/2/);
  assert.match(md, /abcdef01/);
});

test("folder 2 holds the C4 model, the data-model, domain and state diagrams, and the ADRs", () => {
  const sources = DESIGN_PARTS.map(([from]) => from);
  assert.deepEqual(sources, ["documentation/c4", "documentation/architecture", "documentation/adr"]);
});
