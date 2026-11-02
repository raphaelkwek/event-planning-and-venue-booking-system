import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * EN-23-T1 to T5. The security documents make claims a reviewer will rely on, so this checks the
 * parts a script can check: every C4 container has a complete STRIDE table, every `file:line`
 * reference points at a line that exists, the PDPA note covers each obligation, the ASVS rows use
 * only the four statuses and back every "Met", and the ranked gap list is present.
 * It cannot tell whether a cited line still says what the document says: a reviewer does that.
 */

const REPO = fileURLToPath(new URL("../../", import.meta.url));
const read = (path: string) => readFileSync(join(REPO, path), "utf8");

const THREAT_MODEL = read("documentation/security/threat-model.md");
const PDPA = read("documentation/security/pdpa.md");
const ASVS = read("documentation/security/asvs-l2.md");

const CITATION = /`([\w./-]+\.(?:ts|tsx|sql|yml|yaml|md|json|dsl|mjs)):(\d+)`/g;
const HAS_CITATION = /`[\w./-]+\.(?:ts|tsx|sql|yml|yaml|md|json|dsl|mjs):\d+`/;
const STRIDE = ["Spoofing", "Tampering", "Repudiation", "Information disclosure", "Denial of service", "Elevation of privilege"];

const cells = (row: string) => row.split("|").slice(1, -1).map((cell) => cell.trim());
const isDataRow = (line: string) => line.startsWith("|") && !/^\|[\s:-]+\|/.test(line) && !/^\| (STRIDE|ID|Rank) /.test(line);
const rowsOf = (section: string) => section.split("\n").filter(isDataRow).map(cells);

function sections(text: string, level: "##" | "###"): { heading: string; body: string }[] {
  const pattern = new RegExp(`^${level} (.+)$`, "gm");
  const found = [...text.matchAll(pattern)];
  return found.map((match, i) => ({
    heading: match[1]!,
    body: text.slice(match.index! + match[0].length, found[i + 1]?.index ?? text.length),
  }));
}

function containers(): { id: string; name: string }[] {
  const dsl = read("documentation/c4/connectsphere.dsl");
  return [...dsl.matchAll(/^\s*(\w+) = container "([^"]+)"/gm)].map((m) => ({ id: m[1]!, name: m[2]! }));
}

test("EN-23-T1 every C4 container has a STRIDE section with six complete rows", () => {
  const list = containers();
  assert.ok(list.length >= 13, `expected the 13 C4 containers, found ${list.length}`);
  const all = sections(THREAT_MODEL, "##");
  for (const { id, name } of list) {
    const section = all.find((s) => s.heading.endsWith(`(${id})`));
    assert.ok(section, `${name}: no section headed "(${id})"`);
    const rows = rowsOf(section.body);
    for (const category of STRIDE) {
      assert.ok(rows.some((r) => r[0] === category), `${name}: no ${category} row`);
    }
    for (const row of rows) {
      assert.equal(row.length, 5, `${name}: a ${row[0]} row has ${row.length} cells, not 5`);
      row.forEach((cell, i) => assert.ok(cell.length > 0, `${name}: ${row[0]} row has an empty cell ${i}`));
      const [, , control, , gap] = row;
      if (control!.startsWith("None")) {
        assert.ok(!/^(None\.?|-|—|n\/a)$/i.test(gap!), `${name}: ${row[0]} has no control, so the last column must say what to do`);
      } else {
        assert.ok(HAS_CITATION.test(control!), `${name}: ${row[0]} claims a control without a file:line reference`);
      }
    }
  }
});

test("EN-23-T2 every file:line reference in the security documents points at a real line", () => {
  let checked = 0;
  for (const [file, text] of [["threat-model.md", THREAT_MODEL], ["pdpa.md", PDPA], ["asvs-l2.md", ASVS]] as const) {
    for (const match of text.matchAll(CITATION)) {
      const [, path, line] = match;
      assert.ok(existsSync(join(REPO, path!)), `${file}: ${path} does not exist`);
      const length = read(path!).split("\n").length;
      assert.ok(Number(line) >= 1 && Number(line) <= length, `${file}: ${path}:${line} is past the end of the file (${length} lines)`);
      checked += 1;
    }
  }
  assert.ok(checked >= 100, `expected at least 100 references, found ${checked}`);
});

test("EN-23-T3 the PDPA note covers every obligation with what the system does and what is missing", () => {
  const required = [
    "Consent", "Purpose limitation", "Notification", "Access", "Correction", "Accuracy",
    "Protection", "Retention limitation", "Transfer limitation", "Data breach notification", "Accountability",
  ];
  const found = sections(PDPA, "###");
  for (const obligation of required) {
    const section = found.find((s) => s.heading === obligation);
    assert.ok(section, `pdpa.md: no section for ${obligation}`);
    assert.ok(section.body.includes("**What the system does.**"), `${obligation}: no statement of what the system does`);
    assert.ok(section.body.includes("**Missing.**"), `${obligation}: no statement of what is missing`);
  }
  assert.ok(HAS_CITATION.test(PDPA), "pdpa.md cites no code");
});

test("EN-23-T4 the ASVS checklist covers V1 to V14, uses four statuses, and backs every Met", () => {
  const chapters = sections(ASVS, "##").filter((s) => /^V\d+ /.test(s.heading));
  const numbers = chapters.map((c) => Number(/^V(\d+) /.exec(c.heading)![1]));
  assert.deepEqual(numbers, Array.from({ length: 14 }, (_, i) => i + 1));
  const tally: Record<string, number> = { Met: 0, Partly: 0, "Not met": 0, "N/A": 0 };
  for (const chapter of chapters) {
    const rows = rowsOf(chapter.body);
    assert.ok(rows.length >= 3, `${chapter.heading}: fewer than 3 rows`);
    for (const row of rows) {
      assert.equal(row.length, 5, `${chapter.heading}: row ${row[0]} has ${row.length} cells`);
      const [id, , status, evidence] = row;
      assert.ok(status! in tally, `${chapter.heading}: ${id} has status "${status}"`);
      tally[status!]! += 1;
      if (status === "Met") assert.ok(HAS_CITATION.test(evidence!), `${id} is Met without file:line evidence`);
    }
  }
  console.log(`ASVS tally: ${JSON.stringify(tally)}`);
});

test("EN-23-T5 the ranked gap list has at least ten gaps, in order, each with a location", () => {
  const section = sections(THREAT_MODEL, "##").find((s) => s.heading === "Top gaps, ranked");
  assert.ok(section, "threat-model.md: no 'Top gaps, ranked' section");
  const rows = rowsOf(section.body);
  assert.ok(rows.length >= 10, `expected at least 10 gaps, found ${rows.length}`);
  rows.forEach((row, i) => {
    assert.equal(row.length, 5);
    assert.equal(row[0], `G${i + 1}`, `gap ${i + 1} is out of order`);
    assert.ok(["Critical", "High", "Medium", "Low"].some((s) => row[2]!.startsWith(s)), `${row[0]}: no severity`);
    assert.ok(HAS_CITATION.test(row[3]!), `${row[0]}: no file:line`);
  });
});
