#!/usr/bin/env node
/**
 * EN-22 — the traceability matrix: story, acceptance criterion, test, last result.
 *
 * Inputs:
 *   - documentation/traceability/sprint-N.csv  (story_id, acceptance_criterion, test_file, test_name)
 *   - test results: every vitest `--reporter=json` file, Playwright JSON report and node:test JUnit file found
 *     under the --results paths (a report that is not there is simply not read). A JUnit file names no
 *     test file, so its file name does: documentation__scripts__x.test.ts.xml is documentation/scripts/x.test.ts.
 *   - the functional cards, tests/<STORY>/*.md, for their `| Status |` row
 *
 * A test is looked up by file and name, and the name may be the test's title or its full name
 * (describe blocks joined with spaces). Each criterion row then has one of four results:
 *   pass, fail, skipped, or "not found" (the CSV names a test that no report contains).
 *
 * Usage:
 *   tsx documentation/scripts/traceability-matrix.ts [--csv-dir documentation/traceability]
 *     [--cards tests] [--results <dir-or-file>]... [--out <dir>] [--root <repo root>]
 *     [--summary] [--annotate]
 *
 *   --out       writes traceability-matrix.md, .html and .json into this directory.
 *   --summary   prints the short per-story summary (for $GITHUB_STEP_SUMMARY) to stdout.
 *   --annotate  prints a GitHub `::warning::` line per story with a missing test or a name that
 *               does not exist. Mismatches are warnings: the script exits 0 for them.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { renderHtml, renderMarkdown, renderSummary } from "./traceability-render.ts";

export type Result = "pass" | "fail" | "skipped" | "not found";

export interface CriterionRow {
  story: string;
  sprint: string;
  criterion: string;
  testFile: string;
  testName: string;
  /** 1-based data row in its sprint file, header excluded. */
  row: number;
}

export interface TestResult {
  file: string;
  title: string;
  fullName: string;
  status: Exclude<Result, "not found">;
}

export interface Card {
  id: string;
  story: string;
  file: string;
  scenario: string;
  status: string;
}

export interface TestEntry {
  sprint: string;
  row: number;
  file: string;
  name: string;
  result: Result;
  /** Why a result is "not found", or that a card stands in for a test. */
  note: string;
  cards: { id: string; status: string }[];
}

export interface CriterionEntry {
  criterion: string;
  tests: TestEntry[];
  /** covered: a passing test and none failing; failing; no test; unverified: tests exist, none passed. */
  state: "covered" | "failing" | "no test" | "unverified";
}

export interface StorySummary {
  story: string;
  criteria: number;
  covered: number;
  failing: number;
  noTest: number;
  unverified: number;
  notFound: number;
  cards: Record<string, number>;
  /** Cards whose Status is not exactly Pass, Fail, Not Executed or Blocked (implementation.md section 8.4). */
  nonStandardCards: string[];
}

export interface Matrix {
  stories: { story: string; criteria: CriterionEntry[]; cards: Card[]; summary: StorySummary }[];
  totals: Omit<StorySummary, "story" | "cards">;
  resultFiles: string[];
  testsWithResults: number;
}

// ---------------------------------------------------------------------------------------------
// CSV

/** RFC 4180: quoted fields may hold commas, doubled quotes and line breaks. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((cell) => cell !== "")) rows.push(row);
  return rows;
}

/** Rows of one sprint file; the header row is skipped, and an exact repeat of an earlier row is dropped. */
export function parseTraceabilityCsv(text: string, sprint: string): CriterionRow[] {
  const [, ...body] = parseCsv(text);
  return body.map(([story = "", criterion = "", testFile = "", testName = ""], index) => ({
    row: index + 1,
    story: story.trim(),
    sprint,
    criterion: criterion.trim(),
    testFile: testFile.trim().replace(/\\/g, "/"),
    testName: testName.trim(),
  }));
}

export function loadCriterionRows(dir: string): CriterionRow[] {
  const files = readdirSync(dir).filter((name) => /^sprint-\d+\.csv$/.test(name)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const seen = new Set<string>();
  return files.flatMap((name) =>
    parseTraceabilityCsv(readFileSync(join(dir, name), "utf8"), name.replace(/^sprint-(\d+)\.csv$/, "S$1")).filter((row) => {
      const key = JSON.stringify([row.story, row.criterion, row.testFile, row.testName]);
      if (!row.story || seen.has(key)) return false;
      seen.add(key);
      return true;
    }),
  );
}

// ---------------------------------------------------------------------------------------------
// Results

const norm = (text: string) => text.replace(/\s+/g, " ").trim();

/** Repo-relative, forward-slashed path of a file a report names (absolute on whatever machine ran it). */
export function repoPath(path: string, root: string): string {
  const slashed = path.replace(/\\/g, "/");
  const rootSlashed = root.replace(/\\/g, "/").replace(/\/$/, "") + "/";
  if (slashed.startsWith(rootSlashed)) return slashed.slice(rootSlashed.length);
  return slashed.match(/(?:^|\/)((?:backend|frontend|tests|documentation)\/.+)$/)?.[1] ?? slashed;
}

const VITEST_STATUS: Record<string, TestResult["status"]> = { passed: "pass", failed: "fail", pending: "skipped", skipped: "skipped", todo: "skipped" };

export function parseVitestReport(report: unknown, root: string): TestResult[] {
  const files = (report as { testResults?: unknown[] }).testResults ?? [];
  return files.flatMap((entry) => {
    const file = entry as { name?: string; assertionResults?: Record<string, unknown>[] };
    return (file.assertionResults ?? []).map((test) => ({
      file: repoPath(file.name ?? "", root),
      title: norm(String(test.title ?? "")),
      fullName: norm(String(test.fullName ?? `${((test.ancestorTitles as string[]) ?? []).join(" ")} ${test.title ?? ""}`)),
      status: VITEST_STATUS[String(test.status)] ?? "fail",
    }));
  });
}

interface PlaywrightSuite {
  title?: string;
  file?: string;
  suites?: PlaywrightSuite[];
  specs?: { title?: string; file?: string; tests?: { status?: string; results?: { status?: string }[] }[] }[];
}

function playwrightStatus(tests: { status?: string; results?: { status?: string }[] }[]): TestResult["status"] {
  const statuses = tests.map((test) => test.status ?? "");
  if (statuses.some((s) => s === "unexpected")) return "fail";
  if (statuses.length > 0 && statuses.every((s) => s === "skipped")) return "skipped";
  return "pass";
}

/** Playwright's JSON report (`--reporter=json`), as EN-14's e2e job writes it. */
export function parsePlaywrightReport(report: unknown, root: string): TestResult[] {
  const data = report as { config?: { rootDir?: string }; suites?: PlaywrightSuite[] };
  const base = data.config?.rootDir ?? "";
  const walk = (suite: PlaywrightSuite, ancestors: string[]): TestResult[] => {
    const isFile = suite.file !== undefined && suite.title === suite.file;
    const here = isFile || !suite.title ? ancestors : [...ancestors, suite.title];
    const own = (suite.specs ?? []).map((spec) => {
      const file = repoPath(join(base, spec.file ?? suite.file ?? ""), root);
      return { file, title: norm(spec.title ?? ""), fullName: norm([...here, spec.title ?? ""].join(" ")), status: playwrightStatus(spec.tests ?? []) };
    });
    return [...own, ...(suite.suites ?? []).flatMap((child) => walk(child, here))];
  };
  return (data.suites ?? []).flatMap((suite) => walk(suite, []));
}

export type ReportKind = "vitest" | "playwright" | null;

export function reportKind(json: unknown): ReportKind {
  if (typeof json !== "object" || json === null) return null;
  if (Array.isArray((json as { testResults?: unknown }).testResults)) return "vitest";
  if (Array.isArray((json as { suites?: unknown }).suites) && "config" in json) return "playwright";
  return null;
}

const XML_ENTITIES: Record<string, string> = { "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'", "&amp;": "&" };
const unescapeXml = (text: string) => text.replace(/&(?:lt|gt|quot|apos|amp);/g, (entity) => XML_ENTITIES[entity] ?? entity);

/** The test file a JUnit file stands for: `documentation__scripts__x.test.ts.xml` is documentation/scripts/x.test.ts. */
export function junitTestFile(reportPath: string): string {
  const name = reportPath.replace(/\\/g, "/").split("/").pop() ?? "";
  return name.replace(/\.xml$/, "").replace(/__/g, "/");
}

/** node:test's JUnit reporter (`--test-reporter=junit`): one testcase element per test. */
export function parseJunitReport(xml: string, testFile: string): TestResult[] {
  return [...xml.matchAll(/<testcase\b([^>]*?)(?:\/>|>([\s\S]*?)<\/testcase>)/g)].map((match) => {
    const name = norm(unescapeXml(match[1]!.match(/\bname="([^"]*)"/)?.[1] ?? ""));
    const body = match[2] ?? "";
    const status: TestResult["status"] = /<(?:failure|error)\b/.test(body) ? "fail" : /<skipped\b/.test(body) ? "skipped" : "pass";
    return { file: testFile, title: name, fullName: name, status };
  });
}

function reportFilesUnder(path: string): string[] {
  if (!existsSync(path)) return [];
  if (statSync(path).isFile()) return /\.(json|xml)$/.test(path) ? [path] : [];
  return readdirSync(path)
    .filter((name) => name !== "node_modules" && name !== ".git")
    .flatMap((name) => reportFilesUnder(join(path, name)));
}

function readReport(file: string, root: string): TestResult[] | null {
  const text = readFileSync(file, "utf8");
  if (file.endsWith(".xml")) return text.includes("<testcase") ? parseJunitReport(text, junitTestFile(file)) : null;
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return null;
  }
  const kind = reportKind(json);
  if (!kind) return null;
  return kind === "vitest" ? parseVitestReport(json, root) : parsePlaywrightReport(json, root);
}

/** Reads every vitest, Playwright and JUnit report under the paths; files that are none of these are ignored. */
export function loadResults(paths: string[], root: string): { results: TestResult[]; files: string[] } {
  const results: TestResult[] = [];
  const files: string[] = [];
  for (const file of paths.flatMap(reportFilesUnder)) {
    const read = readReport(file, root);
    if (!read) continue;
    files.push(repoPath(resolve(file), root));
    results.push(...read);
  }
  return { results, files };
}

// ---------------------------------------------------------------------------------------------
// Cards

const CARD_ID = /\b((?:EN-\d+|[A-Z]{1,2}\d{1,2})-T\d+)\b/g;

export function parseCard(text: string, file: string): Card | null {
  const cell = (label: string) => text.match(new RegExp(`^\\|\\s*${label}\\s*\\|\\s*(.*?)\\s*\\|\\s*$`, "m"))?.[1];
  const id = cell("Test Case ID");
  const status = cell("Status");
  if (!id || status === undefined) return null;
  return { id, story: id.replace(/-T\d+$/, ""), file, scenario: cell("Test Scenario") ?? "", status };
}

export function loadCards(testsDir: string, root: string): Card[] {
  if (!existsSync(testsDir)) return [];
  return readdirSync(testsDir)
    .filter((name) => statSync(join(testsDir, name)).isDirectory())
    .flatMap((dir) =>
      readdirSync(join(testsDir, dir))
        .filter((name) => /^.+-T\d+.*\.md$/.test(name))
        .map((name) => parseCard(readFileSync(join(testsDir, dir, name), "utf8"), repoPath(resolve(testsDir, dir, name), root))),
    )
    .filter((card): card is Card => card !== null);
}

/** Card statuses are free text ("Pass (automated, API level)"); the headline is its first word(s). */
export function cardHeadline(status: string): string {
  if (/^pass/i.test(status)) return "Pass";
  if (/^fail/i.test(status)) return "Fail";
  if (/^not executed/i.test(status)) return "Not Executed";
  return status || "Unknown";
}

// ---------------------------------------------------------------------------------------------
// The matrix

const WORST: Record<Exclude<Result, "not found">, number> = { fail: 3, skipped: 2, pass: 1 };

function indexResults(results: TestResult[]) {
  const byFile = new Map<string, Map<string, TestResult["status"]>>();
  const add = (map: Map<string, TestResult["status"]>, name: string, status: TestResult["status"]) => {
    const current = map.get(name);
    if (!current || WORST[status] > WORST[current]) map.set(name, status);
  };
  for (const result of results) {
    const map = byFile.get(result.file) ?? new Map();
    byFile.set(result.file, map);
    add(map, result.title, result.status);
    add(map, result.fullName, result.status);
  }
  return byFile;
}

const cardStatus = (card: Card): Result => {
  const headline = cardHeadline(card.status);
  return headline === "Pass" ? "pass" : headline === "Fail" ? "fail" : "skipped";
};

const PLACEHOLDER = /%[sdifjoOp#%]|\$[A-Za-z_][\w.]*/;

/** A title from `it.each` ("handles %s", "$name works") as a pattern; the results hold the expanded titles. */
export function titlePattern(name: string): RegExp | null {
  if (!PLACEHOLDER.test(name)) return null;
  const source = name
    .split(new RegExp(`(${PLACEHOLDER.source})`))
    .map((part, i) => (i % 2 === 1 ? ".+?" : part.replace(/[^\w\s]/g, (char) => `\\${char}`)))
    .join("");
  return new RegExp(`^${source}$`);
}

function lookupName(file: Map<string, TestResult["status"]>, name: string): TestResult["status"] | undefined {
  const exact = file.get(name);
  if (exact) return exact;
  const pattern = titlePattern(name);
  if (!pattern) return undefined;
  const hits = [...file].filter(([title]) => pattern.test(title)).map(([, status]) => status);
  return hits.reduce<TestResult["status"] | undefined>((worst, status) => (!worst || WORST[status] > WORST[worst] ? status : worst), undefined);
}

function lookup(row: CriterionRow, index: ReturnType<typeof indexResults>, cardsByFile: Map<string, Card>, cardsById: Map<string, Card>): Pick<TestEntry, "result" | "note"> {
  if (row.testFile.endsWith(".md")) {
    const card = cardsByFile.get(row.testFile) ?? cardsById.get(row.testName.match(CARD_ID)?.[0] ?? "");
    return card ? { result: cardStatus(card), note: `manual card: ${card.status}` } : { result: "not found", note: "card file does not exist" };
  }
  const file = index.get(row.testFile);
  if (!file) return { result: "not found", note: "file is in no test report" };
  const status = lookupName(file, norm(row.testName));
  return status ? { result: status, note: "" } : { result: "not found", note: "no test with that name in the file" };
}

function stateOf(tests: TestEntry[]): CriterionEntry["state"] {
  if (tests.length === 0) return "no test";
  if (tests.some((test) => test.result === "fail")) return "failing";
  return tests.some((test) => test.result === "pass") ? "covered" : "unverified";
}

const STANDARD_STATUSES = ["Pass", "Fail", "Not Executed", "Blocked"];

function summarise(story: string, criteria: CriterionEntry[], cards: Card[]): StorySummary {
  const count = (state: CriterionEntry["state"]) => criteria.filter((criterion) => criterion.state === state).length;
  const headlines: Record<string, number> = {};
  for (const card of cards) headlines[cardHeadline(card.status)] = (headlines[cardHeadline(card.status)] ?? 0) + 1;
  return {
    story,
    criteria: criteria.length,
    covered: count("covered"),
    failing: count("failing"),
    noTest: count("no test"),
    unverified: count("unverified"),
    notFound: criteria.reduce((sum, criterion) => sum + criterion.tests.filter((test) => test.result === "not found").length, 0),
    cards: headlines,
    nonStandardCards: cards.filter((card) => !STANDARD_STATUSES.includes(card.status)).map((card) => card.id),
  };
}

export function buildMatrix(rows: CriterionRow[], results: TestResult[], cards: Card[], resultFiles: string[] = []): Matrix {
  const index = indexResults(results);
  const cardsById = new Map(cards.map((card) => [card.id, card]));
  const cardsByFile = new Map(cards.map((card) => [card.file, card]));
  const stories = [...new Set([...rows.map((row) => row.story)])];

  const built = stories.map((story) => {
    const byCriterion = new Map<string, CriterionRow[]>();
    for (const row of rows.filter((r) => r.story === story)) byCriterion.set(row.criterion, [...(byCriterion.get(row.criterion) ?? []), row]);
    const criteria = [...byCriterion].map(([criterion, list]) => {
      const tests = list
        .filter((row) => row.testName !== "")
        .map((row): TestEntry => ({
          sprint: row.sprint,
          row: row.row,
          file: row.testFile,
          name: row.testName,
          ...lookup(row, index, cardsByFile, cardsById),
          cards: [...new Set(row.testName.match(CARD_ID) ?? [])].flatMap((id) => (cardsById.has(id) ? [{ id, status: cardsById.get(id)!.status }] : [])),
        }));
      return { criterion, tests, state: stateOf(tests) };
    });
    const storyCards = cards.filter((card) => card.story === story);
    return { story, criteria, cards: storyCards, summary: summarise(story, criteria, storyCards) };
  });

  const sum = (pick: (s: StorySummary) => number) => built.reduce((total, entry) => total + pick(entry.summary), 0);
  return {
    stories: built,
    totals: {
      criteria: sum((s) => s.criteria),
      covered: sum((s) => s.covered),
      failing: sum((s) => s.failing),
      noTest: sum((s) => s.noTest),
      unverified: sum((s) => s.unverified),
      notFound: sum((s) => s.notFound),
    },
    resultFiles,
    testsWithResults: results.length,
  };
}

/** One line per story that has a criterion with no test or a test name that does not exist. */
export function mismatchAnnotations(matrix: Matrix): string[] {
  const nonStandard = matrix.stories.reduce((sum, { summary }) => sum + summary.nonStandardCards.length, 0);
  const cardWarning = nonStandard > 0 ? [`::warning title=Card status::${nonStandard} cards have a Status other than Pass, Fail, Not Executed or Blocked (implementation.md section 8.4)`] : [];
  return [...cardWarning, ...storyAnnotations(matrix)];
}

function storyAnnotations(matrix: Matrix): string[] {
  return matrix.stories
    .filter(({ summary }) => summary.noTest > 0 || summary.notFound > 0)
    .slice(0, 20)
    .map(({ story, summary }) => `::warning title=Traceability ${story}::${summary.noTest} criteria with no test, ${summary.notFound} test names not found`);
}

// ---------------------------------------------------------------------------------------------
// CLI

function flags(args: string[], name: string): string[] {
  return args.flatMap((arg, i) => (arg === `--${name}` && args[i + 1] !== undefined ? [args[i + 1]!] : []));
}

export function main(args: string[] = process.argv.slice(2)) {
  const root = resolve(flags(args, "root")[0] ?? process.cwd());
  const csvDir = resolve(root, flags(args, "csv-dir")[0] ?? "documentation/traceability");
  const cardsDir = resolve(root, flags(args, "cards")[0] ?? "tests");
  const out = flags(args, "out")[0];

  const { results, files } = loadResults(flags(args, "results").map((p) => resolve(root, p)), root);
  const matrix = buildMatrix(loadCriterionRows(csvDir), results, loadCards(cardsDir, root), files);

  if (out) {
    mkdirSync(resolve(root, out), { recursive: true });
    writeFileSync(resolve(root, out, "traceability-matrix.md"), renderMarkdown(matrix));
    writeFileSync(resolve(root, out, "traceability-matrix.html"), renderHtml(matrix));
    writeFileSync(resolve(root, out, "traceability-matrix.json"), JSON.stringify(matrix, null, 2));
    console.error(`Wrote the matrix for ${matrix.stories.length} stories to ${out}`);
  }
  if (args.includes("--annotate")) for (const line of mismatchAnnotations(matrix)) console.log(line);
  if (args.includes("--summary")) console.log(renderSummary(matrix));
}

const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main();
}
