import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SUPERSEDED_MARKER,
  cardHeading,
  checkRepository,
  checkTraceability,
  extractTitles,
  hasTest,
  parseCsvRows,
} from "./check-traceability.ts";

const HEADER = "story_id,acceptance_criterion,test_file,test_name\n";

const source = `
describe("POST /things (X1)", () => {
  it("makes a thing", () => {});
  it('says "no" to a bad thing', () => {});
  test(\`keeps a back\\\`tick\`, () => {});
  it.each([A, B])(
    "shows the history: %s",
    () => {},
  );
  it.skip("is skipped", () => {});
  for (const status of ["APPROVED", "PLANNING"]) {
    it(\`keeps a \${status} event's status\`, () => {});
  }
  for (const s of cards) {
    it(\`\${s.card} \${s.name}\`, () => {});
  }
});
const cards = [{ card: "P1-T2", name: "peaks instead of sums" }];
`;

test("parseCsvRows reads quotes, doubled quotes and the start line of each row", () => {
  const rows = parseCsvRows(`${HEADER}A1,"has, a comma and ""quotes""",f.ts,name\nA2,two,f.ts,"multi\nline"\nA3,three,f.ts,x`);
  assert.deepEqual(rows.map((r) => r.line), [1, 2, 3, 5]);
  assert.equal(rows[1].fields[1], 'has, a comma and "quotes"');
  assert.equal(rows[2].fields[3], "multi\nline");
});

test("extractTitles finds it, test, it.each and it.skip titles in all three quote styles", () => {
  const titles = extractTitles(source, "test").map((t) => t.text);
  assert.ok(titles.includes("makes a thing"));
  assert.ok(titles.includes('says "no" to a bad thing'));
  assert.ok(titles.includes("keeps a back`tick"));
  assert.ok(titles.includes("shows the history: %s"));
  assert.ok(titles.includes("is skipped"));
  assert.deepEqual(extractTitles(source, "describe").map((t) => t.text), ["POST /things (X1)"]);
});

test("hasTest wants the whole title, not a prefix of it", () => {
  assert.ok(hasTest(source, "makes a thing"));
  assert.ok(!hasTest(source, "makes a"));
  assert.ok(!hasTest(source, "shows the history"));
  assert.ok(hasTest(source, "shows the history: %s"));
});

test("hasTest accepts a describe title followed by an it title, as a runner names the test", () => {
  assert.ok(hasTest(source, "POST /things (X1) makes a thing"));
  assert.ok(!hasTest(source, "POST /other makes a thing"));
});

test("hasTest accepts a generated title that its fixed text and file values explain", () => {
  assert.ok(hasTest(source, "keeps a PLANNING event's status"));
  assert.ok(hasTest(source, "shows the history: abc-123"));
  assert.ok(hasTest(source, "P1-T2 peaks instead of sums"), "card and name are both strings in the file");
  assert.ok(!hasTest(source, "P9-T9 something nobody wrote"), "little fixed text, so the values must be in the file");
  assert.ok(!hasTest(source, "keeps a PLANNING story's status"));
});

test("cardHeading reads the first heading of a manual card", () => {
  assert.equal(cardHeading("# S3-T13 — On screen\n\n## Specification\n"), "S3-T13 — On screen");
  assert.equal(cardHeading("no heading here"), null);
});

const files: Record<string, string> = {
  "t/a.test.ts": source,
  "tests/S3/S3-T13-x.md": "# S3-T13 — On screen\n",
};
const read = (path: string): string | null => files[path] ?? null;

test("checkTraceability passes rows that point at a test, a card, or carry the superseded marker", () => {
  const csv =
    HEADER +
    'X1,crit,t/a.test.ts,makes a thing\n' +
    'X1,crit,t/a.test.ts,"says ""no"" to a bad thing"\n' +
    "X1,crit,tests/S3/S3-T13-x.md,S3-T13 — On screen\n" +
    "X1,crit,t/a.test.ts,SUPERSEDED by E4 (W9-FX-5)\n";
  assert.deepEqual(checkTraceability("s.csv", csv, read), []);
});

test("checkTraceability reports a missing title, file and heading, and a row with an unquoted comma", () => {
  const csv =
    HEADER +
    "X1,crit,t/a.test.ts,a test that was removed\n" +
    "X2,crit,t/gone.test.ts,makes a thing\n" +
    "X3,crit,tests/S3/S3-T13-x.md,S3-T13 manual: on screen\n" +
    "X4,crit,t/a.test.ts,a name, with a comma\n";
  const problems = checkTraceability("s.csv", csv, read);
  assert.deepEqual(problems.map((p) => [p.line, p.story]), [[2, "X1"], [3, "X2"], [4, "X3"], [5, "X4"]]);
  assert.match(problems[0].message, /no test titled "a test that was removed"/);
  assert.match(problems[1].message, /does not exist/);
  assert.match(problems[2].message, /no heading/);
  assert.match(problems[3].message, /5 fields, not 4/);
});

test("checkTraceability reports a wrong header", () => {
  const problems = checkTraceability("s.csv", "story,criterion,file,name\n", read);
  assert.equal(problems.length, 1);
  assert.match(problems[0].message, /header/);
});

test("the superseded marker names the story and the change, and a test title is not mistaken for it", () => {
  assert.ok(SUPERSEDED_MARKER.test("SUPERSEDED by E4 (W9-FX-5)"));
  assert.ok(SUPERSEDED_MARKER.test("SUPERSEDED by E3 (CR-05)"));
  assert.ok(!SUPERSEDED_MARKER.test("SUPERSEDED"));
  assert.ok(!SUPERSEDED_MARKER.test("refuses a proposal, SUPERSEDED by E4 (W9-FX-5)"));
});

test("every traceability row in the repository points at a test that exists", () => {
  const problems = checkRepository(process.cwd());
  assert.deepEqual(
    problems.map((p) => `${p.file}:${p.line} (${p.story}) ${p.message}`),
    [],
  );
});
