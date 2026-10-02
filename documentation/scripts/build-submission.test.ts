import { test } from "node:test";
import assert from "node:assert/strict";
import {
  splitTableRow,
  plainText,
  parseTestCard,
  compareCards,
  parseUserStories,
  parseCsv,
  parsePlanSprints,
  sprintForInstant,
  formatSgt,
  storyStatus,
  sheetName,
  type SprintWindow,
} from "./build-submission.ts";

const card = `# B2-T3 — End time equal to the start time is refused

## Specification

| Item | Content |
|---|---|
| Test Case ID | B2-T3 |
| Test Scenario | End time equal to the start time is refused (boundary: exactly at) |
| Pre-conditions | 1. Standard environment.<br>2. Signed in as \`organiser@connectsphere.test\`. |
| Test Steps | 1. Click "New request".<br>2. Click "Submit request". |
| Test Data | Proposed end: 2 December 2026, 14:00 |
| Expected Result | Row reads EVT-1 \\| Symposium |
| Created By | Seann Khoo |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Refused with VALIDATION_FAILED |
| Status | Pass |
| Remarks | Commit: b0ef6ee · Evidence: tests/B2/evidence/B2-T3-2026-09-20.png |
| Executed By | Joash Lau Rong Wei |
| Date of Execution | 2026-09-20 |`;

test("splitTableRow keeps an escaped pipe inside its cell", () => {
  assert.deepEqual(splitTableRow("| Expected Result | a \\| b |"), ["Expected Result", "a | b"]);
});

test("plainText turns <br> into newlines and drops markdown emphasis", () => {
  assert.equal(plainText("1. **Bold** `code`<br>2. [link](http://x)"), "1. Bold code\n2. link");
});

test("parseTestCard reads both the specification and the execution record", () => {
  const c = parseTestCard(card, "tests/B2/B2-T3-x.md");
  assert.equal(c.id, "B2-T3");
  assert.equal(c.story, "B2");
  assert.equal(c.number, 3);
  assert.equal(c.steps, '1. Click "New request".\n2. Click "Submit request".');
  assert.equal(c.preconditions, "1. Standard environment.\n2. Signed in as organiser@connectsphere.test.");
  assert.equal(c.expected, "Row reads EVT-1 | Symposium");
  assert.equal(c.status, "Pass");
  assert.equal(c.executedBy, "Joash Lau Rong Wei");
  assert.equal(c.file, "tests/B2/B2-T3-x.md");
});

test("parseTestCard refuses an ID that is not <story>-T<n>", () => {
  assert.throws(() => parseTestCard("| Test Case ID | B2 |", "f.md"), /not <story>-T<n>/);
});

test("compareCards orders T10 after T9 and A2 before A10", () => {
  const mk = (story: string, number: number) => ({ story, number }) as Parameters<typeof compareCards>[0];
  const sorted = [mk("A10", 1), mk("B2", 10), mk("B2", 9), mk("A2", 1)].sort(compareCards);
  assert.deepEqual(sorted.map((c) => `${c.story}-T${c.number}`), ["A2-T1", "A10-T1", "B2-T9", "B2-T10"]);
});

test("parseUserStories reads feature, story text and every acceptance criterion", () => {
  const md = `### **Feature 1 — User Authorisation and Authentication**

#### **A1 — Log in and start a role-scoped session**

**User Story:** As a registered user, I want to log in.

**Acceptance Criteria**

* A user with valid credentials is authenticated.
* An incorrect email is rejected. ⚠ **REVISED — x**

#### **A2 — Restrict functions** ⚠ **NEW — y**

**User Story:** As a user, I want limits.

**Acceptance Criteria**

* Only one.

---

### **Feature 2 — Event Request Creation**
`;
  const stories = parseUserStories(md);
  assert.equal(stories.length, 2);
  assert.equal(stories[0].feature, "User Authorisation and Authentication");
  assert.equal(stories[0].title, "Log in and start a role-scoped session");
  assert.equal(stories[0].story, "As a registered user, I want to log in.");
  assert.deepEqual(stories[0].acceptanceCriteria, [
    "A user with valid credentials is authenticated.",
    "An incorrect email is rejected. ⚠ REVISED — x",
  ]);
  assert.equal(stories[1].title, "Restrict functions");
  assert.deepEqual(stories[1].acceptanceCriteria, ["Only one."]);
});

test("parseCsv handles quoted commas, doubled quotes and empty fields", () => {
  const rows = parseCsv('ID,Story,Reason\nA1,"Log in, then act","He said ""hi"""\nT1,Removed,\n');
  assert.deepEqual(rows, [
    { ID: "A1", Story: "Log in, then act", Reason: 'He said "hi"' },
    { ID: "T1", Story: "Removed", Reason: "" },
  ]);
});

test("parsePlanSprints reads the plan.md §9 sprint table", () => {
  const md = "| Sprint | Weeks |\n|---|---|\n| 1 | 4–5 | Foundations *(as delivered)* | A1, A2 | **47** |\n";
  assert.deepEqual(parsePlanSprints(md), [
    { sprint: 1, weeks: "4–5", theme: "Foundations (as delivered)", stories: ["A1", "A2"], points: 47 },
  ]);
});

const calendar: SprintWindow[] = [
  { sprint: 1, start: "2026-09-07", reviewed: true },
  { sprint: 2, start: "2026-09-21", reviewed: false },
];

test("sprintForInstant uses SGT day boundaries", () => {
  assert.equal(sprintForInstant(Date.parse("2026-09-06T23:59+08:00"), calendar), null);
  assert.equal(sprintForInstant(Date.parse("2026-09-07T00:00+08:00"), calendar), 1);
  assert.equal(sprintForInstant(Date.parse("2026-09-20T23:59+08:00"), calendar), 1);
  assert.equal(sprintForInstant(Date.parse("2026-09-21T00:00+08:00"), calendar), 2);
});

test("formatSgt shows a UTC timestamp in Singapore time", () => {
  assert.equal(formatSgt(Date.parse("2026-09-15T05:19:53Z")), "2026-09-15 13:19");
  assert.equal(formatSgt(Date.parse("2026-09-16T16:23+08:00")), "2026-09-16 16:23");
});

test("storyStatus is Done only for a reviewed sprint, and Removed for a removed story", () => {
  assert.equal(storyStatus({ sprint: 1, change: "Unchanged" }, calendar), "Done");
  assert.equal(storyStatus({ sprint: 2, change: "Unchanged" }, calendar), "In Sprint");
  assert.equal(storyStatus({ sprint: 3, change: "Unchanged" }, calendar), "To Do");
  assert.equal(storyStatus({ sprint: null, change: "Removed" }, calendar), "Removed");
});

test("sheetName strips characters Excel forbids and caps the length at 31", () => {
  assert.equal(sheetName("Auth / Authorisation: [core]"), "Auth - Authorisation- -core-");
  assert.equal(sheetName("x".repeat(40)).length, 31);
});
