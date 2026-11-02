import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ALLOWED_STATUSES, normaliseCard, normaliseCards, summariseByStory } from "./normalise-card-status.ts";

const card = (status: string, remarks = "Commit: abc1234 · Evidence: a.test.ts › T1 · Defect: —"): string =>
  [
    "# X1-T1 — A scenario",
    "",
    "## Specification",
    "",
    "| Item | Content |",
    "|---|---|",
    "| Status | Not Executed |",
    "| Remarks | Spec rows with these names are left alone |",
    "",
    "## Execution record",
    "",
    "| Item | Content |",
    "|---|---|",
    "| Actual Result | What the test asserted. |",
    `| Status | ${status} |`,
    `| Remarks | ${remarks} |`,
    "| Executed By | Raphael, via automated testing (CI) |",
    "| Date of Execution | 2026-10-21 |",
    "",
  ].join("\n");

test("sets Status to Pass and moves the qualifier to the front of Remarks", () => {
  const result = normaliseCard(card("Pass (automated, API level)"));
  assert.equal(result.qualifier, "Automated (API level)");
  assert.equal(
    result.text,
    card("Pass", "Automated (API level) · Commit: abc1234 · Evidence: a.test.ts › T1 · Defect: —"),
  );
});

test("carries the workflow-level and database-level qualifiers the same way", () => {
  assert.equal(normaliseCard(card("Pass (automated, workflow level)")).qualifier, "Automated (workflow level)");
  const db = normaliseCard(card("Pass (automated, database level)", "Commit: 870e3e7"));
  assert.match(db.text, /^\| Status \| Pass \|$/m);
  assert.match(db.text, /^\| Remarks \| Automated \(database level\) · Commit: 870e3e7 \|$/m);
});

test("changes nothing but the Status and Remarks rows of the Execution record", () => {
  const before = card("Pass (automated, API level)").split("\n");
  const after = normaliseCard(card("Pass (automated, API level)")).text.split("\n");
  assert.equal(after.length, before.length);
  const differing = before.flatMap((line, i) => (line === after[i] ? [] : [i]));
  assert.deepEqual(differing.map((i) => before[i].split(" |")[0]), ["| Status", "| Remarks"]);
  // the specification table's own Status and Remarks rows are not touched
  assert.ok(after.includes("| Status | Not Executed |"));
  assert.ok(after.includes("| Remarks | Spec rows with these names are left alone |"));
});

test("leaves each of the four allowed statuses alone", () => {
  for (const status of ALLOWED_STATUSES) {
    const text = card(status);
    const result = normaliseCard(text);
    assert.equal(result.text, text);
    assert.equal(result.qualifier, null);
    assert.equal(result.unreadable, null);
  }
});

test("a second run changes nothing", () => {
  const once = normaliseCard(card("Pass (automated, API level)")).text;
  assert.deepEqual(normaliseCard(once), { text: once, qualifier: null, unreadable: null });
});

test("does not repeat a prefix Remarks already has", () => {
  const remarks = "Automated (API level) · Commit: abc1234";
  const result = normaliseCard(card("Pass (automated, API level)", remarks));
  assert.equal(result.text, card("Pass", remarks));
});

test("reports a Status it cannot read and leaves the card as it was", () => {
  const text = card("Passed, mostly");
  assert.deepEqual(normaliseCard(text), { text, qualifier: null, unreadable: "Passed, mostly" });
  const failing = card("Fail (automated, API level)");
  assert.equal(normaliseCard(failing).unreadable, "Fail (automated, API level)");
  assert.equal(normaliseCard(failing).text, failing);
});

test("keeps CRLF line endings, and LF, as it finds them", () => {
  const crlf = card("Pass (automated, API level)").replace(/\n/g, "\r\n");
  const result = normaliseCard(crlf);
  assert.equal(result.text, normaliseCard(card("Pass (automated, API level)")).text.replace(/\n/g, "\r\n"));
  assert.ok(!/(?<!\r)\n/.test(result.text), "no bare LF was introduced");
  assert.ok(!normaliseCard(card("Pass (automated, API level)")).text.includes("\r"), "no CR was introduced");
});

test("keeps mixed line endings line for line", () => {
  const lines = card("Pass (automated, API level)").split("\n");
  const mixed = lines.map((line, i) => line + (i === lines.length - 1 ? "" : i % 2 ? "\r\n" : "\n")).join("");
  const result = normaliseCard(mixed);
  const endings = (s: string): string[] => s.match(/\r?\n/g) ?? [];
  assert.deepEqual(endings(result.text), endings(mixed));
});

test("a card with no Execution record is left alone", () => {
  const text = "# README\n\n| Status | Pass (automated, API level) |\n";
  assert.deepEqual(normaliseCard(text), { text, qualifier: null, unreadable: null });
});

test("normaliseCards walks tests/<STORY>/*.md, writes changed cards, and skips other files", () => {
  const root = mkdtempSync(join(tmpdir(), "cards-"));
  try {
    mkdirSync(join(root, "X1"));
    writeFileSync(join(root, "X1", "X1-T1-first.md"), card("Pass (automated, API level)"));
    writeFileSync(join(root, "X1", "X1-T2-second.md"), card("Pass"));
    writeFileSync(join(root, "X1", "README.md"), "| Status | Pass (automated, API level) |\n");

    const dry = normaliseCards(root, false);
    assert.equal(dry.length, 1);
    assert.match(readFileSync(join(root, "X1", "X1-T1-first.md"), "utf8"), /Pass \(automated, API level\)/);

    const written = normaliseCards(root, true);
    assert.deepEqual(summariseByStory(written), ["X1 (1): X1-T1"]);
    assert.match(readFileSync(join(root, "X1", "X1-T1-first.md"), "utf8"), /^\| Status \| Pass \|$/m);
    assert.equal(readFileSync(join(root, "X1", "README.md"), "utf8"), "| Status | Pass (automated, API level) |\n");
    assert.equal(normaliseCards(root, true).length, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("every card in the repository has one of the four statuses", () => {
  const unreadable = normaliseCards("tests", false);
  assert.deepEqual(
    unreadable.map((r) => r.file),
    [],
    "run `tsx documentation/scripts/normalise-card-status.ts` to fix these cards",
  );
});
