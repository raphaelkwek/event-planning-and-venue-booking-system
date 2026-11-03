import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseChangelog,
  parseTimestamp,
  filterSince,
  sortEntries,
  formatTable,
  formatStandupTable,
  combineChangelog,
  fragmentProblems,
  readCombinedChangelog,
  readFragments,
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

test("formatTable escapes a backslash before a pipe, so the pipe can't split the cell", () => {
  const [entry] = parseChangelog(fixture);
  const table = formatTable([{ ...entry!, title: "a\\|b" }]);
  // The cell holds a, backslash, pipe, b. Escaped: the backslash doubles, then
  // the pipe gets its own backslash, giving a\\\|b, which renders as a\|b in one cell.
  assert.ok(table.includes("| a\\\\\\|b |"), table);
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

// Fragments: changelog/<YYYY-MM-DD>-<slug>.md, one per change ------------------------------------

const fragment = (name: string, title: string, timestamp: string | null, author = "Joash") => ({
  name,
  text: [`# ${title}`, "", ...(timestamp ? [`**Timestamp:** ${timestamp}`] : []), `**Author:** ${author}`, "**Reason:** r.", "", "## Added", "", "- x", ""].join("\n"),
});

test("combineChangelog puts the fragments, newest first, between CHANGELOG.md's header and its own entries", () => {
  const combined = combineChangelog(fixture, [
    fragment("2026-11-03-older.md", "Fragment A", "2026-11-03T09:00+08:00 (SGT)"),
    fragment("2026-11-03-newer.md", "Fragment B", "2026-11-03T21:00+08:00 (SGT)"),
    fragment("2026-11-04-undated.md", "Fragment C", null),
  ]);
  assert.ok(combined.startsWith("# Changelog\n\n> **Convention** — entries are newest-first.\n\n---\n\n# Fragment C"));
  assert.deepEqual(
    parseChangelog(combined).map((e) => e.title),
    ["Fragment C", "Fragment B", "Fragment A", "Newest entry", "Entry with internal rule and Scope field", "Oldest entry"],
  );
  assert.ok(combined.endsWith("**Reason:** Oldest one | still counts.\n"));
  assert.equal(combineChangelog(fixture, []), fixture);
});

test("a fragment may hold a few entries, kept in their order, and sorts by its newest one", () => {
  const two = { name: "2026-11-02-two.md", text: `${fragment("", "Second", "2026-11-05T10:00+08:00 (SGT)").text}\n---\n\n${fragment("", "First", "2026-11-02T10:00+08:00 (SGT)").text}` };
  const titles = parseChangelog(combineChangelog(fixture, [fragment("2026-11-04-x.md", "Other", "2026-11-04T10:00+08:00 (SGT)"), two])).map((e) => e.title);
  assert.deepEqual(titles.slice(0, 3), ["Second", "First", "Other"]);
});

test("readFragments reads only <YYYY-MM-DD>-<slug>.md files, and an absent folder holds none", () => {
  const dir = mkdtempSync(join(tmpdir(), "changelog-"));
  try {
    writeFileSync(join(dir, "2026-11-03-one-file-per-change.md"), "# T\n");
    writeFileSync(join(dir, "README.md"), "# Not an entry\n");
    writeFileSync(join(dir, "notes.txt"), "no");
    assert.deepEqual(readFragments(dir).map((f) => f.name), ["2026-11-03-one-file-per-change.md"]);
    assert.deepEqual(readFragments(join(dir, "missing")), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("fragmentProblems names a fragment with no title, no readable timestamp or no author", () => {
  assert.deepEqual(fragmentProblems(fragment("2026-11-03-ok.md", "Fine", "2026-11-03T21:00+08:00 (SGT)")), []);
  assert.deepEqual(fragmentProblems({ name: "2026-11-03-empty.md", text: "just text\n" }), ['2026-11-03-empty.md: no entry (it must start with a "# Title" line)']);
  assert.deepEqual(fragmentProblems(fragment("2026-11-03-bad.md", "Bad", null, "")), [
    '2026-11-03-bad.md: "Bad" has no readable **Timestamp:**',
    '2026-11-03-bad.md: "Bad" has no **Author:**',
  ]);
});

test("the repository's changelog fragments each parse as entries with a timestamp and an author", () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
  const fragments = readFragments(join(root, "changelog"));
  assert.ok(fragments.length > 0);
  assert.deepEqual(fragments.flatMap(fragmentProblems), []);
  const combined = readCombinedChangelog(root);
  assert.equal(parseChangelog(combined).length, parseChangelog(readFileSync(join(root, "CHANGELOG.md"), "utf8")).length + fragments.flatMap((f) => parseChangelog(`---\n\n${f.text}`)).length);
});

test("npm run changelog prints the combined log, or writes it with --out", async () => {
  const { main } = await import("./changelog.ts");
  const dir = mkdtempSync(join(tmpdir(), "changelog-cli-"));
  const write = process.stdout.write;
  let printed = "";
  try {
    mkdirSync(join(dir, "changelog"));
    writeFileSync(join(dir, "CHANGELOG.md"), fixture);
    writeFileSync(join(dir, "changelog", "2026-11-03-x.md"), fragment("", "Fragment", "2026-11-03T21:00+08:00 (SGT)").text);
    process.stdout.write = ((chunk: string) => ((printed += chunk), true)) as typeof process.stdout.write;
    const log = main([], dir);
    process.stdout.write = write;
    assert.equal(printed, log);
    assert.match(log, /---\n\n# Fragment\n[\s\S]*---\n\n# Newest entry/);
    main(["--out", join(dir, "out.md")], dir);
    assert.equal(readFileSync(join(dir, "out.md"), "utf8"), log);
  } finally {
    process.stdout.write = write;
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a fragment checked out with CRLF line endings still parses", () => {
  const dir = mkdtempSync(join(tmpdir(), "changelog-crlf-"));
  try {
    writeFileSync(join(dir, "2026-11-03-crlf.md"), fragment("", "Windows", "2026-11-03T21:00+08:00 (SGT)").text.replace(/\n/g, "\r\n"));
    const [read] = readFragments(dir);
    assert.deepEqual(fragmentProblems(read!), []);
    assert.equal(parseChangelog(`---\n\n${read!.text}`)[0]!.author, "Joash");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
