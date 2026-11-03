#!/usr/bin/env node
/**
 * Brings the Status cell of every test card in tests/<STORY>/*.md into line with
 * implementation.md §8.4, which allows exactly four values: Pass, Fail, Not Executed, Blocked.
 *
 * Some automated cards were recorded as `Pass (automated, API level)`. The qualifier is useful, but
 * it does not belong in Status. This sets Status to `Pass` and moves the qualifier to the front of
 * Remarks:
 *
 *   | Status  | Pass (automated, API level) |      | Status  | Pass |
 *   | Remarks | Commit: abc1234 · …         |  →   | Remarks | Automated (API level) · Commit: abc1234 · … |
 *
 * Nothing else in a card changes, and each file keeps the line endings it has (CRLF or LF). A
 * Status it does not recognise is reported and left alone, never guessed at.
 *
 * Usage: tsx documentation/scripts/normalise-card-status.ts [--check] [--root <dir>]
 *   --root   the folder of story folders, default ./tests
 *   --check  change nothing; exit 1 if any card would change or has a Status it cannot read
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

/** The only values §8.4 allows in the Status cell. */
export const ALLOWED_STATUSES = ["Pass", "Fail", "Not Executed", "Blocked"] as const;

const EXECUTION_HEADING = "## Execution record";
const STATUS_ROW = /^\| Status \| (.*) \|$/;
const REMARKS_ROW = /^\| Remarks \| (.*) \|$/;
const QUALIFIED_PASS = /^Pass \(automated, ([^()]+)\)$/;

export interface CardResult {
  /** The card's new text; identical to the input when nothing changed. */
  text: string;
  /** What was moved out of Status, e.g. "Automated (API level)", or null if Status was already fine. */
  qualifier: string | null;
  /** The Status text this could not read, or null. */
  unreadable: string | null;
}

/** "automated, API level" becomes "Automated (API level)". */
function remarkPrefix(detail: string): string {
  return `Automated (${detail.trim()})`;
}

/** Normalises one card. Only the Status and Remarks rows of the Execution record can change. */
export function normaliseCard(text: string): CardResult {
  const parts = text.split(/(\r\n|\n)/); // content, separator, content, ...
  const lineAt = (i: number): string => parts[i * 2] ?? "";
  const lineCount = Math.ceil(parts.length / 2);
  let heading = -1;
  for (let i = 0; i < lineCount; i++) {
    if (lineAt(i) === EXECUTION_HEADING) heading = i;
  }
  const unchanged: CardResult = { text, qualifier: null, unreadable: null };
  if (heading === -1) return unchanged;

  let statusAt = -1;
  let remarksAt = -1;
  for (let i = heading + 1; i < lineCount; i++) {
    if (statusAt === -1 && STATUS_ROW.test(lineAt(i))) statusAt = i;
    if (remarksAt === -1 && REMARKS_ROW.test(lineAt(i))) remarksAt = i;
  }
  if (statusAt === -1) return unchanged;

  const status = STATUS_ROW.exec(lineAt(statusAt))![1];
  if ((ALLOWED_STATUSES as readonly string[]).includes(status)) return unchanged;

  const qualified = QUALIFIED_PASS.exec(status);
  if (!qualified || remarksAt === -1) return { text, qualifier: null, unreadable: status };

  const prefix = remarkPrefix(qualified[1]);
  const remarks = REMARKS_ROW.exec(lineAt(remarksAt))![1];
  const next = [...parts];
  next[statusAt * 2] = "| Status | Pass |";
  next[remarksAt * 2] = remarks.startsWith(`${prefix} · `) ? lineAt(remarksAt) : `| Remarks | ${prefix} · ${remarks} |`;
  return { text: next.join(""), qualifier: prefix, unreadable: null };
}

export interface FileResult extends CardResult {
  file: string;
  /** The story folder, e.g. "O1". */
  story: string;
}

/** Normalises every tests/<STORY>/*.md under `root`, writing changed cards unless `write` is false. */
export function normaliseCards(root: string, write: boolean): FileResult[] {
  const results: FileResult[] = [];
  for (const story of readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort()) {
    for (const name of readdirSync(join(root, story)).filter((n) => /^[^/]+-T\d+-.+\.md$/.test(n)).sort()) {
      const file = join(root, story, name);
      const result = normaliseCard(readFileSync(file, "utf8"));
      if (write && result.text !== readFileSync(file, "utf8")) writeFileSync(file, result.text);
      if (result.qualifier !== null || result.unreadable !== null) results.push({ ...result, file, story });
    }
  }
  return results;
}

/** The changed cards grouped by story, as "O1 (25): O1-T1, ..." lines for a PR body. */
export function summariseByStory(results: FileResult[]): string[] {
  const byStory = new Map<string, string[]>();
  for (const r of results.filter((x) => x.qualifier !== null)) {
    const id = /(?:^|[\\/])([^\\/]+?-T\d+)-[^\\/]+\.md$/.exec(r.file)?.[1] ?? r.file;
    byStory.set(r.story, [...(byStory.get(r.story) ?? []), id]);
  }
  return [...byStory.entries()].map(([story, ids]) => `${story} (${ids.length}): ${ids.join(", ")}`);
}

function main(): void {
  const args = process.argv.slice(2);
  const check = args.includes("--check");
  const rootFlag = args.indexOf("--root");
  const root = rootFlag === -1 ? "tests" : args[rootFlag + 1];
  const results = normaliseCards(root, !check);
  const unreadable = results.filter((r) => r.unreadable !== null);
  for (const r of unreadable) console.error(`${r.file}: cannot read Status "${r.unreadable}"; left alone`);
  for (const line of summariseByStory(results)) console.log(line);
  const changed = results.filter((r) => r.qualifier !== null).length;
  console.log(`${changed} card(s) ${check ? "would change" : "changed"}.`);
  if (unreadable.length > 0 || (check && changed > 0)) process.exit(1);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
