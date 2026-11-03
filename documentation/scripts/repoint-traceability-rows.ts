#!/usr/bin/env node
/**
 * Repoints the traceability rows whose test titles no longer exist (see check-traceability.ts).
 *
 * Each repair names a CSV line, the `test_file,test_name` tail that line has now, and what the tail
 * becomes. A line that does not end the way the repair expects is an error, not a guess: the file
 * has moved on since the audit and the repair needs another look. A line that already ends the new
 * way is skipped, so running this twice changes nothing.
 *
 * Three kinds of repair:
 *   - renamed: the test lives on under a longer or reworded title;
 *   - replaced: E3 or E4 took the test away and another test now covers the same criterion;
 *   - superseded: the criterion itself is gone, so the row keeps its criterion and its test_file and
 *     says so in test_name with a marker the team can recognise (see SUPERSEDED_MARKER in
 *     check-traceability.ts).
 *
 * Usage: tsx documentation/scripts/repoint-traceability-rows.ts [--root <repo>]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const TESTS = "backend/services/planning-core/tests";
const SUBMISSION = `${TESTS}/event/api/submission.test.ts`;
const ASSIGNMENT_DOMAIN = `${TESTS}/event/domain/assignment.test.ts`;
const REASSIGNMENTS = `${TESTS}/event/api/reassignments.test.ts`;
const LEAD_ASSIGNMENT = `${TESTS}/event/api/leadAssignment.test.ts`;

/** E1's automatic assignment was replaced by E3 (CR-05); E2's peer proposals were retired by E4. */
const E1_SUPERSEDED = "SUPERSEDED by E3 (CR-05)";
const E2_SUPERSEDED = "SUPERSEDED by E4 (W9-FX-5)";

export interface Repair {
  /** The sprint file, e.g. "sprint-1.csv". */
  csv: string;
  /** 1-based line of the file. */
  line: number;
  from: { file: string; name: string };
  to: { file: string; name: string };
}

const renamed = (csv: string, line: number, file: string, from: string, to: string): Repair => ({
  csv,
  line,
  from: { file, name: from },
  to: { file, name: to },
});

const replaced = (csv: string, line: number, from: Repair["from"], to: Repair["to"]): Repair => ({ csv, line, from, to });

const superseded = (csv: string, line: number, from: Repair["from"], marker: string): Repair => ({
  csv,
  line,
  from,
  to: { file: from.file, name: marker },
});

export const REPAIRS: Repair[] = [
  // E1, sprint-1.csv: E3 (43cd4b5) removed the submission-time assignment and its tests.
  superseded("sprint-1.csv", 56, { file: SUBMISSION, name: "assigns a coordinator as part of the submission" }, E1_SUPERSEDED),
  replaced(
    "sprint-1.csv",
    57,
    { file: SUBMISSION, name: "gives each event exactly one active assignment" },
    { file: LEAD_ASSIGNMENT, name: "refuses a second assignment, naming the coordinator already assigned (E3-T6)" },
  ),
  replaced(
    "sprint-1.csv",
    58,
    { file: SUBMISSION, name: "records the allocation rule that was applied, so the outcome can be explained" },
    {
      file: LEAD_ASSIGNMENT,
      name: "assigns the coordinator, recording them, the Lead and the time, and the request leaves the queue (E3-T4)",
    },
  ),
  superseded("sprint-1.csv", 59, { file: ASSIGNMENT_DOMAIN, name: "assigns each coordinator in turn as the cursor advances" }, E1_SUPERSEDED),
  replaced(
    "sprint-1.csv",
    60,
    { file: SUBMISSION, name: "notifies the newly assigned coordinator" },
    { file: LEAD_ASSIGNMENT, name: "tells the coordinator and the owner, naming the coordinator, in the same transaction (E3-T4)" },
  ),
  superseded(
    "sprint-1.csv",
    61,
    { file: ASSIGNMENT_DOMAIN, name: "returns nothing when no eligible coordinator exists, so the event can still be submitted" },
    E1_SUPERSEDED,
  ),

  // E2, sprint-1.csv: E4 (dde7534) retired the peer proposals (W9-FX-5). The rules the Lead's
  // reassignment shares with them (status limits, an eligible coordinator, not the one already
  // assigned) now rest on E4's tests; the rules that only a proposal has are superseded.
  replaced(
    "sprint-1.csv",
    112,
    { file: ASSIGNMENT_DOMAIN, name: "refuses reassignment once the event has left the review workflow" },
    { file: ASSIGNMENT_DOMAIN, name: "refuses assigning an event that is REJECTED" },
  ),
  replaced(
    "sprint-1.csv",
    113,
    { file: REASSIGNMENTS, name: "refuses reassignment once the event has been rejected" },
    { file: LEAD_ASSIGNMENT, name: "reassigns a Confirmed event, and refuses a Completed, Cancelled or Rejected one (E4-T3)" },
  ),
  replaced(
    "sprint-1.csv",
    114,
    { file: REASSIGNMENTS, name: "refuses a nominee who does not hold the Coordinator role" },
    { file: LEAD_ASSIGNMENT, name: "refuses an unassigned event, an inactive coordinator, and every role but the Lead (E4-T8)" },
  ),
  superseded(
    "sprint-1.csv",
    115,
    { file: REASSIGNMENTS, name: "refuses a second proposal while one is pending, naming the pending nominee" },
    E2_SUPERSEDED,
  ),
  superseded(
    "sprint-1.csv",
    116,
    { file: REASSIGNMENTS, name: "fires two concurrent proposals for the same event and lets exactly one win" },
    E2_SUPERSEDED,
  ),
  superseded(
    "sprint-1.csv",
    117,
    { file: ASSIGNMENT_DOMAIN, name: "is true when the nominee is already the assigned coordinator" },
    E2_SUPERSEDED,
  ),
  replaced(
    "sprint-1.csv",
    118,
    { file: REASSIGNMENTS, name: "refuses nominating the coordinator already assigned, creating no history entry" },
    { file: LEAD_ASSIGNMENT, name: "refuses the coordinator already assigned, creating no history entry (E4-T2)" },
  ),
  superseded(
    "sprint-1.csv",
    123,
    { file: REASSIGNMENTS, name: "allows a fresh proposal once the pending one has been declined" },
    E2_SUPERSEDED,
  ),
  superseded(
    "sprint-1.csv",
    124,
    { file: REASSIGNMENTS, name: "refuses a coordinator who is not the one currently assigned" },
    E2_SUPERSEDED,
  ),

  // Titles that were cut short or reworded; these tests exist.
  renamed(
    "sprint-2.csv",
    66,
    `${TESTS}/event/api/f2StatusAndHistory.test.ts`,
    "shows Event Coordinators generally the full history, assigned or not (AC2)",
    "shows Event Coordinators generally the full history, assigned or not (AC2): %s",
  ),
  renamed(
    "sprint-2.csv",
    85,
    `${TESTS}/equipment/api/o1Cards.test.ts`,
    "O1-T20 refuses to remove a Reserved line that holds no active reservation, and changes nothing",
    "O1-T20 refuses to remove a Reserved line that holds no active reservation, and changes nothing",
  ),
  renamed(
    "sprint-3.csv",
    165,
    `${TESTS}/venue/domain/unavailability.test.ts`,
    "names every missing field",
    "names every missing field, the end not being one of them",
  ),
  renamed(
    "sprint-3.csv",
    392,
    `${TESTS}/event/domain/statusMachine.test.ts`,
    "leaves Confirmed only by completing, or for Planning when its venue is blocked (I3)",
    "leaves Confirmed only by completing, or for Planning when its venue is blocked (I3) or a change is approved (S3)",
  ),
  renamed(
    "sprint-4.csv",
    27,
    `${TESTS}/change/api/f5Cards.test.ts`,
    "F5-T16 a booking flagged unsuitable (S3) is refused, naming the flag",
    "F5-T16 a booking flagged unsuitable (S3) is refused, naming the flag",
  ),
  // S3-T13 is a manual card, so the name is the card's heading.
  renamed(
    "sprint-4.csv",
    55,
    "tests/S3/S3-T13-change-impact-in-the-browser.md",
    "S3-T13 manual: the coordinator approves a change and sees the impact and the flags on screen",
    "S3-T13 — The coordinator approves a change and sees the impact and the flags on screen",
  ),
];

/** A CSV field, quoted when it holds a comma, a quote or a line break. */
export function csvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** The text of a row from `test_file` onward. A name that was written quoted is accepted either way. */
const tail = (t: Repair["from"]): string[] => [`,${t.file},${t.name}`, `,${t.file},"${t.name}"`, `,${t.file},${csvField(t.name)}`];

export interface ApplyResult {
  text: string;
  /** Lines that were changed. */
  changed: number[];
  /** Lines that already had the new tail. */
  alreadyDone: number[];
}

/** Applies the repairs for one sprint file to its text. Throws if a line is not as the repair expects. */
export function applyRepairs(csv: string, text: string, repairs: Repair[] = REPAIRS): ApplyResult {
  const parts = text.split(/(\r\n|\n)/);
  const changed: number[] = [];
  const alreadyDone: number[] = [];
  for (const repair of repairs.filter((r) => r.csv === csv)) {
    const index = (repair.line - 1) * 2;
    const line = parts[index];
    if (line === undefined) throw new Error(`${csv}:${repair.line} does not exist`);
    const toTail = `,${repair.to.file},${csvField(repair.to.name)}`;
    if (line.endsWith(toTail)) {
      alreadyDone.push(repair.line);
      continue;
    }
    const fromTail = tail(repair.from).find((candidate) => line.endsWith(candidate));
    if (fromTail === undefined) {
      throw new Error(`${csv}:${repair.line} does not end with ,${repair.from.file},${repair.from.name}; audit it again`);
    }
    parts[index] = line.slice(0, line.length - fromTail.length) + toTail;
    changed.push(repair.line);
  }
  return { text: parts.join(""), changed, alreadyDone };
}

function main(): void {
  const rootFlag = process.argv.indexOf("--root");
  const root = rootFlag === -1 ? process.cwd() : process.argv[rootFlag + 1];
  for (const csv of [...new Set(REPAIRS.map((r) => r.csv))].sort()) {
    const path = join(root, "documentation", "traceability", csv);
    const result = applyRepairs(csv, readFileSync(path, "utf8"));
    if (result.changed.length > 0) writeFileSync(path, result.text);
    console.log(`${csv}: changed ${result.changed.length}, already done ${result.alreadyDone.length}`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
