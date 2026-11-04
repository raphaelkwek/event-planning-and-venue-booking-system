import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  copyDeliverablePdfs,
  DELIVERABLE_PDFS,
  DESIGN_PARTS,
  FOLDERS,
  normaliseGitUrl,
  placedName,
  placeholderStatus,
  renderCoverageStatement,
  renderManifest,
  type Coverage,
  type CoverageCounts,
  type Part,
} from "./submission-package.ts";

test("a placeholder file counts as finished only once no TODO is left", () => {
  assert.equal(placeholderStatus("| Planning | TODO |"), "placeholder");
  assert.equal(placeholderStatus("| Planning | https://youtu.be/x |"), "present");
});

test("a finished placeholder file loses the PLACEHOLDER mark in its zip name", () => {
  const name = "6. Final Sprint Recordings - PLACEHOLDER.md";
  assert.equal(placedName(name, "present"), "6. Final Sprint Recordings.md");
  assert.equal(placedName(name, "placeholder"), name);
  assert.equal(placedName("README.md", "present"), "README.md");
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

test("folder 2 holds the C4 model, the data-model, domain and state diagrams, the ADRs and the operations screenshots", () => {
  const sources = DESIGN_PARTS.map(([from]) => from);
  assert.deepEqual(sources, ["documentation/c4", "documentation/architecture", "documentation/adr", "documentation/evidence/operations"]);
  const [, folder, part] = DESIGN_PARTS[3];
  assert.equal(folder, "Operations Screenshots");
  assert.equal(part, "Operations screenshots (observability, deployment, access control)");
});

test("the operations evidence PDF goes to folder 2 and the velocity PDF to folder 4", () => {
  const where = Object.fromEntries(DELIVERABLE_PDFS.map((p) => [p.file, p.folder]));
  assert.deepEqual(where, {
    "Operations Evidence - ConnectSphere.pdf": FOLDERS.design,
    "Sprint Velocity and Burndowns - ConnectSphere.pdf": FOLDERS.meetings,
  });
});

test("copyDeliverablePdfs copies a PDF that is there and marks one that is not as missing", () => {
  const root = mkdtempSync(join(tmpdir(), "submission-pdfs-"));
  try {
    const deliverables = join(root, "deliverables");
    const out = join(root, "out");
    mkdirSync(deliverables);
    writeFileSync(join(deliverables, "Operations Evidence - ConnectSphere.pdf"), "%PDF-1.7 ops");

    const design = copyDeliverablePdfs({ out, deliverables }, FOLDERS.design);
    assert.equal(design.length, 1);
    assert.equal(design[0].status, "present");
    assert.equal(design[0].folder, FOLDERS.design);
    assert.equal(readFileSync(join(out, FOLDERS.design, "Operations Evidence - ConnectSphere.pdf"), "utf8"), "%PDF-1.7 ops");

    const meetings = copyDeliverablePdfs({ out, deliverables }, FOLDERS.meetings);
    assert.equal(meetings.length, 1);
    assert.equal(meetings[0].status, "missing");
    assert.match(meetings[0].detail, /Sprint Velocity and Burndowns - ConnectSphere\.pdf/);
    assert.equal(existsSync(join(out, FOLDERS.meetings, "Sprint Velocity and Burndowns - ConnectSphere.pdf")), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("copyDeliverablePdfs marks every PDF missing when no --deliverables folder is given", () => {
  const out = mkdtempSync(join(tmpdir(), "submission-pdfs-"));
  try {
    const parts = [FOLDERS.design, FOLDERS.meetings].flatMap((folder) => copyDeliverablePdfs({ out, deliverables: null }, folder));
    assert.deepEqual(parts.map((p) => p.status), ["missing", "missing"]);
    assert.match(parts[0].detail, /--deliverables/);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});
