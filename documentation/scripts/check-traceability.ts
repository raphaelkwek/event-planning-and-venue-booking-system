#!/usr/bin/env node
/**
 * Checks that every row of documentation/traceability/sprint-<n>/<STORY>.csv points at a test that exists.
 *
 * A row is `story_id,acceptance_criterion,test_file,test_name`. It is only worth having if a
 * reader can open `test_file` and find `test_name` there, so this fails when
 *   - a row does not have exactly four fields (usually an unquoted comma in a test name);
 *   - `test_file` does not exist;
 *   - `test_name` is not the title of an `it(...)` / `test(...)` in that file; for a manual
 *     test card (a `.md` file) it must be the card's own heading instead.
 *
 * A criterion that a later story took away keeps its row, with a marker in place of a test name:
 *   SUPERSEDED by E4 (W9-FX-5)
 * The marker says which story replaced it and which change did it. It is deliberately not a test
 * name, so it can never be mistaken for one, and the check lets it through without looking.
 *
 * Usage: tsx documentation/scripts/check-traceability.ts [--root <repo>]
 */
import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { SUPERSEDED_MARKER, traceabilityFiles } from "./traceability-matrix.ts";

export interface TraceRow {
  /** 1-based line of the file the row starts on. */
  line: number;
  fields: string[];
}

export interface Problem {
  file: string;
  line: number;
  story: string;
  message: string;
}

export const TRACE_HEADER = ["story_id", "acceptance_criterion", "test_file", "test_name"];

/** `SUPERSEDED by <story> (<change>)`: a criterion that a later story retired. The matrix reads it too. */
export { SUPERSEDED_MARKER };

/** Splits CSV text into rows of fields (RFC 4180: quotes, doubled quotes, newlines in quotes). */
export function parseCsvRows(text: string): TraceRow[] {
  const rows: TraceRow[] = [];
  let fields: string[] = [];
  let field = "";
  let quoted = false;
  let line = 1;
  let rowLine = 1;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "\n") line++;
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      fields.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      if (ch === "\r") line++;
      fields.push(field);
      rows.push({ line: rowLine, fields });
      fields = [];
      field = "";
      rowLine = line;
    } else {
      field += ch;
    }
  }
  if (field !== "" || fields.length > 0) {
    fields.push(field);
    rows.push({ line: rowLine, fields });
  }
  return rows;
}

/**
 * `it`, `test` or `describe`, optional modifiers (`.each([...])`, `.skip`, and a typed
 * `.each<[string, number]>([...])`), then a quoted title.
 */
const TEST_CALL =
  /\b(it|test|describe)(?:\.[a-zA-Z]+(?:<[^()]*>)?(?:\((?:[^()]|\([^()]*\))*\))?)*\s*\(\s*(["'`])((?:\\[\s\S]|(?!\2)[^\\])*)\2/g;

/** A title as written in the source, and whether it has holes: `${...}` or an `it.each` placeholder. */
export interface Title {
  text: string;
  hasHoles: boolean;
}

const HOLE = /\$\{[^}]*\}|%[sdijfoOp]/g;

/** The titles of every `describe` call, or of every `it` / `test` call. */
export function extractTitles(source: string, kind: "describe" | "test"): Title[] {
  return [...source.matchAll(TEST_CALL)]
    .filter((match) => (match[1] === "describe") === (kind === "describe"))
    .map((match) => {
      const text = match[3].replace(/\\(.)/g, "$1");
      return { text, hasHoles: new RegExp(HOLE.source).test(text) };
    });
}

/** A title with holes keeps its fixed text, and that must be enough to mean something. */
const MIN_FIXED_TEXT = 8;

/** Whether the source has `value` as a quoted string, which is where a table-driven title comes from. */
function isQuotedIn(source: string, value: string): boolean {
  return ["\"", "'", "`"].some((quote) => source.includes(quote + value + quote));
}

/**
 * A title with holes ("%s deploys", "${card} ${name}") names the tests a loop or table makes. The
 * name matches if its fixed text does and, when there is little fixed text, if each value filling a
 * hole is a string the file really contains.
 */
function holeTitleMatches(source: string, title: string, name: string): boolean {
  const parts = title.split(HOLE);
  const escaped = parts.map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const match = new RegExp("^" + escaped.join("(.+?)") + "$").exec(name);
  if (!match) return false;
  if (parts.join("").length >= MIN_FIXED_TEXT) return true;
  return match.slice(1).every((value) => isQuotedIn(source, value));
}

/**
 * Whether `name` is the title of a test in `source`: an `it`/`test` title as written, a `describe`
 * title and an `it` title joined by a space (how a runner names the test), or a title built with
 * `${...}` whose fixed text matches.
 */
export function hasTest(source: string, name: string): boolean {
  const tests = extractTitles(source, "test");
  const suites = extractTitles(source, "describe");
  return tests.some(
    (t) =>
      t.text === name ||
      (t.hasHoles && holeTitleMatches(source, t.text, name)) ||
      suites.some((s) => `${s.text} ${t.text}` === name),
  );
}

/** The text after "# " on a test card's first heading line. */
export function cardHeading(markdown: string): string | null {
  const match = markdown.match(/^# (.+?)\s*$/m);
  return match ? match[1] : null;
}

/** Checks one story file's text. `read` returns a file's text, or null if it does not exist. */
export function checkTraceability(
  file: string,
  csv: string,
  read: (path: string) => string | null,
): Problem[] {
  const problems: Problem[] = [];
  const rows = parseCsvRows(csv);
  const problem = (row: TraceRow, message: string): void => {
    problems.push({ file, line: row.line, story: row.fields[0] ?? "", message });
  };

  rows.forEach((row, index) => {
    if (index === 0) {
      if (row.fields.join(",") !== TRACE_HEADER.join(",")) problem(row, `header is not ${TRACE_HEADER.join(",")}`);
      return;
    }
    if (row.fields.length === 1 && row.fields[0] === "") return;
    if (row.fields.length !== TRACE_HEADER.length) {
      problem(row, `has ${row.fields.length} fields, not 4 (quote a test name that contains a comma)`);
      return;
    }
    const [, , testFile, testName] = row.fields;
    if (SUPERSEDED_MARKER.test(testName)) return;

    const text = read(testFile);
    if (text === null) {
      problem(row, `test_file ${testFile} does not exist`);
      return;
    }
    if (testFile.endsWith(".md")) {
      if (cardHeading(text) !== testName) problem(row, `${testFile} has no heading "${testName}"`);
      return;
    }
    if (!hasTest(text, testName)) problem(row, `no test titled "${testName}" in ${testFile}`);
  });
  return problems;
}

/**
 * Checks every story's file under documentation/traceability/ in a checkout: sprint-<n>/<STORY>.csv,
 * found the way the matrix finds them (traceabilityFiles), so the two never read different files. A
 * sprint-<n>.csv from before 3 Nov 2026 makes it throw rather than be skipped.
 */
export function checkRepository(root: string): Problem[] {
  const dir = join(root, "documentation", "traceability");
  const read = (path: string): string | null => {
    const full = join(root, path);
    return existsSync(full) ? readFileSync(full, "utf8") : null;
  };
  return traceabilityFiles(dir).flatMap(({ path }) =>
    checkTraceability(relative(root, path).replace(/\\/g, "/"), readFileSync(path, "utf8"), read),
  );
}

function main(): void {
  const rootFlag = process.argv.indexOf("--root");
  const root = rootFlag === -1 ? process.cwd() : process.argv[rootFlag + 1];
  const problems = checkRepository(root);
  for (const p of problems) console.error(`${p.file}:${p.line} (${p.story}) ${p.message}`);
  if (problems.length > 0) {
    console.error(`${problems.length} traceability row(s) point at a test that does not exist.`);
    process.exit(1);
  }
  console.log("Every traceability row points at a test that exists.");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
