#!/usr/bin/env node
/**
 * EN-22 — the four DORA metrics for this repository, from the GitHub API through the `gh` CLI
 * (locally: `gh auth login`; in Actions: `GH_TOKEN: ${{ github.token }}`).
 *
 * Usage:
 *   tsx documentation/scripts/dora.ts [--repo owner/name] [--days 30] [--until <ISO date>]
 *     [--failure-window-hours 24] [--branch main] [--workflow ci.yml] [--out <file>]
 *
 * The definitions, which the output repeats so nobody has to guess:
 *
 *   Deployment frequency  The number of successful runs of the CI workflow on `main` (one push
 *       event each) that finished in the window, per day and per week. ConnectSphere has no
 *       production deployment yet (EN-10 builds the pipeline), so a green main run is the
 *       "deployable build" event. It is counted instead of merges because a merge whose build is
 *       red is not deployable; the merge count is shown beside it. Cancelled runs (a newer push
 *       cancels the older run, see `concurrency` in ci.yml) are neither successes nor failures.
 *
 *   Lead time for changes  For each pull request merged into `main` in the window, the time from
 *       its first commit (earliest author date among its commits) to the merge.
 *
 *   Change failure rate  The share of pull requests merged in the window that failed: the main
 *       run for its merge commit concluded `failure`, or a revert or hotfix pull request (title
 *       starts with "Revert", or mentions "hotfix") merged within N hours after it (default 24)
 *       and the pull request is the latest merge before that fix. Ordinary `fix:` pull requests
 *       are not counted: most are planned stories, not responses to a failed change.
 *
 *   Time to restore  For each incident (a failing main run, or a run of consecutive ones) that
 *       began in the window, the time from the first failing run finishing to the next green main
 *       run finishing. An incident with no green run after it is open, and is listed, not averaged.
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export interface PullRequest {
  number: number;
  title: string;
  createdAt: string;
  mergedAt: string;
  mergeSha: string;
  /** Earliest author date among the pull request's commits; null if they could not be read. */
  firstCommitAt: string | null;
}

export interface MainRun {
  id: number;
  sha: string;
  conclusion: string;
  createdAt: string;
  completedAt: string;
}

export interface DoraInput {
  prs: PullRequest[];
  runs: MainRun[];
  from: string;
  until: string;
  failureWindowHours: number;
}

export interface Stats {
  count: number;
  median: number | null;
  mean: number | null;
  p90: number | null;
}

export interface Incident {
  startedAt: string;
  restoredAt: string | null;
  durationMs: number | null;
  failingRuns: number;
}

export interface DoraResult {
  window: { from: string; until: string; days: number };
  failureWindowHours: number;
  deployments: { successfulMainRuns: number; perDay: number; perWeek: number; mergesToMain: number; byWeek: { week: string; runs: number; merges: number }[] };
  leadTime: Stats & { perPr: { number: number; title: string; ms: number }[]; withoutCommits: number[] };
  changeFailure: { merges: number; failed: { number: number; title: string; why: string }[]; rate: number | null };
  restore: Stats & { incidents: Incident[]; open: number };
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const time = (iso: string) => Date.parse(iso);

export function summarise(values: number[]): Stats {
  if (values.length === 0) return { count: 0, median: null, mean: null, p90: null };
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
  const mean = sorted.reduce((sum, v) => sum + v, 0) / sorted.length;
  return { count: sorted.length, median, mean, p90: sorted[Math.ceil(0.9 * sorted.length) - 1]! };
}

/** The Monday (UTC) of the ISO week a time falls in, as YYYY-MM-DD. */
export function weekStart(iso: string): string {
  const date = new Date(time(iso));
  const dayFromMonday = (date.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - dayFromMonday)).toISOString().slice(0, 10);
}

const inWindow = (iso: string, from: string, until: string) => time(iso) >= time(from) && time(iso) < time(until);
const finished = (run: MainRun) => run.conclusion === "success" || run.conclusion === "failure";

/** The latest finished run for each commit: a re-run of a commit replaces its earlier result. */
function latestRunPerSha(runs: MainRun[]): Map<string, MainRun> {
  const bySha = new Map<string, MainRun>();
  for (const run of [...runs].filter(finished).sort((a, b) => time(a.createdAt) - time(b.createdAt))) bySha.set(run.sha, run);
  return bySha;
}

function deploymentMetrics(input: DoraInput, merges: PullRequest[]): DoraResult["deployments"] {
  const green = [...latestRunPerSha(input.runs).values()].filter((run) => run.conclusion === "success" && inWindow(run.completedAt, input.from, input.until));
  const days = (time(input.until) - time(input.from)) / DAY;
  const weeks = new Map<string, { runs: number; merges: number }>();
  const bump = (iso: string, key: "runs" | "merges") => {
    const week = weekStart(iso);
    weeks.set(week, { runs: 0, merges: 0, ...weeks.get(week), [key]: (weeks.get(week)?.[key] ?? 0) + 1 });
  };
  green.forEach((run) => bump(run.completedAt, "runs"));
  merges.forEach((pr) => bump(pr.mergedAt, "merges"));
  return {
    successfulMainRuns: green.length,
    perDay: green.length / days,
    perWeek: (green.length / days) * 7,
    mergesToMain: merges.length,
    byWeek: [...weeks].sort(([a], [b]) => a.localeCompare(b)).map(([week, counts]) => ({ week, ...counts })),
  };
}

function leadTimeMetrics(merges: PullRequest[]): DoraResult["leadTime"] {
  const measured = merges.filter((pr) => pr.firstCommitAt !== null);
  const perPr = measured.map((pr) => ({ number: pr.number, title: pr.title, ms: Math.max(0, time(pr.mergedAt) - time(pr.firstCommitAt!)) }));
  return { ...summarise(perPr.map((p) => p.ms)), perPr, withoutCommits: merges.filter((pr) => pr.firstCommitAt === null).map((pr) => pr.number) };
}

const isRevertOrHotfix = (title: string) => /^revert\b/i.test(title.trim()) || /hotfix/i.test(title);

function changeFailureMetrics(input: DoraInput, merges: PullRequest[]): DoraResult["changeFailure"] {
  const runs = latestRunPerSha(input.runs);
  const failed = new Map<number, { number: number; title: string; why: string }>();
  for (const pr of merges) {
    if (runs.get(pr.mergeSha)?.conclusion === "failure") failed.set(pr.number, { number: pr.number, title: pr.title, why: "its main run failed" });
  }
  const ordered = [...merges].sort((a, b) => time(a.mergedAt) - time(b.mergedAt));
  for (const fix of ordered.filter((pr) => isRevertOrHotfix(pr.title))) {
    const culprit = [...ordered].reverse().find((pr) => pr.number !== fix.number && time(pr.mergedAt) < time(fix.mergedAt) && time(fix.mergedAt) - time(pr.mergedAt) <= input.failureWindowHours * HOUR);
    if (culprit && !failed.has(culprit.number)) failed.set(culprit.number, { number: culprit.number, title: culprit.title, why: `followed by #${fix.number} within ${input.failureWindowHours}h` });
  }
  return { merges: merges.length, failed: [...failed.values()].sort((a, b) => a.number - b.number), rate: merges.length === 0 ? null : failed.size / merges.length };
}

function restoreMetrics(input: DoraInput): DoraResult["restore"] {
  const ordered = [...latestRunPerSha(input.runs).values()].sort((a, b) => time(a.completedAt) - time(b.completedAt));
  const incidents: Incident[] = [];
  let open = null as { startedAt: string; failingRuns: number } | null;
  for (const run of ordered) {
    if (run.conclusion === "failure") {
      open = open ? { ...open, failingRuns: open.failingRuns + 1 } : { startedAt: run.completedAt, failingRuns: 1 };
    } else if (open) {
      incidents.push({ ...open, restoredAt: run.completedAt, durationMs: time(run.completedAt) - time(open.startedAt) });
      open = null;
    }
  }
  if (open) incidents.push({ ...open, restoredAt: null, durationMs: null });
  const inRange = incidents.filter((incident) => inWindow(incident.startedAt, input.from, input.until));
  return { ...summarise(inRange.flatMap((i) => (i.durationMs === null ? [] : [i.durationMs]))), incidents: inRange, open: inRange.filter((i) => i.restoredAt === null).length };
}

export function computeDora(input: DoraInput): DoraResult {
  const merges = input.prs.filter((pr) => inWindow(pr.mergedAt, input.from, input.until));
  return {
    window: { from: input.from, until: input.until, days: (time(input.until) - time(input.from)) / DAY },
    failureWindowHours: input.failureWindowHours,
    deployments: deploymentMetrics(input, merges),
    leadTime: leadTimeMetrics(merges),
    changeFailure: changeFailureMetrics(input, merges),
    restore: restoreMetrics(input),
  };
}

// ---------------------------------------------------------------------------------------------
// Output

export function formatDuration(ms: number | null): string {
  if (ms === null) return "n/a";
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ${minutes % 60}m`;
  return `${(hours / 24).toFixed(1)} days`;
}

/** A Markdown table cell: backslashes and pipes escaped. */
const cell = (text: string) => text.replace(/[\\|]/g, (char) => `\\${char}`);

const pct = (rate: number | null) => (rate === null ? "n/a (no merges)" : `${(rate * 100).toFixed(1)}%`);

export function renderDora(result: DoraResult, meta: { repo: string; branch: string; generatedAt: string }): string {
  const { deployments: d, leadTime: l, changeFailure: c, restore: r } = result;
  const lines = [
    "# DORA metrics",
    "",
    `Repository \`${meta.repo}\`, branch \`${meta.branch}\`. Window ${result.window.from.slice(0, 10)} to ${result.window.until.slice(0, 10)} (${result.window.days} days). Generated ${meta.generatedAt} by \`documentation/scripts/dora.ts\`.`,
    "",
    "| Metric | Value | Based on |",
    "|---|---|---|",
    `| Deployment frequency | ${d.perDay.toFixed(2)} per day (${d.perWeek.toFixed(1)} per week) | ${d.successfulMainRuns} successful main CI runs; ${d.mergesToMain} pull requests merged |`,
    `| Lead time for changes | median ${formatDuration(l.median)}, mean ${formatDuration(l.mean)}, p90 ${formatDuration(l.p90)} | ${l.count} merged pull requests |`,
    `| Change failure rate | ${pct(c.rate)} | ${c.failed.length} of ${c.merges} merges |`,
    `| Time to restore | median ${formatDuration(r.median)}, mean ${formatDuration(r.mean)}, p90 ${formatDuration(r.p90)} | ${r.count} restored incidents, ${r.open} still open |`,
    "",
    "## Definitions",
    "",
    "- **Deployment frequency:** successful runs of the CI workflow on `main`, one per commit (the latest result of a commit counts). There is no production deployment yet, so a green main run is the deployable-build event; merges are shown beside it because a merge with a red build is not deployable. Cancelled runs count as neither a success nor a failure.",
    "- **Lead time for changes:** first commit (earliest author date in the pull request) to merge, per pull request merged into `main` in the window.",
    `- **Change failure rate:** pull requests merged in the window whose main run failed, or that were followed within ${result.failureWindowHours} hours by a revert or hotfix pull request (the latest merge before it). Plain \`fix:\` pull requests are not counted.`,
    "- **Time to restore:** from the first failing main run finishing to the next green main run finishing. Consecutive failures are one incident. Open incidents are listed, not averaged.",
    "",
    "## Merges and green main runs by week",
    "",
    "| Week starting (Monday, UTC) | Successful main runs | Pull requests merged |",
    "|---|---|---|",
    ...d.byWeek.map((w) => `| ${w.week} | ${w.runs} | ${w.merges} |`),
    "",
    "## Failed changes",
    "",
    ...(c.failed.length === 0 ? ["None in the window."] : ["| PR | Title | Why |", "|---|---|---|", ...c.failed.map((f) => `| #${f.number} | ${cell(f.title)} | ${f.why} |`)]),
    "",
    "## Incidents",
    "",
    ...(r.incidents.length === 0
      ? ["None in the window."]
      : ["| Started | Restored | Duration | Failing runs |", "|---|---|---|---|", ...r.incidents.map((i) => `| ${i.startedAt} | ${i.restoredAt ?? "still open"} | ${formatDuration(i.durationMs)} | ${i.failingRuns} |`)]),
    "",
    "## Lead time per pull request",
    "",
    "| PR | Title | Lead time |",
    "|---|---|---|",
    ...l.perPr.map((p) => `| #${p.number} | ${cell(p.title)} | ${formatDuration(p.ms)} |`),
    ...(l.withoutCommits.length > 0 ? ["", `Commits could not be read for: ${l.withoutCommits.map((n) => `#${n}`).join(", ")}.`] : []),
    "",
  ];
  return lines.join("\n");
}

// ---------------------------------------------------------------------------------------------
// GitHub, through the gh CLI

type Gh = (path: string) => unknown[];

function ghPaginated(path: string): unknown[] {
  const out = execFileSync("gh", ["api", "--paginate", path, "--jq", "if type == \"array\" then .[] else .workflow_runs[] end"], { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  return out.split("\n").filter((line) => line.trim() !== "").map((line) => JSON.parse(line) as unknown);
}

interface RawPr { number: number; title: string; created_at: string; merged_at: string | null; merge_commit_sha: string | null; base: { ref: string } }
interface RawRun { id: number; head_sha: string; conclusion: string | null; created_at: string; updated_at: string; status: string }
interface RawCommit { commit: { author: { date: string } | null } }

export function fetchMainRuns(gh: Gh, repo: string, workflow: string, branch: string, since: string): MainRun[] {
  const path = `repos/${repo}/actions/workflows/${workflow}/runs?branch=${branch}&event=push&status=completed&per_page=100&created=%3E%3D${since.slice(0, 10)}`;
  return (gh(path) as RawRun[]).map((run) => ({ id: run.id, sha: run.head_sha, conclusion: run.conclusion ?? "unknown", createdAt: run.created_at, completedAt: run.updated_at }));
}

export function fetchMergedPrs(gh: Gh, repo: string, branch: string, since: string): PullRequest[] {
  const closed = gh(`repos/${repo}/pulls?state=closed&base=${branch}&sort=updated&direction=desc&per_page=100`) as RawPr[];
  return closed
    .filter((pr) => pr.merged_at !== null && pr.merge_commit_sha !== null && time(pr.merged_at) >= time(since))
    .map((pr) => {
      const commits = gh(`repos/${repo}/pulls/${pr.number}/commits?per_page=100`) as RawCommit[];
      const dates = commits.flatMap((c) => (c.commit.author?.date ? [c.commit.author.date] : []));
      const first = dates.length === 0 ? null : dates.reduce((a, b) => (time(a) <= time(b) ? a : b));
      return { number: pr.number, title: pr.title, createdAt: pr.created_at, mergedAt: pr.merged_at!, mergeSha: pr.merge_commit_sha!, firstCommitAt: first };
    });
}

function flag(args: string[], name: string, fallback: string): string {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1]! : fallback;
}

export function main(args: string[] = process.argv.slice(2)) {
  const repo = flag(args, "repo", process.env.GITHUB_REPOSITORY ?? "raphaelkwek/event-planning-and-venue-booking-system");
  const branch = flag(args, "branch", "main");
  const workflow = flag(args, "workflow", "ci.yml");
  const days = Number(flag(args, "days", "30"));
  const failureWindowHours = Number(flag(args, "failure-window-hours", "24"));
  if (!Number.isFinite(days) || days <= 0 || !Number.isFinite(failureWindowHours) || failureWindowHours <= 0) {
    console.error("--days and --failure-window-hours must be positive numbers");
    process.exit(1);
  }
  const until = new Date(flag(args, "until", new Date().toISOString())).toISOString();
  const from = new Date(time(until) - days * DAY).toISOString();

  const prs = fetchMergedPrs(ghPaginated, repo, branch, from);
  const runs = fetchMainRuns(ghPaginated, repo, workflow, branch, from);
  const markdown = renderDora(computeDora({ prs, runs, from, until, failureWindowHours }), { repo, branch, generatedAt: new Date().toISOString() });

  const out = flag(args, "out", "");
  if (out) writeFileSync(out, markdown);
  else console.log(markdown);
}

const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main();
}
