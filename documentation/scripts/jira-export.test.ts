import assert from "node:assert/strict";
import { test } from "node:test";
import { buildSnapshot, extractAcceptanceCriteria } from "./jira-export.ts";

test("extractAcceptanceCriteria reads the bullets under the heading and stops at the next label", () => {
  const md = "**Goal:** x\n\n**Acceptance Criteria:**\n\n* First one.\n* Second one.\n\n**Notes**\n* not a criterion\n";
  assert.deepEqual(extractAcceptanceCriteria(md), ["First one.", "Second one."]);
});

test("extractAcceptanceCriteria returns nothing when there is no heading", () => {
  assert.deepEqual(extractAcceptanceCriteria("Just prose.\n* a bullet"), []);
});

const issue = (key: string, type: string, parent?: { key: string; summary: string }, extra: object = {}) => ({
  key,
  fields: {
    summary: `${key} summary`,
    issuetype: { name: type },
    status: { name: "Done", statusCategory: { name: "Done" } },
    parent: parent && { key: parent.key, fields: { summary: parent.summary } },
    customFields: { Sprint: { value: [{ name: "SPM Sprint 1" }] }, "Story point estimate": { value: 3 } },
    ...extra,
  },
});

test("buildSnapshot sorts by key, resolves a subtask's epic through its story, and keeps points and sprint", () => {
  const story = issue("SPM-20", "Story", { key: "SPM-5", summary: "Feature" }, { description: "**Acceptance Criteria**\n* ok" });
  const sub = issue("SPM-30", "Subtask", { key: "SPM-20", summary: "story" });
  const snap = buildSnapshot([[sub, story]], "test");
  assert.deepEqual(snap.issues.map((i) => i.key), ["SPM-20", "SPM-30"]);
  assert.equal(snap.issues[0].epicKey, "SPM-5");
  assert.equal(snap.issues[1].epicKey, "SPM-5");
  assert.equal(snap.issues[0].storyPoints, 3);
  assert.deepEqual(snap.issues[0].sprints, ["SPM Sprint 1"]);
  assert.deepEqual(snap.issues[0].acceptanceCriteria, ["ok"]);
});

test("buildSnapshot lets a later page replace an earlier copy of the same key", () => {
  const a = issue("SPM-1", "Story");
  const b = { ...issue("SPM-1", "Story"), fields: { ...issue("SPM-1", "Story").fields, summary: "newer" } };
  const snap = buildSnapshot([[a], [b]], "test");
  assert.equal(snap.issueCount, 1);
  assert.equal(snap.issues[0].summary, "newer");
});
