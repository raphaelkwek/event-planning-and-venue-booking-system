#!/usr/bin/env node
/**
 * Product backlog export (Week 4 deliverable 1). Read only: it never talks to Jira. It turns raw
 * Jira search results for project SPM (the JSON the Atlassian REST API or the Atlassian MCP
 * `searchJiraIssuesUsingJql` returns, one or more files) into
 *
 *   documentation/backlog/jira-export.json   the snapshot the submission builder copies in
 *   documentation/backlog/jira-export.xlsx   the same rows for people
 *
 * Usage: npm run backlog:export -- <raw-search-result.json> [more.json …]
 *
 * The raw files must come from a search with the description, status, assignee, issuetype, parent,
 * labels and sprint/story-point fields (view "full", or `fields` naming them).
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { pathToFileURL } from "node:url";
import ExcelJS from "exceljs";

export interface BacklogIssue {
  key: string;
  type: string;
  summary: string;
  status: string;
  statusCategory: string;
  storyPoints: number | null;
  sprints: string[];
  assignee: string;
  epicKey: string;
  epicSummary: string;
  parentKey: string;
  labels: string[];
  acceptanceCriteria: string[];
  description: string;
  created: string;
  updated: string;
}

export interface BacklogSnapshot {
  project: string;
  site: string;
  source: string;
  issueCount: number;
  issues: BacklogIssue[];
}

// Jira's response shape is not ours; every field read below is checked at the point of use.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = Record<string, any>;

/** The bullet lines under an "Acceptance Criteria" heading, up to the next heading or bold label. */
export function extractAcceptanceCriteria(description: string): string[] {
  const out: string[] = [];
  let inside = false;
  for (const raw of description.split("\n")) {
    const line = raw.trim();
    if (/^\**\s*acceptance criteria\s*:?\s*\**$/i.test(line) || /^#{1,6}\s*acceptance criteria/i.test(line)) {
      inside = true;
      continue;
    }
    if (!inside) continue;
    if (/^[*-]\s+/.test(line)) out.push(line.replace(/^[*-]\s+/, "").trim());
    else if (line && (/^#{1,6}\s/.test(line) || /^\*\*[^*]+\*\*/.test(line))) inside = false;
  }
  return out;
}

const field = (f: Raw, name: string) => f.customFields?.[name]?.value;

/** Flattens one raw Jira issue. `byKey` resolves a subtask's epic through its parent story. */
export function normaliseIssue(raw: Raw, byKey: Map<string, Raw>): BacklogIssue {
  const f: Raw = raw.fields ?? {};
  const description = typeof f.description === "string" ? f.description : "";
  const type: string = f.issuetype?.name ?? "";
  const parent = f.parent;
  let epic: Raw | undefined = type === "Epic" ? undefined : parent;
  if (type === "Subtask" && parent) {
    const grand = byKey.get(parent.key)?.fields?.parent;
    epic = grand ?? parent;
  }
  const sprintValue = field(f, "Sprint");
  const points = field(f, "Story point estimate");
  return {
    key: raw.key,
    type,
    summary: f.summary ?? "",
    status: f.status?.name ?? "",
    statusCategory: f.status?.statusCategory?.name ?? "",
    storyPoints: typeof points === "number" ? points : null,
    sprints: Array.isArray(sprintValue) ? sprintValue.map((s: Raw) => String(s.name)) : [],
    assignee: f.assignee?.displayName ?? "",
    epicKey: epic?.key ?? "",
    epicSummary: epic?.fields?.summary ?? "",
    parentKey: parent?.key ?? "",
    labels: Array.isArray(f.labels) ? f.labels : [],
    acceptanceCriteria: extractAcceptanceCriteria(description),
    description,
    created: f.created ?? "",
    updated: f.updated ?? "",
  };
}

/** Merges raw result pages (a later page wins on a repeated key) and returns the sorted snapshot. */
export function buildSnapshot(pages: Raw[][], source: string): BacklogSnapshot {
  const byKey = new Map<string, Raw>();
  for (const page of pages) for (const issue of page) byKey.set(issue.key, issue);
  const issues = [...byKey.values()]
    .map((r) => normaliseIssue(r, byKey))
    .sort((a, b) => Number(a.key.split("-")[1]) - Number(b.key.split("-")[1]));
  return { project: "SPM", site: "0a39bd75-ca73-4c09-9a58-fc7ade485bc3", source, issueCount: issues.length, issues };
}

export function buildBacklogWorkbook(snapshot: BacklogSnapshot): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Product Backlog");
  const columns: [string, number][] = [
    ["Key", 10], ["Type", 9], ["Summary", 56], ["Status", 12], ["Story Points", 8], ["Sprint", 22],
    ["Assignee", 22], ["Epic", 40], ["Labels", 24], ["Acceptance Criteria", 80], ["Description", 80],
  ];
  columns.forEach(([, w], i) => (ws.getColumn(i + 1).width = w));
  const header = ws.getRow(1);
  header.values = columns.map(([h]) => h);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E79" } };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
  for (const i of snapshot.issues) {
    const row = ws.addRow([
      i.key, i.type, i.summary, i.status, i.storyPoints ?? "", i.sprints.join(", "), i.assignee,
      i.epicKey ? `${i.epicKey} ${i.epicSummary}` : "", i.labels.join(", "),
      i.acceptanceCriteria.map((a, n) => `${n + 1}. ${a}`).join("\n"), i.description,
    ]);
    row.alignment = { vertical: "top", wrapText: true };
  }
  return wb;
}

/** Loads raw search results saved either bare ({issues}) or wrapped ({data:{issues}}). */
export function readRawIssues(path: string): Raw[] {
  const parsed = JSON.parse(readFileSync(path, "utf8"));
  const issues = (parsed.data ?? parsed).issues;
  if (!Array.isArray(issues)) throw new Error(`${path}: no "issues" array`);
  return issues;
}

async function main() {
  const files = process.argv.slice(2);
  if (!files.length) throw new Error("Usage: npm run backlog:export -- <raw-search-result.json> [more.json …]");
  const snapshot = buildSnapshot(files.map(readRawIssues), "Jira project SPM, read only, exported 2026-11-04");
  const dir = join(process.cwd(), "documentation/backlog");
  mkdirSync(dirname(join(dir, "x")), { recursive: true });
  writeFileSync(join(dir, "jira-export.json"), JSON.stringify(snapshot, null, 2) + "\n");
  await buildBacklogWorkbook(snapshot).xlsx.writeFile(join(dir, "jira-export.xlsx"));
  console.log(`Exported ${snapshot.issueCount} issues to documentation/backlog/`);
}

const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
