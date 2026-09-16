#!/usr/bin/env node
/**
 * Turns CHANGELOG.md into a Confluence-pasteable table (Date | Author | Item | Notes).
 *
 * CHANGELOG.md is the single point of authorship for "what got done, when" — this script
 * derives the Confluence sprint table from it instead of that table being hand-typed a
 * second time. Run it whenever you're ready to update Confluence; paste stdout straight
 * into a Confluence page (it auto-converts pasted markdown tables) or write it to a file
 * with --out.
 *
 * Usage:
 *   tsx scripts/confluence-digest.ts [--since <date>] [--order asc|desc] [--file <path>] [--out <path>]
 *
 *   --since   Only include entries timestamped at/after this date (any Date.parse-able value).
 *   --order   asc (chronological, default) or desc (newest-first, matching CHANGELOG.md itself).
 *   --file    Changelog to read. Defaults to CHANGELOG.md in the current directory.
 *   --out     Write the table to this file instead of stdout.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export interface ChangelogEntry {
  title: string;
  timestamp: string;
  timestampMs: number | null;
  author: string;
  notes: string;
}

/** Parses a CHANGELOG.md timestamp like "2026-09-16T16:23+08:00 (SGT)" into epoch ms. */
export function parseTimestamp(raw: string): number | null {
  const cleaned = raw.replace(/\s*\([^)]*\)\s*$/, "").trim();
  const ms = Date.parse(cleaned);
  return Number.isNaN(ms) ? null : ms;
}

/**
 * An entry boundary is a standalone "---" line immediately (ignoring blank lines)
 * followed by an H1 ("# Title"). CHANGELOG.md entries use "---" as an internal
 * sub-divider too (e.g. before "## Net effect"), so a bare "---" alone is not enough.
 */
function isEntryBoundary(lines: string[], i: number): boolean {
  if (lines[i].trim() !== "---") return false;
  for (let j = i + 1; j < lines.length; j++) {
    const line = lines[j];
    if (line.trim() === "") continue;
    return /^# \S/.test(line);
  }
  return false;
}

/**
 * Reads a "**Label:** value" field, joining any wrapped continuation lines (this
 * changelog's Reason/Scope paragraphs often wrap without a blank line). Stops at the
 * first blank line, the next "**Label:**" field, or a heading.
 */
function extractField(block: string, label: string): string | null {
  const lines = block.split("\n");
  const labelRe = new RegExp(`^\\*\\*${label}:\\*\\*\\s*(.*)$`);

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(labelRe);
    if (!match) continue;

    const parts = [match[1]];
    for (let j = i + 1; j < lines.length; j++) {
      const line = lines[j];
      if (line.trim() === "") break;
      if (/^\*\*[^*]+:\*\*/.test(line)) break;
      if (/^#{1,6}\s/.test(line)) break;
      parts.push(line);
    }
    return parts.join(" ").replace(/\s+/g, " ").trim();
  }
  return null;
}

function parseEntryBlock(block: string): ChangelogEntry | null {
  const titleMatch = block.match(/^\s*# (.+)$/m);
  if (!titleMatch) return null;

  const timestamp = extractField(block, "Timestamp") ?? "";

  return {
    title: titleMatch[1].trim(),
    timestamp,
    timestampMs: timestamp ? parseTimestamp(timestamp) : null,
    author: extractField(block, "Author") ?? "",
    notes: extractField(block, "Reason") ?? extractField(block, "Scope") ?? "",
  };
}

/** Splits CHANGELOG.md into one entry per top-level (newest-first) section. */
export function parseChangelog(markdown: string): ChangelogEntry[] {
  const lines = markdown.split("\n");
  const boundaries: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (isEntryBoundary(lines, i)) boundaries.push(i);
  }

  const entries: ChangelogEntry[] = [];
  for (let k = 0; k < boundaries.length; k++) {
    const start = boundaries[k] + 1;
    const end = k + 1 < boundaries.length ? boundaries[k + 1] : lines.length;
    const entry = parseEntryBlock(lines.slice(start, end).join("\n"));
    if (entry) entries.push(entry);
  }
  return entries;
}

export function filterSince(entries: ChangelogEntry[], sinceMs: number | null): ChangelogEntry[] {
  if (sinceMs === null) return entries;
  return entries.filter((e) => e.timestampMs !== null && e.timestampMs >= sinceMs);
}

export function sortEntries(entries: ChangelogEntry[], order: "asc" | "desc"): ChangelogEntry[] {
  const sorted = [...entries].sort((a, b) => (a.timestampMs ?? 0) - (b.timestampMs ?? 0));
  return order === "desc" ? sorted.reverse() : sorted;
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ").trim();
}

export function formatTable(entries: ChangelogEntry[]): string {
  const header = "| Date | Author | Item | Notes |\n|---|---|---|---|";
  const rows = entries.map(
    (e) => `| ${escapeCell(e.timestamp)} | ${escapeCell(e.author)} | ${escapeCell(e.title)} | ${escapeCell(e.notes)} |`,
  );
  return [header, ...rows].join("\n");
}

function getFlag(args: string[], name: string, fallback?: string): string | undefined {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
}

function main() {
  const args = process.argv.slice(2);
  const file = getFlag(args, "file", "CHANGELOG.md") as string;
  const order = getFlag(args, "order", "asc") as "asc" | "desc";
  const sinceRaw = getFlag(args, "since");
  const outPath = getFlag(args, "out");

  const markdown = readFileSync(file, "utf8");
  let entries = parseChangelog(markdown);

  if (sinceRaw) {
    const cutoff = parseTimestamp(sinceRaw);
    if (cutoff === null) {
      console.error(`Could not parse --since value: ${sinceRaw}`);
      process.exit(1);
    }
    entries = filterSince(entries, cutoff);
  }

  entries = sortEntries(entries, order);
  const table = formatTable(entries);

  if (outPath) {
    writeFileSync(outPath, table + "\n", "utf8");
    console.error(`Wrote ${entries.length} entries to ${outPath}`);
  } else {
    console.log(table);
  }
}

const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main();
}
