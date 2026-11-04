import assert from "node:assert/strict";
import { test } from "node:test";
import { normaliseGitUrl, placeholderStatus, renderCoverageStatement, renderManifest, type CoverageCounts, type Part } from "./submission-package.ts";

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
});
