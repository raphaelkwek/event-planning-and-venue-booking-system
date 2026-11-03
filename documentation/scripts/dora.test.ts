import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeDora,
  fetchMainRuns,
  fetchMergedPrs,
  formatDuration,
  renderDora,
  summarise,
  weekStart,
  type DoraInput,
  type MainRun,
  type PullRequest,
} from "./dora.ts";

// EN-22-T8. Synthetic pull requests and runs with answers worked out by hand.
const FROM = "2026-10-01T00:00:00.000Z";
const UNTIL = "2026-10-15T00:00:00.000Z"; // 14 days

const pr = (number: number, title: string, firstCommitAt: string | null, mergedAt: string): PullRequest => ({
  number, title, createdAt: firstCommitAt ?? mergedAt, mergedAt, mergeSha: `sha${number}`, firstCommitAt,
});
const run = (sha: string, conclusion: string, completedAt: string, createdAt = completedAt): MainRun => ({ id: Math.floor(Math.random() * 1e6), sha, conclusion, createdAt, completedAt });
const input = (prs: PullRequest[], runs: MainRun[], overrides: Partial<DoraInput> = {}): DoraInput => ({ prs, runs, from: FROM, until: UNTIL, failureWindowHours: 24, ...overrides });

test("summarise gives the median, mean and nearest-rank p90, and nulls for nothing (EN-22-T8)", () => {
  assert.deepEqual(summarise([]), { count: 0, median: null, mean: null, p90: null });
  assert.deepEqual(summarise([5]), { count: 1, median: 5, mean: 5, p90: 5 });
  assert.deepEqual(summarise([4, 1, 3, 2]), { count: 4, median: 2.5, mean: 2.5, p90: 4 });
  const ten = summarise([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.deepEqual([ten.median, ten.p90], [5.5, 9]);
});

test("weekStart is the Monday of the UTC week (EN-22-T8)", () => {
  assert.equal(weekStart("2026-10-05T10:00:00Z"), "2026-10-05");
  assert.equal(weekStart("2026-10-11T23:59:00Z"), "2026-10-05");
  assert.equal(weekStart("2026-10-12T00:00:00Z"), "2026-10-12");
});

test("formatDuration reads in minutes, hours and days (EN-22-T8)", () => {
  assert.deepEqual([null, 90_000, 3_600_000, 5_400_000, 3 * 86_400_000].map(formatDuration), ["n/a", "2m", "1h 0m", "1h 30m", "3.0 days"]);
});

test("deployment frequency counts successful main runs in the window, one per commit, and shows merges beside it (EN-22-T8)", () => {
  const result = computeDora(input(
    [pr(1, "feat: a", "2026-10-01T00:00:00Z", "2026-10-02T00:00:00Z"), pr(2, "feat: b", "2026-10-03T00:00:00Z", "2026-10-06T00:00:00Z")],
    [
      run("sha1", "success", "2026-10-02T01:00:00Z"),
      run("sha2", "failure", "2026-10-06T01:00:00Z", "2026-10-06T00:30:00Z"),
      run("sha2", "success", "2026-10-06T03:00:00Z", "2026-10-06T02:00:00Z"), // a re-run replaces the failure
      run("sha3", "cancelled", "2026-10-07T00:00:00Z"),
      run("sha4", "success", "2026-09-20T00:00:00Z"), // before the window
    ],
  ));
  assert.equal(result.deployments.successfulMainRuns, 2);
  assert.equal(result.deployments.mergesToMain, 2);
  assert.equal(result.deployments.perDay, 2 / 14);
  assert.equal(result.deployments.perWeek, 1);
  assert.deepEqual(result.deployments.byWeek, [{ week: "2026-09-28", runs: 1, merges: 1 }, { week: "2026-10-05", runs: 1, merges: 1 }]);
});

test("lead time is first commit to merge, per merged pull request in the window (EN-22-T8)", () => {
  const result = computeDora(input(
    [
      pr(1, "feat: a", "2026-10-02T00:00:00Z", "2026-10-02T04:00:00Z"), // 4h
      pr(2, "feat: b", "2026-10-03T00:00:00Z", "2026-10-04T00:00:00Z"), // 24h
      pr(3, "feat: c", "2026-10-04T00:00:00Z", "2026-10-07T00:00:00Z"), // 72h
      pr(4, "feat: no commits", null, "2026-10-08T00:00:00Z"),
      pr(5, "feat: outside", "2026-09-01T00:00:00Z", "2026-09-02T00:00:00Z"),
    ],
    [],
  ));
  assert.deepEqual(result.leadTime.perPr.map((p) => [p.number, p.ms / 3_600_000]), [[1, 4], [2, 24], [3, 72]]);
  assert.equal(result.leadTime.median, 24 * 3_600_000);
  assert.equal(Math.round(result.leadTime.mean!), Math.round((100 / 3) * 3_600_000));
  assert.deepEqual(result.leadTime.withoutCommits, [4]);
});

test("a first commit after the merge cannot give a negative lead time (EN-22-T8)", () => {
  const result = computeDora(input([pr(1, "feat", "2026-10-03T00:00:00Z", "2026-10-02T00:00:00Z")], []));
  assert.equal(result.leadTime.median, 0);
});

test("change failure rate counts a failed main run and a revert or hotfix within the window (EN-22-T8)", () => {
  const prs = [
    pr(1, "feat: fine", "2026-10-01T00:00:00Z", "2026-10-02T00:00:00Z"),
    pr(2, "feat: red build", "2026-10-02T00:00:00Z", "2026-10-03T00:00:00Z"),
    pr(3, "feat: reverted", "2026-10-04T00:00:00Z", "2026-10-05T00:00:00Z"),
    pr(4, "Revert \"feat: reverted\"", "2026-10-05T06:00:00Z", "2026-10-05T08:00:00Z"), // 8h after #3
    pr(5, "feat: late fix target", "2026-10-06T00:00:00Z", "2026-10-07T00:00:00Z"),
    pr(6, "hotfix: too late", "2026-10-09T00:00:00Z", "2026-10-09T00:00:00Z"), // 48h after #5: outside 24h
    pr(7, "fix: planned fix", "2026-10-10T00:00:00Z", "2026-10-10T01:00:00Z"), // a plain fix is not a signal
  ];
  const runs = [run("sha1", "success", "2026-10-02T01:00:00Z"), run("sha2", "failure", "2026-10-03T01:00:00Z")];
  const result = computeDora(input(prs, runs));
  assert.deepEqual(result.changeFailure.failed.map((f) => [f.number, f.why]), [
    [2, "its main run failed"],
    [3, "followed by #4 within 24h"],
  ]);
  assert.equal(result.changeFailure.merges, 7);
  assert.equal(result.changeFailure.rate, 2 / 7);
});

test("the failure window is configurable and a failed run is not counted twice (EN-22-T8)", () => {
  const prs = [pr(1, "feat", "2026-10-01T00:00:00Z", "2026-10-02T00:00:00Z"), pr(2, "Revert feat", "2026-10-02T12:00:00Z", "2026-10-03T00:00:00Z")];
  const runs = [run("sha1", "failure", "2026-10-02T01:00:00Z")];
  assert.equal(computeDora(input(prs, runs, { failureWindowHours: 1 })).changeFailure.failed.length, 1);
  assert.equal(computeDora(input(prs, runs, { failureWindowHours: 48 })).changeFailure.failed.length, 1);
  assert.equal(computeDora(input(prs, [], { failureWindowHours: 1 })).changeFailure.failed.length, 0);
});

test("with no merges the change failure rate is null, not zero (EN-22-T8)", () => {
  assert.equal(computeDora(input([], [])).changeFailure.rate, null);
});

test("time to restore runs from the first failing run to the next green one, and an open incident is listed (EN-22-T8)", () => {
  const runs = [
    run("a", "success", "2026-10-01T00:00:00Z"),
    run("b", "failure", "2026-10-02T00:00:00Z"),
    run("c", "failure", "2026-10-02T02:00:00Z"), // same incident
    run("d", "cancelled", "2026-10-02T03:00:00Z"), // ignored
    run("e", "success", "2026-10-02T06:00:00Z"), // restored after 6h
    run("f", "failure", "2026-10-05T00:00:00Z"),
    run("g", "success", "2026-10-05T02:00:00Z"), // 2h
    run("h", "failure", "2026-10-10T00:00:00Z"), // still open
  ];
  const { restore } = computeDora(input([], runs));
  assert.deepEqual(restore.incidents.map((i) => [i.startedAt, i.restoredAt, i.failingRuns]), [
    ["2026-10-02T00:00:00Z", "2026-10-02T06:00:00Z", 2],
    ["2026-10-05T00:00:00Z", "2026-10-05T02:00:00Z", 1],
    ["2026-10-10T00:00:00Z", null, 1],
  ]);
  assert.equal(restore.count, 2);
  assert.equal(restore.median, 4 * 3_600_000);
  assert.equal(restore.open, 1);
});

test("an incident that starts after the window ends is not counted (EN-22-T8)", () => {
  const { restore } = computeDora(input([], [run("a", "failure", "2026-10-20T00:00:00Z")]));
  assert.equal(restore.incidents.length, 0);
});

test("the Markdown states the window, the definitions and all four metrics (EN-22-T8)", () => {
  const result = computeDora(input(
    [pr(1, "feat: a | b", "2026-10-02T00:00:00Z", "2026-10-02T04:00:00Z")],
    [run("sha1", "failure", "2026-10-02T05:00:00Z"), run("sha9", "success", "2026-10-02T07:00:00Z")],
  ));
  const markdown = renderDora(result, { repo: "o/r", branch: "main", generatedAt: "2026-10-15T00:00:00Z" });
  for (const text of ["# DORA metrics", "Window 2026-10-01 to 2026-10-15 (14 days)", "| Deployment frequency |", "| Lead time for changes | median 4h 0m", "| Change failure rate | 100.0%", "| Time to restore | median 2h 0m", "## Definitions", "feat: a \\| b"]) {
    assert.ok(markdown.includes(text), `missing: ${text}`);
  }
  assert.match(renderDora(computeDora(input([], [])), { repo: "o/r", branch: "main", generatedAt: "x" }), /n\/a \(no merges\)/);
});

test("the GitHub fetchers map the API's fields and take the earliest commit date (EN-22-T8)", () => {
  const calls: string[] = [];
  const gh = (path: string): unknown[] => {
    calls.push(path);
    if (path.includes("/actions/workflows/ci.yml/runs")) {
      return [{ id: 7, head_sha: "abc", conclusion: "success", created_at: "2026-10-02T00:00:00Z", updated_at: "2026-10-02T00:10:00Z", status: "completed" }];
    }
    if (path.includes("/pulls/9/commits")) return [{ commit: { author: { date: "2026-10-02T09:00:00Z" } } }, { commit: { author: { date: "2026-10-01T09:00:00Z" } } }, { commit: { author: null } }];
    if (path.includes("/pulls/10/commits")) return [];
    return [
      { number: 9, title: "feat: nine", created_at: "2026-10-01T10:00:00Z", merged_at: "2026-10-03T00:00:00Z", merge_commit_sha: "m9", base: { ref: "main" } },
      { number: 10, title: "feat: ten", created_at: "2026-10-01T10:00:00Z", merged_at: "2026-10-04T00:00:00Z", merge_commit_sha: "m10", base: { ref: "main" } },
      { number: 11, title: "closed unmerged", created_at: "2026-10-01T10:00:00Z", merged_at: null, merge_commit_sha: null, base: { ref: "main" } },
      { number: 12, title: "too old", created_at: "2026-08-01T10:00:00Z", merged_at: "2026-08-02T00:00:00Z", merge_commit_sha: "m12", base: { ref: "main" } },
    ];
  };
  const runs = fetchMainRuns(gh, "o/r", "ci.yml", "main", FROM);
  assert.deepEqual(runs, [{ id: 7, sha: "abc", conclusion: "success", createdAt: "2026-10-02T00:00:00Z", completedAt: "2026-10-02T00:10:00Z" }]);
  assert.ok(calls[0]!.includes("branch=main&event=push&status=completed") && calls[0]!.includes("created=%3E%3D2026-10-01"));

  const prs = fetchMergedPrs(gh, "o/r", "main", FROM);
  assert.deepEqual(prs.map((p) => [p.number, p.mergeSha, p.firstCommitAt]), [[9, "m9", "2026-10-01T09:00:00Z"], [10, "m10", null]]);
});
