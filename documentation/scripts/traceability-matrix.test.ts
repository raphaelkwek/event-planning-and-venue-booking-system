import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildMatrix,
  cardHeadline,
  eachTitles,
  loadCards,
  loadCriterionRows,
  junitTestFile,
  loadResults,
  mismatchAnnotations,
  parseCard,
  parseCsv,
  titlePattern,
  parseJunitReport,
  parsePlaywrightReport,
  parseTraceabilityCsv,
  parseVitestReport,
  repoPath,
  reportKind,
  traceabilityFiles,
  traceabilityProblems,
  type Card,
  type CriterionRow,
} from "./traceability-matrix.ts";
import { mismatches, renderHtml, renderMarkdown, renderSummary } from "./traceability-render.ts";

const ROOT = "/work/repo";
const row = (story: string, criterion: string, testFile: string, testName: string): CriterionRow => ({ story, sprint: "S1", criterion, testFile, testName, row: 1 });

const vitestReport = {
  testResults: [
    {
      name: `${ROOT}/backend/services/planning-core/tests/a.test.ts`,
      assertionResults: [
        { ancestorTitles: ["S2 cards"], title: "S2-T1 approves", fullName: "S2 cards S2-T1 approves", status: "passed" },
        { ancestorTitles: ["S2 cards"], title: "S2-T2 rejects", fullName: "S2 cards S2-T2 rejects", status: "failed" },
        { ancestorTitles: [], title: "waits", fullName: "waits", status: "pending" },
        { ancestorTitles: [], title: "later", fullName: "later", status: "todo" },
      ],
    },
  ],
};
const FILE_A = "backend/services/planning-core/tests/a.test.ts";

// EN-22-T1 -----------------------------------------------------------------------------------

test("parseCsv handles quoted commas, doubled quotes, line breaks and a byte-order mark (EN-22-T1)", () => {
  const rows = parseCsv('\uFEFFa,"b, c","say ""hi""","line\nbreak"\r\nx,y,z,w\n\n');
  assert.deepEqual(rows, [["a", "b, c", 'say "hi"', "line\nbreak"], ["x", "y", "z", "w"]]);
});

test("parseTraceabilityCsv reads the four columns and normalises Windows paths (EN-22-T1)", () => {
  const rows = parseTraceabilityCsv('story_id,acceptance_criterion,test_file,test_name\nA1,"An AC, with comma",a\\b.test.ts,does it\n', "S1");
  assert.deepEqual(rows, [{ row: 1, story: "A1", sprint: "S1", criterion: "An AC, with comma", testFile: "a/b.test.ts", testName: "does it" }]);
});

test("repoPath makes a runner's absolute path repo-relative (EN-22-T1)", () => {
  assert.equal(repoPath("/work/repo/backend/x.ts", "/work/repo"), "backend/x.ts");
  assert.equal(repoPath("C:\\Users\\me\\proj\\frontend\\tests\\y.tsx", "/elsewhere"), "frontend/tests/y.tsx");
  assert.equal(repoPath("plain.ts", "/elsewhere"), "plain.ts");
});

test("parseVitestReport maps passed, failed, pending and todo, keeping title and full name (EN-22-T1)", () => {
  const results = parseVitestReport(vitestReport, ROOT);
  assert.deepEqual(results.map((r) => r.status), ["pass", "fail", "skipped", "skipped"]);
  assert.equal(results[0]!.file, FILE_A);
  assert.equal(results[0]!.title, "S2-T1 approves");
  assert.equal(results[0]!.fullName, "S2 cards S2-T1 approves");
});

test("the matrix gives each criterion its tests and each test's last result (EN-22-T1)", () => {
  const rows = [
    row("S2", "Approve works", FILE_A, "S2-T1 approves"),
    row("S2", "Reject works", FILE_A, "S2 cards S2-T2 rejects"),
  ];
  const matrix = buildMatrix(rows, parseVitestReport(vitestReport, ROOT), []);
  const [approve, reject] = matrix.stories[0]!.criteria;
  assert.equal(approve!.tests[0]!.result, "pass");
  assert.equal(approve!.state, "covered");
  assert.equal(reject!.tests[0]!.result, "fail");
  assert.equal(reject!.state, "failing");
});

// EN-22-T2 -----------------------------------------------------------------------------------

test("a name in the CSV that no report contains is not found, and so is a file no report names (EN-22-T2)", () => {
  const rows = [row("S2", "AC", FILE_A, "S2-T9 does not exist"), row("S2", "AC", "backend/other.test.ts", "S2-T1 approves")];
  const matrix = buildMatrix(rows, parseVitestReport(vitestReport, ROOT), []);
  const tests = matrix.stories[0]!.criteria[0]!.tests;
  assert.deepEqual(tests.map((t) => [t.result, t.note]), [
    ["not found", "no test with that name in the file"],
    ["not found", "file is in no test report"],
  ]);
  assert.equal(matrix.stories[0]!.criteria[0]!.state, "unverified");
  assert.equal(matrix.stories[0]!.summary.notFound, 2);
});

test("skipped tests are reported as skipped, and a duplicate title takes the worst result (EN-22-T2)", () => {
  const report = {
    testResults: [{ name: `${ROOT}/${FILE_A}`, assertionResults: [
      { title: "same", fullName: "same", status: "passed" },
      { title: "same", fullName: "same", status: "failed" },
      { title: "idle", fullName: "idle", status: "pending" },
    ] }],
  };
  const matrix = buildMatrix([row("X", "AC1", FILE_A, "same"), row("X", "AC2", FILE_A, "idle")], parseVitestReport(report, ROOT), []);
  assert.deepEqual(matrix.stories[0]!.criteria.map((c) => [c.tests[0]!.result, c.state]), [["fail", "failing"], ["skipped", "unverified"]]);
});

// EN-22-T3 -----------------------------------------------------------------------------------

test("a criterion whose row has no test name has no test, and is not covered (EN-22-T3)", () => {
  const matrix = buildMatrix([row("S2", "Nothing yet", "", ""), row("S2", "Has one", FILE_A, "S2-T1 approves")], parseVitestReport(vitestReport, ROOT), []);
  const [none, has] = matrix.stories[0]!.criteria;
  assert.equal(none!.state, "no test");
  assert.equal(has!.state, "covered");
  assert.deepEqual(
    [matrix.stories[0]!.summary.criteria, matrix.stories[0]!.summary.covered, matrix.stories[0]!.summary.noTest],
    [2, 1, 1],
  );
});

// EN-22-T4 -----------------------------------------------------------------------------------

const cardText = (id: string, status: string) =>
  `# ${id}\n\n| Item | Content |\n|---|---|\n| Test Case ID | ${id} |\n| Test Scenario | A scenario for ${id} |\n| Status | ${status} |\n`;

test("parseCard reads the id, scenario and status rows, and rejects a file without them (EN-22-T4)", () => {
  assert.deepEqual(parseCard(cardText("EN-15-T3", "Pass (automated, API level)"), "tests/EN-15/x.md"), {
    id: "EN-15-T3", story: "EN-15", file: "tests/EN-15/x.md", scenario: "A scenario for EN-15-T3", status: "Pass (automated, API level)",
  });
  assert.equal(parseCard("# README\n", "tests/EN-15/README.md"), null);
});

test("cardHeadline groups the free-text statuses (EN-22-T4)", () => {
  assert.deepEqual(["Pass (automated, API level)", "Fail", "Not Executed", "Blocked", ""].map(cardHeadline), ["Pass", "Fail", "Not Executed", "Blocked", "Unknown"]);
});

test("a card appears against every test whose name carries its tag, and for its story (EN-22-T4)", () => {
  const cards: Card[] = [
    { id: "S2-T1", story: "S2", file: "tests/S2/S2-T1-x.md", scenario: "", status: "Pass (automated, API level)" },
    { id: "S2-T2", story: "S2", file: "tests/S2/S2-T2-x.md", scenario: "", status: "Not Executed" },
  ];
  const matrix = buildMatrix([row("S2", "AC", FILE_A, "S2-T1 approves"), row("S2", "AC", FILE_A, "S2 cards S2-T2 rejects")], parseVitestReport(vitestReport, ROOT), cards);
  const tests = matrix.stories[0]!.criteria[0]!.tests;
  assert.deepEqual(tests[0]!.cards, [{ id: "S2-T1", status: "Pass (automated, API level)" }]);
  assert.deepEqual(tests[1]!.cards, [{ id: "S2-T2", status: "Not Executed" }]);
  assert.deepEqual(matrix.stories[0]!.summary.cards, { Pass: 1, "Not Executed": 1 });
});

test("a row that points at a manual card takes the card's status as its result (EN-22-T4)", () => {
  const cards: Card[] = [
    { id: "S3-T13", story: "S3", file: "tests/S3/S3-T13-browser.md", scenario: "", status: "Pass" },
    { id: "S3-T14", story: "S3", file: "tests/S3/S3-T14-browser.md", scenario: "", status: "Not Executed" },
  ];
  const rows = [row("S3", "a", "tests/S3/S3-T13-browser.md", "S3-T13 manual"), row("S3", "b", "tests/S3/S3-T14-browser.md", "S3-T14 manual"), row("S3", "c", "tests/S3/gone.md", "S3-T99 manual")];
  const results = buildMatrix(rows, [], cards).stories[0]!.criteria.map((c) => c.tests[0]!.result);
  assert.deepEqual(results, ["pass", "skipped", "not found"]);
});

test("loadCards and loadCriterionRows read the files on disk (EN-22-T4)", () => {
  const dir = mkdtempSync(join(tmpdir(), "en22-"));
  try {
    mkdirSync(join(dir, "tests", "S2"), { recursive: true });
    writeFileSync(join(dir, "tests", "S2", "S2-T1-x.md"), cardText("S2-T1", "Pass"));
    writeFileSync(join(dir, "tests", "S2", "README.md"), "# S2\n");
    const header = "story_id,acceptance_criterion,test_file,test_name\n";
    mkdirSync(join(dir, "trace", "sprint-2"), { recursive: true });
    mkdirSync(join(dir, "trace", "sprint-10"));
    writeFileSync(join(dir, "trace", "sprint-2", "S2.csv"), `${header}S2,AC,a.ts,t\nS2,AC,a.ts,t\n`);
    writeFileSync(join(dir, "trace", "sprint-2", "A1.csv"), `${header}A1,AC,c.ts,v\n`);
    writeFileSync(join(dir, "trace", "sprint-2", "notes.txt"), "ignored");
    writeFileSync(join(dir, "trace", "sprint-10", "Z9.csv"), `${header}Z9,AC,b.ts,u\n`);
    writeFileSync(join(dir, "trace", "notes.csv"), "ignored");

    assert.deepEqual(loadCards(join(dir, "tests"), dir).map((c) => [c.id, c.file]), [["S2-T1", "tests/S2/S2-T1-x.md"]]);
    assert.deepEqual(loadCards(join(dir, "missing"), dir), []);
    assert.deepEqual(loadCriterionRows(join(dir, "trace")).map((r) => [r.story, r.sprint, r.row]), [["A1", "S2", 1], ["S2", "S2", 1], ["Z9", "S10", 1]]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a sprint-N.csv from before the per-story layout is refused, not read or skipped", () => {
  const dir = mkdtempSync(join(tmpdir(), "trace-legacy-"));
  try {
    mkdirSync(join(dir, "sprint-4"));
    writeFileSync(join(dir, "sprint-4", "F3.csv"), "story_id,acceptance_criterion,test_file,test_name\nF3,AC,a.ts,t\n");
    writeFileSync(join(dir, "sprint-4.csv"), "story_id,acceptance_criterion,test_file,test_name\nR5,AC,b.ts,u\n");
    assert.throws(() => loadCriterionRows(dir), /sprint-4\.csv: traceability rows now go in sprint-<n>\/<STORY>\.csv/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("traceabilityProblems reports a file without the header and a row filed under another story", () => {
  const dir = mkdtempSync(join(tmpdir(), "trace-problems-"));
  try {
    mkdirSync(join(dir, "sprint-4"));
    writeFileSync(join(dir, "sprint-4", "F3.csv"), "story_id,acceptance_criterion,test_file,test_name\nF3,AC,a.ts,t\nF4,AC,b.ts,u\n");
    writeFileSync(join(dir, "sprint-4", "R5.csv"), "story,criterion\nR5,AC\n");
    assert.deepEqual(traceabilityProblems(dir), [
      "sprint-4/F3.csv row 2: a row for F4 belongs in sprint-4/F4.csv",
      "sprint-4/R5.csv: the first line must be story_id,acceptance_criterion,test_file,test_name",
    ]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the repository's traceability files are one per story, each with the header and only its own rows", () => {
  const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "traceability");
  assert.deepEqual(traceabilityProblems(dir), []);
  assert.ok(traceabilityFiles(dir).length > 0);
});

// EN-22-T5 -----------------------------------------------------------------------------------

test("the summary counts covered, failing, no-test, unverified and not-found per story, and in total (EN-22-T5)", () => {
  const rows = [
    row("S2", "ok", FILE_A, "S2-T1 approves"),
    row("S2", "bad", FILE_A, "S2-T2 rejects"),
    row("S2", "none", "", ""),
    row("S2", "ghost", FILE_A, "S2-T7 ghost"),
    row("S3", "ok too", FILE_A, "S2-T1 approves"),
  ];
  const matrix = buildMatrix(rows, parseVitestReport(vitestReport, ROOT), []);
  const s2 = { ...matrix.stories[0]!.summary, cards: undefined };
  delete s2.cards;
  Reflect.deleteProperty(s2, "nonStandardCards");
  assert.deepEqual(s2, { story: "S2", criteria: 4, covered: 1, failing: 1, noTest: 1, unverified: 1, notFound: 1 });
  assert.deepEqual(matrix.totals, { criteria: 5, covered: 2, failing: 1, noTest: 1, unverified: 1, notFound: 1 });
});

test("the Markdown ends with the per-story summary and lists the mismatches before it (EN-22-T5)", () => {
  const matrix = buildMatrix([row("S2", "ok", FILE_A, "S2-T1 approves"), row("S2", "none", "", ""), row("S2", "ghost", FILE_A, "S2-T7 ghost")], parseVitestReport(vitestReport, ROOT), [], ["a.json"]);
  const markdown = renderMarkdown(matrix);
  assert.match(markdown, /^# Traceability matrix/);
  assert.ok(markdown.indexOf("## Mismatches") < markdown.indexOf("## Summary per story"));
  assert.match(markdown.trimEnd().split("\n").at(-1)!, /^\| S2 \| 3 \| 1 \| 0 \| 1 \| 1 \| 1 \|$/);
  assert.match(markdown, /NO TEST/);
  assert.match(markdown, /NOT FOUND \(no test with that name in the file\)/);
  assert.deepEqual(mismatches(matrix).map((m) => m.kind), ["no test", "not found"]);
  assert.match(renderSummary(matrix), /### Summary per story/);
});

test("the HTML escapes what it prints and carries the same summary (EN-22-T5)", () => {
  const matrix = buildMatrix([row("S2", "a <b> & \"c\"", FILE_A, "S2-T1 approves")], parseVitestReport(vitestReport, ROOT), []);
  const html = renderHtml(matrix);
  assert.match(html, /^<!doctype html>/);
  assert.match(html, /a &lt;b&gt; &amp; &quot;c&quot;/);
  assert.match(html, /<h2>Summary per story<\/h2>/);
  assert.doesNotMatch(html, /<b>/);
});

test("with no mismatches the sections say so, and with no report the matrix says no report was found (EN-22-T5)", () => {
  const clean = buildMatrix([row("S2", "ok", FILE_A, "S2-T1 approves")], parseVitestReport(vitestReport, ROOT), [], ["a.json"]);
  assert.match(renderMarkdown(clean), /No mismatches\./);
  assert.match(renderHtml(clean), /No mismatches\./);
  assert.match(renderMarkdown(buildMatrix([], [], [])), /No test report was found/);
});

test("mismatch annotations are warnings per affected story, capped at twenty (EN-22-T5)", () => {
  const rows = Array.from({ length: 25 }, (_, i) => row(`Z${i}`, "none", "", ""));
  const lines = mismatchAnnotations(buildMatrix(rows, [], []));
  assert.equal(lines.length, 20);
  assert.match(lines[0]!, /^::warning title=Traceability Z0::1 criteria with no test, 0 test names not found$/);
});

// EN-22-T6 -----------------------------------------------------------------------------------

const playwrightReport = {
  config: { rootDir: `${ROOT}/tests/e2e` },
  suites: [
    {
      title: "login.spec.ts",
      file: "login.spec.ts",
      specs: [],
      suites: [
        {
          title: "Login",
          file: "login.spec.ts",
          specs: [
            { title: "A1-E1 signs in", file: "login.spec.ts", tests: [{ status: "expected", results: [{ status: "passed" }] }] },
            { title: "A1-E2 rejects a bad password", file: "login.spec.ts", tests: [{ status: "unexpected", results: [{ status: "failed" }] }] },
            { title: "A1-E3 flaky but passes", file: "login.spec.ts", tests: [{ status: "flaky", results: [{ status: "failed" }, { status: "passed" }] }] },
            { title: "A1-E4 skipped", file: "login.spec.ts", tests: [{ status: "skipped", results: [] }] },
          ],
        },
      ],
    },
  ],
};

test("parsePlaywrightReport maps expected, unexpected, flaky and skipped, with repo-relative files (EN-22-T6)", () => {
  const results = parsePlaywrightReport(playwrightReport, ROOT);
  assert.deepEqual(results.map((r) => r.status), ["pass", "fail", "pass", "skipped"]);
  assert.equal(results[0]!.file, "tests/e2e/login.spec.ts");
  assert.equal(results[0]!.fullName, "Login A1-E1 signs in");
});

test("a Playwright result fills a matrix row (EN-22-T6)", () => {
  const matrix = buildMatrix([row("A1", "signs in", "tests/e2e/login.spec.ts", "Login A1-E1 signs in")], parsePlaywrightReport(playwrightReport, ROOT), []);
  assert.equal(matrix.stories[0]!.criteria[0]!.tests[0]!.result, "pass");
});

test("loadResults reads vitest and Playwright reports, skips other JSON, and tolerates a missing path (EN-22-T6)", () => {
  const dir = mkdtempSync(join(tmpdir(), "en22-results-"));
  try {
    mkdirSync(join(dir, "unit"));
    writeFileSync(join(dir, "unit", "vitest-unit.json"), JSON.stringify(vitestReport));
    writeFileSync(join(dir, "pw.json"), JSON.stringify(playwrightReport));
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "not a report" }));
    writeFileSync(join(dir, "broken.json"), "{ nope");
    writeFileSync(join(dir, "notes.txt"), "ignored");

    const loaded = loadResults([dir, join(dir, "does-not-exist")], ROOT);
    assert.equal(loaded.files.length, 2);
    assert.equal(loaded.results.length, 8);
    assert.equal(loadResults([join(dir, "does-not-exist")], ROOT).results.length, 0);
    assert.equal(loadResults([join(dir, "pw.json")], ROOT).results.length, 4);
    assert.equal(loadResults([join(dir, "notes.txt")], ROOT).results.length, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("reportKind tells the two formats apart (EN-22-T6)", () => {
  assert.deepEqual([reportKind(vitestReport), reportKind(playwrightReport), reportKind({}), reportKind(null), reportKind("x")], ["vitest", "playwright", null, null, null]);
});

test("the CLI writes the Markdown, HTML and JSON matrix and prints the summary (EN-22-T7)", async () => {
  const dir = mkdtempSync(join(tmpdir(), "en22-cli-"));
  const { main } = await import("./traceability-matrix.ts");
  const logged: string[] = [];
  const originalLog = console.log;
  const originalError = console.error;
  try {
    mkdirSync(join(dir, "trace", "sprint-1"), { recursive: true });
    writeFileSync(join(dir, "trace", "sprint-1", "S2.csv"),`story_id,acceptance_criterion,test_file,test_name\nS2,AC,${FILE_A},S2-T1 approves\nS2,AC2,,\n`);
    writeFileSync(join(dir, "results.json"), JSON.stringify(vitestReport));
    console.log = (line: string) => void logged.push(line);
    console.error = () => undefined;

    main(["--root", dir, "--csv-dir", "trace", "--cards", "tests", "--results", "results.json", "--out", "out", "--summary", "--annotate"]);

    assert.match(readFileSync(join(dir, "out", "traceability-matrix.md"), "utf8"), /S2-T1 approves/);
    assert.match(readFileSync(join(dir, "out", "traceability-matrix.html"), "utf8"), /<table>/);
    assert.equal(JSON.parse(readFileSync(join(dir, "out", "traceability-matrix.json"), "utf8")).stories.length, 1);
    assert.ok(logged.some((line) => line.startsWith("::warning title=Traceability S2")));
    assert.ok(logged.some((line) => line.includes("### Summary per story")));
  } finally {
    console.log = originalLog;
    console.error = originalError;
    rmSync(dir, { recursive: true, force: true });
  }
});

// node:test results (JUnit) -------------------------------------------------------------------

const junit = `<?xml version="1.0" encoding="utf-8"?>
<testsuites>
	<testcase name="parses a &quot;quoted&quot; name &amp; more (EN-22-T6)" time="0.001" classname="test"/>
	<testcase name="fails (EN-22-T6)" time="0.001" classname="test"><failure type="testCodeFailure" message="boom">stack</failure></testcase>
	<testcase name="errors (EN-22-T6)" classname="test"><error message="x"/></testcase>
	<testcase name="is skipped (EN-22-T6)" classname="test"><skipped/></testcase>
</testsuites>`;

test("junitTestFile turns the report's file name back into the test file's path (EN-22-T6)", () => {
  assert.equal(junitTestFile("script-results/documentation__scripts__dora.test.ts.xml"), "documentation/scripts/dora.test.ts");
  assert.equal(junitTestFile("C:/r/documentation__scripts__x.test.ts.xml"), "documentation/scripts/x.test.ts");
});

test("parseJunitReport reads pass, failure, error and skipped, and unescapes names (EN-22-T6)", () => {
  const results = parseJunitReport(junit, "documentation/scripts/x.test.ts");
  assert.deepEqual(results.map((r) => [r.title, r.status]), [
    ['parses a "quoted" name & more (EN-22-T6)', "pass"],
    ["fails (EN-22-T6)", "fail"],
    ["errors (EN-22-T6)", "fail"],
    ["is skipped (EN-22-T6)", "skipped"],
  ]);
  assert.ok(results.every((r) => r.file === "documentation/scripts/x.test.ts"));
});

test("loadResults reads a JUnit file under the file name of its test, and ignores other XML (EN-22-T6)", () => {
  const dir = mkdtempSync(join(tmpdir(), "en22-junit-"));
  try {
    writeFileSync(join(dir, "documentation__scripts__x.test.ts.xml"), junit);
    writeFileSync(join(dir, "other.xml"), "<note>not a report</note>");
    const loaded = loadResults([dir], ROOT);
    assert.equal(loaded.files.length, 1);
    const matrix = buildMatrix([row("EN-22", "AC", "documentation/scripts/x.test.ts", "fails (EN-22-T6)")], loaded.results, []);
    assert.equal(matrix.stories[0]!.criteria[0]!.tests[0]!.result, "fail");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// it.each titles, row numbers, card statuses --------------------------------------------------

test("an it.each title with placeholders matches the expanded titles in the report (EN-22-T2)", () => {
  assert.equal(titlePattern("plain title"), null);
  assert.ok(titlePattern("refuses %s")!.test("refuses APPROVED"));
  assert.ok(titlePattern("$name works (1+1)")!.test("alpha works (1+1)"));
  assert.ok(!titlePattern("refuses %s")!.test("accepts APPROVED"));
  const report = { testResults: [{ name: `${ROOT}/${FILE_A}`, assertionResults: [
    { title: "refuses DRAFT", fullName: "refuses DRAFT", status: "passed" },
    { title: "refuses DONE", fullName: "refuses DONE", status: "failed" },
  ] }] };
  const matrix = buildMatrix([row("F2", "AC", FILE_A, "refuses %s"), row("F2", "AC2", FILE_A, "accepts %s")], parseVitestReport(report, ROOT), []);
  assert.deepEqual(matrix.stories[0]!.criteria.map((c) => c.tests[0]!.result), ["fail", "not found"]);
});

test("a mismatch names the sprint file and row it came from (EN-22-T2)", () => {
  const rows = parseTraceabilityCsv("h\nA,ac,f.ts,one\nA,ac,f.ts,two\n", "S3");
  const [missing] = mismatches(buildMatrix(rows, [], []));
  assert.match(missing!.detail, /^S3 row 1: f\.ts › one/);
});

test("a card status other than the four standard ones is flagged, but Pass (automated) still counts as Pass (EN-22-T4)", () => {
  const cards: Card[] = [
    { id: "A-T1", story: "A", file: "x", scenario: "", status: "Pass" },
    { id: "A-T2", story: "A", file: "y", scenario: "", status: "Pass (automated, API level)" },
  ];
  const matrix = buildMatrix([row("A", "ac", "", "")], [], cards);
  assert.deepEqual(matrix.stories[0]!.summary.nonStandardCards, ["A-T2"]);
  assert.deepEqual(matrix.stories[0]!.summary.cards, { Pass: 2 });
  assert.match(mismatchAnnotations(matrix)[0]!, /^::warning title=Card status::1 cards/);
  assert.match(renderMarkdown(matrix), /Warning: 1 cards have a Status other than/);
});

test("eachTitles finds it.each templates, also when the title starts on the next line (EN-22-T2)", () => {
  const source = 'it.each(files)("replays %s deterministically", async () => {});\nit.each([\n  [1],\n])(\n  "shows it (AC2): %s",\n  () => {},\n);\nit("plain", () => {});';
  assert.deepEqual(eachTitles(source), ["replays %s deterministically", "shows it (AC2): %s"]);
});

test("a row naming an it.each template's wording matches the expanded results, but a different wording does not (EN-22-T2)", () => {
  const report = { testResults: [{ name: `${ROOT}/${FILE_A}`, assertionResults: [
    { title: "replays a.json deterministically", fullName: "replays a.json deterministically", status: "passed" },
    { title: "replays b.json deterministically", fullName: "replays b.json deterministically", status: "failed" },
  ] }] };
  const templates = () => ["replays %s deterministically"];
  const matrix = buildMatrix([row("X", "AC1", FILE_A, "replays each history deterministically"), row("X", "AC2", FILE_A, "replays it differently")], parseVitestReport(report, ROOT), [], [], templates);
  assert.deepEqual(matrix.stories[0]!.criteria.map((c) => c.tests[0]!.result), ["fail", "not found"]);
});

test("per-story files checked out with CRLF line endings load whole and pass the layout check", () => {
  const dir = mkdtempSync(join(tmpdir(), "trace-crlf-"));
  try {
    mkdirSync(join(dir, "sprint-4"));
    writeFileSync(join(dir, "sprint-4", "F3.csv"), "story_id,acceptance_criterion,test_file,test_name\r\nF3,AC one,a.ts,F3-T1 cancels\r\nF3,\"AC, two\",b.ts,F3-T2 refuses\r\n");
    assert.deepEqual(traceabilityProblems(dir), []);
    assert.deepEqual(
      loadCriterionRows(dir).map((r) => [r.story, r.criterion, r.testFile, r.testName, r.row]),
      [["F3", "AC one", "a.ts", "F3-T1 cancels", 1], ["F3", "AC, two", "b.ts", "F3-T2 refuses", 2]],
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
