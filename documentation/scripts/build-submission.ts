#!/usr/bin/env node
/**
 * Builds the spreadsheets in submission/ from the files the team already maintains, so the
 * Week 12 zip never holds a second, hand-typed copy that drifts from the source.
 *
 *   tests/<story>/*.md                      → 3. Test Cases/Functional Test Cases.xlsx
 *   documentation/traceability/sprint-*.csv → 3. Test Cases/Automated Test Traceability.xlsx
 *   final user stories.md + sprint allocation.csv + plan.md §9
 *                                           → 4. Sprint Meetings/3. Sprint Backlogs.xlsx
 *   CHANGELOG.md                            → 4. Sprint Meetings/2. Sprint Updates.xlsx
 *
 * It also copies the sprint review/retrospective and the meeting transcripts into
 * 4. Sprint Meetings/, for the same reason. Hand-written files in submission/ are never touched.
 *
 * Usage: npm run submission:build
 */
import { readFileSync, readdirSync, existsSync, mkdirSync, copyFileSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import ExcelJS from "exceljs";
import { parseChangelog, sortEntries, standupName, type ChangelogEntry } from "./confluence-digest.ts";

// ---------------------------------------------------------------------------------------------
// Sprint calendar. Add a row when a sprint is planned; mark it reviewed after its Sprint Review.
// ---------------------------------------------------------------------------------------------

export interface SprintWindow {
  sprint: number;
  /** First day of the sprint, YYYY-MM-DD in SGT. The sprint runs until the next one starts. */
  start: string;
  /** True once the Sprint Review has been held; its stories then show as Done. */
  reviewed: boolean;
}

/** Sprint 1 dates are from the Sprint 1 Confluence page; Sprint 2 starts Monday of Week 6. */
export const SPRINTS: SprintWindow[] = [
  { sprint: 1, start: "2026-09-07", reviewed: true },
  { sprint: 2, start: "2026-09-21", reviewed: false },
];

/** "YYYY-MM-DD HH:mm" in SGT, whatever offset the CHANGELOG entry was written with. */
export function formatSgt(ms: number): string {
  return new Date(ms + 8 * 3600_000).toISOString().slice(0, 16).replace("T", " ");
}

/** Which sprint an instant falls in, or null if it is before Sprint 1. */
export function sprintForInstant(ms: number, sprints: SprintWindow[] = SPRINTS): number | null {
  let found: number | null = null;
  for (const s of sprints) {
    if (ms >= Date.parse(`${s.start}T00:00:00+08:00`)) found = s.sprint;
  }
  return found;
}

// ---------------------------------------------------------------------------------------------
// Markdown helpers
// ---------------------------------------------------------------------------------------------

/** Splits one markdown table row into cells, honouring "\|" as a literal pipe. */
export function splitTableRow(line: string): string[] {
  const inner = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return inner.split(/(?<!\\)\|/).map((c) => c.replace(/\\\|/g, "|").trim());
}

/** Turns inline markdown into spreadsheet-friendly plain text. */
export function plainText(md: string): string {
  return md
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .trim();
}

// ---------------------------------------------------------------------------------------------
// Functional test cards (tests/<story>/<story>-T<n>-<slug>.md, format in implementation.md §8.4)
// ---------------------------------------------------------------------------------------------

export interface TestCard {
  id: string;
  story: string;
  number: number;
  scenario: string;
  preconditions: string;
  steps: string;
  testData: string;
  expected: string;
  createdBy: string;
  dateCreated: string;
  actual: string;
  status: string;
  remarks: string;
  executedBy: string;
  dateExecuted: string;
  file: string;
}

const CARD_FIELDS: Record<string, keyof TestCard> = {
  "Test Case ID": "id",
  "Test Scenario": "scenario",
  "Pre-conditions": "preconditions",
  "Test Steps": "steps",
  "Test Data": "testData",
  "Expected Result": "expected",
  "Created By": "createdBy",
  "Date of Creation": "dateCreated",
  "Actual Result": "actual",
  Status: "status",
  Remarks: "remarks",
  "Executed By": "executedBy",
  "Date of Execution": "dateExecuted",
};

export function parseTestCard(markdown: string, file: string): TestCard {
  const card: Record<string, unknown> = { file };
  for (const line of markdown.split("\n")) {
    if (!line.startsWith("|")) continue;
    const [label, value = ""] = splitTableRow(line);
    const key = CARD_FIELDS[label];
    if (key) card[key] = plainText(value);
  }
  const id = String(card.id ?? "");
  const match = id.match(/^(.+)-T(\d+)$/);
  if (!match) throw new Error(`${file}: Test Case ID "${id}" is not <story>-T<n>`);
  card.story = match[1];
  card.number = Number(match[2]);
  for (const key of Object.values(CARD_FIELDS)) card[key] ??= "";
  return card as unknown as TestCard;
}

/** Orders cards by story (A1, A2 … T2) and then by test number, so T10 follows T9. */
export function compareCards(a: TestCard, b: TestCard): number {
  return a.story.localeCompare(b.story, "en", { numeric: true }) || a.number - b.number;
}

// ---------------------------------------------------------------------------------------------
// User stories (documentation/final user stories.md)
// ---------------------------------------------------------------------------------------------

export interface UserStory {
  id: string;
  title: string;
  feature: string;
  story: string;
  acceptanceCriteria: string[];
}

export function parseUserStories(markdown: string): UserStory[] {
  const stories: UserStory[] = [];
  let feature = "";
  let current: UserStory | null = null;
  let inCriteria = false;

  for (const raw of markdown.split("\n")) {
    const line = raw.trim();
    const featureMatch = line.match(/^### \*\*Feature \d+ — (.+?)\*\*/);
    if (featureMatch) {
      feature = featureMatch[1];
      current = null;
      continue;
    }
    const storyMatch = line.match(/^#### \*\*([A-Z]\d+) — (.+?)\*\*/);
    if (storyMatch) {
      current = { id: storyMatch[1], title: storyMatch[2], feature, story: "", acceptanceCriteria: [] };
      stories.push(current);
      inCriteria = false;
      continue;
    }
    if (!current) continue;
    if (line.startsWith("**User Story:**")) {
      current.story = plainText(line.replace("**User Story:**", ""));
    } else if (line === "**Acceptance Criteria**") {
      inCriteria = true;
    } else if (/^#{1,6}\s/.test(line) || line === "---") {
      inCriteria = false;
    } else if (inCriteria && line.startsWith("* ")) {
      current.acceptanceCriteria.push(plainText(line.slice(2)));
    }
  }
  return stories;
}

// ---------------------------------------------------------------------------------------------
// CSV (sprint allocation, traceability) and plan.md §9
// ---------------------------------------------------------------------------------------------

/** Minimal RFC 4180 reader: quoted fields may contain commas and doubled quotes. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
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
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [header, ...body] = rows.filter((r) => r.some((c) => c.trim() !== ""));
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? "").trim()])));
}

export interface PlannedSprint {
  sprint: number;
  weeks: string;
  theme: string;
  stories: string[];
  points: number;
}

/** Reads the sprint sequence table in plan.md §9 (| Sprint | Weeks | Theme | Stories | Points |). */
export function parsePlanSprints(markdown: string): PlannedSprint[] {
  const sprints: PlannedSprint[] = [];
  for (const line of markdown.split("\n")) {
    if (!/^\|\s*\d+\s*\|/.test(line)) continue;
    const [sprint, weeks, theme, stories, points] = splitTableRow(line);
    sprints.push({
      sprint: Number(sprint),
      weeks,
      theme: theme.replace(/\*/g, "").trim(),
      stories: stories.split(",").map((s) => s.trim()).filter(Boolean),
      points: Number(points.replace(/\*/g, "")),
    });
  }
  return sprints;
}

// ---------------------------------------------------------------------------------------------
// Spreadsheet styling
// ---------------------------------------------------------------------------------------------

const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E79" } };
const LABEL_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9E1F2" } };
const STATUS_FILLS: Record<string, string> = {
  Pass: "FFC6EFCE",
  Fail: "FFFFC7CE",
  Blocked: "FFFFEB9C",
  "Not Executed": "FFEDEDED",
  Done: "FFC6EFCE",
  Removed: "FFEDEDED",
};
const THIN: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FFBFBFBF" } },
  left: { style: "thin", color: { argb: "FFBFBFBF" } },
  bottom: { style: "thin", color: { argb: "FFBFBFBF" } },
  right: { style: "thin", color: { argb: "FFBFBFBF" } },
};

interface Column {
  header: string;
  width: number;
}

/** Writes a styled header row and returns its row number. */
function writeHeader(ws: ExcelJS.Worksheet, rowNumber: number, columns: Column[]): number {
  columns.forEach((c, i) => (ws.getColumn(i + 1).width = c.width));
  const row = ws.getRow(rowNumber);
  row.values = columns.map((c) => c.header);
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = HEADER_FILL;
    cell.alignment = { vertical: "middle", wrapText: true };
    cell.border = THIN;
  });
  ws.views = [{ state: "frozen", ySplit: rowNumber }];
  ws.autoFilter = { from: { row: rowNumber, column: 1 }, to: { row: rowNumber, column: columns.length } };
  return rowNumber;
}

function addBodyRow(ws: ExcelJS.Worksheet, values: (string | number)[], statusColumn?: number): ExcelJS.Row {
  const row = ws.addRow(values);
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.alignment = { vertical: "top", wrapText: true };
    cell.border = THIN;
  });
  if (statusColumn) {
    const cell = row.getCell(statusColumn);
    const fill = STATUS_FILLS[String(cell.value)];
    if (fill) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
  }
  return row;
}

/** The "Created By: / Date of Creation:" block the seniors' test scripts open with. */
function writeLabelBlock(ws: ExcelJS.Worksheet, pairs: [string, string][]): number {
  pairs.forEach(([label, value], i) => {
    const row = ws.getRow(i + 1);
    row.getCell(1).value = label;
    row.getCell(1).font = { bold: true };
    row.getCell(1).fill = LABEL_FILL;
    row.getCell(2).value = value;
    ws.mergeCells(i + 1, 2, i + 1, 6);
  });
  return pairs.length;
}

/** Excel sheet names: at most 31 characters, none of \ / ? * [ ] : */
export function sheetName(name: string): string {
  return name.replace(/[\\/?*[\]:]/g, "-").slice(0, 31);
}

const distinct = (values: string[]) => [...new Set(values.map((v) => v.trim()).filter(Boolean))];

function dateRange(values: string[]): string {
  const dates = distinct(values).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  if (!dates.length) return "—";
  return dates[0] === dates[dates.length - 1] ? dates[0] : `${dates[0]} to ${dates[dates.length - 1]}`;
}

// ---------------------------------------------------------------------------------------------
// Workbooks
// ---------------------------------------------------------------------------------------------

interface Allocation {
  id: string;
  title: string;
  featureArea: string;
  sprint: number | null;
  weeks: string;
  oldPoints: string;
  points: string;
  change: string;
  reason: string;
}

function toAllocation(r: Record<string, string>): Allocation {
  return {
    id: r["ID"],
    title: r["Story"],
    featureArea: r["Feature Area"],
    sprint: r["New Sprint"] ? Number(r["New Sprint"]) : null,
    weeks: r["New Weeks"],
    oldPoints: r["Old Points"],
    points: r["New Points"],
    change: r["Change"],
    reason: r["Reason"],
  };
}

/** Status is only as good as the calendar above: Done once the sprint is reviewed, never guessed. */
export function storyStatus(a: Pick<Allocation, "sprint" | "change">, sprints: SprintWindow[] = SPRINTS): string {
  if (a.change === "Removed" || a.sprint === null) return "Removed";
  const window = sprints.find((s) => s.sprint === a.sprint);
  if (!window) return "To Do";
  return window.reviewed ? "Done" : "In Sprint";
}

export function buildFunctionalTestWorkbook(cards: TestCard[], allocations: Allocation[], stories: UserStory[]) {
  const wb = new ExcelJS.Workbook();
  const byStory = new Map(allocations.map((a) => [a.id, a]));
  const titleOf = (id: string) => stories.find((s) => s.id === id)?.title ?? byStory.get(id)?.title ?? "";

  // Summary: one row per story, so a grader can see coverage and results before opening a sheet.
  const summary = wb.addWorksheet("Summary");
  const statuses = ["Pass", "Fail", "Blocked", "Not Executed"];
  writeHeader(summary, 1, [
    { header: "Story", width: 8 },
    { header: "Title", width: 48 },
    { header: "Feature Area", width: 28 },
    { header: "Sprint", width: 8 },
    { header: "Acceptance Criteria", width: 12 },
    { header: "Test Cases", width: 11 },
    ...statuses.map((s) => ({ header: s, width: 12 })),
  ]);
  const storyIds = distinct(cards.map((c) => c.story)).sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
  for (const id of storyIds) {
    const own = cards.filter((c) => c.story === id);
    addBodyRow(summary, [
      id,
      titleOf(id),
      byStory.get(id)?.featureArea ?? "",
      byStory.get(id)?.sprint ?? "",
      stories.find((s) => s.id === id)?.acceptanceCriteria.length ?? "",
      own.length,
      ...statuses.map((s) => own.filter((c) => c.status === s).length),
    ]);
  }
  const total = summary.addRow(["Total", "", "", "", "", cards.length, ...statuses.map((s) => cards.filter((c) => c.status === s).length)]);
  total.font = { bold: true };

  // One sheet per feature area, laid out like the seniors' test scripts.
  const areas = distinct(storyIds.map((id) => byStory.get(id)?.featureArea ?? id));
  for (const area of areas) {
    const areaCards = cards.filter((c) => (byStory.get(c.story)?.featureArea ?? c.story) === area);
    const ws = wb.addWorksheet(sheetName(area));
    const blockRows = writeLabelBlock(ws, [
      ["Feature Area:", area],
      ["Stories:", distinct(areaCards.map((c) => c.story)).join(", ")],
      ["Created By:", distinct(areaCards.map((c) => c.createdBy)).join(", ") || "—"],
      ["Date of Creation:", dateRange(areaCards.map((c) => c.dateCreated))],
      ["Executed By:", distinct(areaCards.map((c) => c.executedBy)).join(", ") || "—"],
      ["Date of Execution:", dateRange(areaCards.map((c) => c.dateExecuted))],
      ["Standard environment, accounts and setup procedures:", "tests/README.md"],
    ]);
    const headerRow = writeHeader(ws, blockRows + 2, [
      { header: "Title", width: 26 },
      { header: "Test Case ID", width: 11 },
      { header: "Test Scenario", width: 34 },
      { header: "Pre-conditions", width: 40 },
      { header: "Test Steps", width: 48 },
      { header: "Test Data", width: 34 },
      { header: "Expected Result", width: 48 },
      { header: "Actual Result", width: 48 },
      { header: "Status", width: 13 },
      { header: "Remarks", width: 34 },
      { header: "Created By", width: 16 },
      { header: "Date of Creation", width: 12 },
      { header: "Executed By", width: 16 },
      { header: "Date of Execution", width: 12 },
      { header: "Source", width: 40 },
    ]);
    ws.views = [{ state: "frozen", ySplit: headerRow, xSplit: 2 }];
    let previousStory = "";
    for (const c of areaCards) {
      addBodyRow(
        ws,
        [
          c.story === previousStory ? "" : `${c.story} — ${titleOf(c.story)}`,
          c.id,
          c.scenario,
          c.preconditions,
          c.steps,
          c.testData,
          c.expected,
          c.actual,
          c.status,
          c.remarks,
          c.createdBy,
          c.dateCreated,
          c.executedBy,
          c.dateExecuted,
          c.file,
        ],
        9,
      );
      previousStory = c.story;
    }
  }
  return wb;
}

export function buildTraceabilityWorkbook(sprintRows: Map<number, Record<string, string>[]>, stories: UserStory[]) {
  const wb = new ExcelJS.Workbook();

  const summary = wb.addWorksheet("Summary");
  writeHeader(summary, 1, [
    { header: "Story", width: 8 },
    { header: "Title", width: 48 },
    { header: "Sprint file", width: 12 },
    { header: "ACs in story", width: 12 },
    { header: "ACs traced", width: 12 },
    { header: "Test rows", width: 11 },
    { header: "Test files", width: 60 },
  ]);

  for (const [sprint, rows] of sprintRows) {
    const ws = wb.addWorksheet(`Sprint ${sprint}`);
    writeHeader(ws, 1, [
      { header: "Story", width: 8 },
      { header: "Acceptance Criterion", width: 70 },
      { header: "Test File", width: 55 },
      { header: "Test Name", width: 60 },
    ]);
    for (const r of rows) addBodyRow(ws, [r.story_id, r.acceptance_criterion, r.test_file, r.test_name]);

    for (const id of distinct(rows.map((r) => r.story_id))) {
      const own = rows.filter((r) => r.story_id === id);
      const story = stories.find((s) => s.id === id);
      addBodyRow(summary, [
        id,
        story?.title ?? "",
        `sprint-${sprint}.csv`,
        story?.acceptanceCriteria.length ?? "",
        distinct(own.map((r) => r.acceptance_criterion)).length,
        own.length,
        distinct(own.map((r) => r.test_file)).join("\n"),
      ]);
    }
  }
  return wb;
}

export function buildSprintBacklogWorkbook(
  allocations: Allocation[],
  stories: UserStory[],
  planned: PlannedSprint[],
  cards: TestCard[],
) {
  const wb = new ExcelJS.Workbook();
  const storyOf = (id: string) => stories.find((s) => s.id === id);
  const numbered = (acs: string[]) => acs.map((ac, i) => `${i + 1}. ${ac}`).join("\n");
  const testSummary = (id: string) => {
    const own = cards.filter((c) => c.story === id);
    if (!own.length) return "—";
    const pass = own.filter((c) => c.status === "Pass").length;
    return `${own.length} cases, ${pass} Pass`;
  };

  const pb = wb.addWorksheet("Product Backlog");
  writeHeader(pb, 1, [
    { header: "ID", width: 6 },
    { header: "Feature Area", width: 24 },
    { header: "Title", width: 36 },
    { header: "User Story", width: 50 },
    { header: "Acceptance Criteria", width: 80 },
    { header: "Story Points", width: 9 },
    { header: "Sprint", width: 8 },
    { header: "Weeks", width: 8 },
    { header: "Status", width: 11 },
    { header: "Earlier Estimate", width: 10 },
    { header: "Change", width: 20 },
    { header: "Reason", width: 60 },
  ]);
  for (const a of allocations) {
    const s = storyOf(a.id);
    addBodyRow(
      pb,
      [
        a.id,
        a.featureArea,
        s?.title ?? a.title,
        s?.story ?? "",
        s ? numbered(s.acceptanceCriteria) : "",
        a.points,
        a.sprint ?? "",
        a.weeks,
        storyStatus(a),
        a.oldPoints,
        a.change,
        a.reason,
      ],
      9,
    );
  }

  for (const p of planned) {
    const ws = wb.addWorksheet(`Sprint Backlog ${p.sprint}`);
    const window = SPRINTS.find((s) => s.sprint === p.sprint);
    const own = allocations.filter((a) => a.sprint === p.sprint);
    const committed = own.reduce((sum, a) => sum + (Number(a.points) || 0), 0);
    const blockRows = writeLabelBlock(ws, [
      [`Sprint ${p.sprint} Goal:`, p.theme],
      ["Weeks:", `${p.weeks}${window ? ` (from ${window.start})` : ""}`],
      ["Committed points:", `${committed} (plan.md §9 states ${p.points})`],
      ["Stories:", own.map((a) => a.id).join(", ")],
    ]);
    writeHeader(ws, blockRows + 2, [
      { header: "ID", width: 6 },
      { header: "Feature Area", width: 24 },
      { header: "Title", width: 36 },
      { header: "User Story", width: 50 },
      { header: "Acceptance Criteria", width: 80 },
      { header: "Story Points", width: 9 },
      { header: "Status", width: 11 },
      { header: "Functional Tests", width: 16 },
      { header: "Change", width: 20 },
      { header: "Reason", width: 60 },
    ]);
    for (const a of own) {
      const s = storyOf(a.id);
      addBodyRow(
        ws,
        [
          a.id,
          a.featureArea,
          s?.title ?? a.title,
          s?.story ?? "",
          s ? numbered(s.acceptanceCriteria) : "",
          a.points,
          storyStatus(a),
          testSummary(a.id),
          a.change,
          a.reason,
        ],
        7,
      );
    }
  }
  return wb;
}

export function buildSprintUpdatesWorkbook(entries: ChangelogEntry[]) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Sprint Updates");
  const blockRows = writeLabelBlock(ws, [
    ["Source:", "CHANGELOG.md — one row per entry, the same rows as npm run confluence:digest -- --format standup"],
    ["Format:", "Asynchronous standup (Sprint 1 planning): what I completed, what is next, what is blocking me"],
    ["Blockers / Next:", "Taken only from an entry's \"Known gap\" / \"Follow-up\" section; \"None recorded\" otherwise"],
  ]);
  writeHeader(ws, blockRows + 2, [
    { header: "Sprint No.", width: 9 },
    { header: "Date (SGT)", width: 20 },
    { header: "Name", width: 12 },
    { header: "What did I complete?", width: 50 },
    { header: "What will I do next?", width: 60 },
    { header: "Do I notice any impediment?", width: 60 },
    { header: "Why (from the entry)", width: 70 },
  ]);
  for (const e of sortEntries(entries, "asc")) {
    addBodyRow(ws, [
      e.timestampMs === null ? "" : (sprintForInstant(e.timestampMs) ?? "Pre-sprint"),
      e.timestampMs === null ? e.timestamp : formatSgt(e.timestampMs),
      standupName(e.author),
      e.title,
      e.followUps.length ? e.followUps.map(plainText).join("\n") : "None recorded",
      e.blockers.length ? e.blockers.map(plainText).join("\n") : "None recorded",
      plainText(e.notes),
    ]);
  }
  return wb;
}

// ---------------------------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------------------------

function findCards(root: string): string[] {
  const out: string[] = [];
  for (const dir of readdirSync(root, { withFileTypes: true })) {
    if (!dir.isDirectory() || dir.name === "fixtures") continue;
    for (const f of readdirSync(join(root, dir.name))) {
      if (/^.+-T\d+-.+\.md$/.test(f)) out.push(join(root, dir.name, f));
    }
  }
  return out;
}

async function main() {
  const repo = process.cwd();
  const out = join(repo, "submission");
  const read = (p: string) => readFileSync(join(repo, p), "utf8");

  const stories = parseUserStories(read("documentation/final user stories.md"));
  const allocations = parseCsv(read("documentation/sprint allocation.csv")).map(toAllocation);
  const planned = parsePlanSprints(read("documentation/planning/plan.md"));
  const cards = findCards(join(repo, "tests"))
    .map((f) => parseTestCard(readFileSync(f, "utf8"), relative(repo, f)))
    .sort(compareCards);
  const traceability = new Map<number, Record<string, string>[]>();
  for (const f of readdirSync(join(repo, "documentation/traceability")).sort()) {
    const m = f.match(/^sprint-(\d+)\.csv$/);
    if (m) traceability.set(Number(m[1]), parseCsv(read(`documentation/traceability/${f}`)));
  }
  const entries = parseChangelog(read("CHANGELOG.md"));

  const tests = join(out, "3. Test Cases");
  const meetings = join(out, "4. Sprint Meetings");
  const transcripts = join(meetings, "Transcripts");
  for (const d of [tests, meetings, transcripts]) mkdirSync(d, { recursive: true });

  const written: string[] = [];
  const save = async (wb: ExcelJS.Workbook, path: string) => {
    wb.creator = "npm run submission:build";
    await wb.xlsx.writeFile(path);
    written.push(relative(repo, path));
  };
  await save(buildFunctionalTestWorkbook(cards, allocations, stories), join(tests, "Functional Test Cases.xlsx"));
  await save(buildTraceabilityWorkbook(traceability, stories), join(tests, "Automated Test Traceability.xlsx"));
  await save(buildSprintUpdatesWorkbook(entries), join(meetings, "2. Sprint Updates.xlsx"));
  await save(buildSprintBacklogWorkbook(allocations, stories, planned, cards), join(meetings, "3. Sprint Backlogs.xlsx"));

  // Meeting records already written elsewhere in the repo: copied, never retyped.
  const copies: [string, string][] = [
    ["documentation/transcript/JIRA_sprint-1-review-retrospective.md", join(meetings, "5. Sprint 1 Review & Retrospective.md")],
  ];
  for (const f of readdirSync(join(repo, "documentation/transcript"))) {
    if (f.startsWith("SPM ")) copies.push([`documentation/transcript/${f}`, join(transcripts, f)]);
  }
  for (const [from, to] of copies) {
    if (!existsSync(join(repo, from))) throw new Error(`Missing source file: ${from}`);
    copyFileSync(join(repo, from), to);
    written.push(relative(repo, to));
  }

  console.log(
    `Built from ${cards.length} test cards, ${stories.length} stories, ${allocations.length} backlog rows, ` +
      `${[...traceability.values()].flat().length} traceability rows, ${entries.length} CHANGELOG entries:`,
  );
  for (const w of written) console.log(`  ${w}`);
}

const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
