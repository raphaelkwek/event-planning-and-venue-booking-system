import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseChangelog,
  parseTimestamp,
  filterSince,
  sortEntries,
  formatTable,
  formatStandupTable,
} from "./confluence-digest.ts";

const fixture = `# Changelog

> **Convention** — entries are newest-first.

---

# Newest entry

**Timestamp:** 2026-09-16T16:23+08:00 (SGT)
**Author:** Chai, via Claude
**Reason:** Because reasons.

## Added

- did a thing

---

# Entry with internal rule and Scope field

**Timestamp:** 2026-09-15T18:55:56+08:00 (SGT)
**Author:** Seann, via Claude
**Scope:** A1, A3. Design spec in
\`docs/some-design.md\`, wrapped onto a second line.

## Section A

content

---

## Net effect

more content that should NOT start a new entry

---

# Oldest entry

**Timestamp:** 2026-09-10T00:00:00Z
**Author:** Someone
**Reason:** Oldest one | still counts.
`;

test("parseChangelog splits only on --- lines followed by an H1, ignoring internal ---", () => {
  const entries = parseChangelog(fixture);
  assert.equal(entries.length, 3);
  assert.deepEqual(
    entries.map((e) => e.title),
    ["Newest entry", "Entry with internal rule and Scope field", "Oldest entry"],
  );
});

test("uses Reason when present, falls back to Scope", () => {
  const entries = parseChangelog(fixture);
  assert.equal(entries[0].notes, "Because reasons.");
  assert.equal(
    entries[1].notes,
    "A1, A3. Design spec in `docs/some-design.md`, wrapped onto a second line.",
  );
});

test("joins a field's wrapped continuation line instead of truncating it", () => {
  const entries = parseChangelog(fixture);
  assert.ok(!entries[1].notes.endsWith("in"), "notes should not cut off mid-sentence");
});

test("parseTimestamp strips a trailing zone label and parses the ISO offset", () => {
  const ms = parseTimestamp("2026-09-16T16:23+08:00 (SGT)");
  assert.ok(ms !== null);
  assert.equal(new Date(ms as number).toISOString(), "2026-09-16T08:23:00.000Z");
});

test("parseTimestamp returns null for unparseable input", () => {
  assert.equal(parseTimestamp("not a date"), null);
});

test("filterSince keeps only entries at or after the cutoff", () => {
  const entries = parseChangelog(fixture);
  const cutoff = parseTimestamp("2026-09-11T00:00:00Z") as number;
  const filtered = filterSince(entries, cutoff);
  assert.deepEqual(
    filtered.map((e) => e.title),
    ["Newest entry", "Entry with internal rule and Scope field"],
  );
});

test("filterSince returns everything when cutoff is null", () => {
  const entries = parseChangelog(fixture);
  assert.equal(filterSince(entries, null).length, entries.length);
});

test("sortEntries defaults to chronological (asc) order", () => {
  const entries = parseChangelog(fixture);
  const sorted = sortEntries(entries, "asc");
  assert.deepEqual(
    sorted.map((e) => e.title),
    ["Oldest entry", "Entry with internal rule and Scope field", "Newest entry"],
  );
});

test("sortEntries supports desc order", () => {
  const entries = parseChangelog(fixture);
  const sorted = sortEntries(entries, "desc");
  assert.deepEqual(
    sorted.map((e) => e.title),
    ["Newest entry", "Entry with internal rule and Scope field", "Oldest entry"],
  );
});

test("formatTable renders a pasteable markdown table and escapes pipes", () => {
  const entries = parseChangelog(fixture);
  const table = formatTable(entries);
  assert.match(table, /\| Date \| Author \| Item \| Notes \|/);
  assert.match(
    table,
    /\| 2026-09-16T16:23\+08:00 \(SGT\) \| Chai, via Claude \| Newest entry \| Because reasons\. \|/,
  );
  assert.match(table, /Oldest one \\\| still counts\./);
});

const standupFixture = `# Changelog

---

# Entry with a known gap and follow-ups

**Timestamp:** 2026-09-16T16:23+08:00 (SGT)
**Author:** Chai, via Claude
**Reason:** Because reasons.

## Known gap, raised rather than silently built around

- the nominee case is not enforced
- second blocker

## Follow-ups

1. some numbered item is not a bullet, so it is not collected
- write the missing Playwright test

---

# Entry with neither section

**Timestamp:** 2026-09-10T00:00:00Z
**Author:** Seann, via Claude
**Reason:** Nothing to report.

## Added

- did a thing
`;

test("extractBullets collects bullets under a heading matched by prefix, stopping at the next heading", () => {
  const entries = parseChangelog(standupFixture);
  assert.deepEqual(entries[0].blockers, ["the nominee case is not enforced", "second blocker"]);
  assert.deepEqual(entries[0].followUps, ["write the missing Playwright test"]);
});

test("entries with no Known gap / Follow-up section parse to empty arrays", () => {
  const entries = parseChangelog(standupFixture);
  assert.deepEqual(entries[1].blockers, []);
  assert.deepEqual(entries[1].followUps, []);
});

test("formatStandupTable aliases known short names, and falls back to the name before the comma", () => {
  const entries = parseChangelog(standupFixture);
  const table = formatStandupTable(entries);
  assert.match(table, /\| Timestamp \| Name \| Completed \| Blockers \| To-do \|/);
  assert.match(
    table,
    /\| 2026-09-16T16:23\+08:00 \(SGT\) \| Yichen \| Entry with a known gap and follow-ups \| the nominee case is not enforced; second blocker \| write the missing Playwright test \|/,
  );
  assert.match(table, /\| Seann \| Entry with neither section \| None recorded \| None recorded \|/);
});
