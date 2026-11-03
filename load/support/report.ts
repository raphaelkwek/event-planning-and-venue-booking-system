import { cpus, totalmem } from "node:os";
import type { Check, Outcomes, SpikeFigures, StepResult } from "./evaluate.js";

/**
 * The write-up of one run (EN-18): what the machine was, what was asked of it, what it did, and
 * which checks held. Everything printed here was measured by the run itself.
 */

export interface RunnerInfo {
  cpuModel: string;
  logicalCpus: number;
  memoryGb: number;
  node: string;
  k6Image: string;
  commit: string | null;
  runUrl: string | null;
}

export function runnerInfo(k6Image: string): RunnerInfo {
  const repo = process.env.GITHUB_REPOSITORY;
  const runId = process.env.GITHUB_RUN_ID;
  return {
    cpuModel: cpus()[0]?.model ?? "unknown",
    logicalCpus: cpus().length,
    memoryGb: Math.round((totalmem() / 1024 ** 3) * 10) / 10,
    node: process.version,
    k6Image,
    commit: process.env.GITHUB_SHA ?? null,
    runUrl: repo && runId ? `https://github.com/${repo}/actions/runs/${runId}` : null,
  };
}

export interface CpuFigures {
  cpuSeconds: number;
  perRequestMs: number | null;
  /** CPU seconds per second of the run, i.e. the cores the service used on average. */
  coresUsed: number | null;
}

export interface RunResult {
  scenario: string;
  ok: boolean;
  startedAt: string;
  durationSeconds: number;
  runner: RunnerInfo;
  config: Record<string, string | number | boolean>;
  checks: Check[];
  outcomes?: Outcomes;
  spike?: SpikeFigures;
  steps?: StepResult[];
  sustainableRate?: number | null;
  firstBrokenRate?: number | null;
  cpu: CpuFigures | null;
  memory?: { firstMb: number; lastMb: number; growthPercent: number } | null;
  notes: string[];
}

const fmt = (n: number | null | undefined, digits = 1) => (n === null || n === undefined ? "n/a" : n.toFixed(digits));

export function renderResult(r: RunResult): string {
  const lines: string[] = [];
  lines.push(`## Load run: ${r.scenario} — ${r.ok ? "all checks held" : "A CHECK FAILED"}`, "");
  lines.push(`- Runner: ${r.runner.logicalCpus} logical CPUs (${r.runner.cpuModel}), ${r.runner.memoryGb} GB, Node ${r.runner.node}, \`${r.runner.k6Image}\``);
  if (r.runner.runUrl) lines.push(`- Run: ${r.runner.runUrl}${r.runner.commit ? ` at \`${r.runner.commit.slice(0, 7)}\`` : ""}`);
  lines.push(`- Configuration: ${Object.entries(r.config).map(([k, v]) => `${k}=${v}`).join(", ")}`);
  lines.push(`- Duration: ${fmt(r.durationSeconds, 0)} s`, "");

  if (r.spike) {
    const s = r.spike;
    lines.push("| Figure | Value |", "|---|---|");
    lines.push(`| Target arrival rate | ${s.targetRate} req/s |`);
    lines.push(`| Requests completed | ${s.requests} |`);
    lines.push(`| Rate achieved (completed requests over the run) | ${fmt(s.achievedRate)} req/s |`);
    lines.push(`| Iterations k6 had to drop (no free VU) | ${s.droppedIterations} |`);
    lines.push(`| Target rate sustained | ${s.rateSustained ? "yes" : "NO — the runner or the service did not hold it"} |`);
    lines.push(`| p95, all attempts | ${fmt(s.p95AllMs)} ms |`);
    lines.push(`| p95, registered (201) | ${fmt(s.p95RegisteredMs)} ms |`);
    lines.push(`| p95, refused (409) | ${fmt(s.p95RefusedMs)} ms |`);
    lines.push(`| SLO ${s.sloMs} ms | ${s.sloMet === null ? "not measured" : s.sloMet ? "met at the rate achieved" : "NOT met at the rate achieved"} |`, "");
  }
  if (r.outcomes) {
    const o = r.outcomes;
    lines.push(`Responses: ${o.registered} registered (201), ${o.full} refused REGISTRATION_FULL, ${o.otherConflict + o.outsideWindow} other refusals, ${o.rateLimited} rate-limited, ${o.serverErrors} server errors, ${o.otherStatus} other (timeouts); ${o.withdrawn} withdrawals, ${o.readsOk} reads ok, ${o.readsFailed + o.withdrawFailed} reads or withdrawals failed.`, "");
  }
  if (r.steps) {
    lines.push("| Step | Target req/s | Requests (expected) | Failed | p95 ms | Held |", "|---|---|---|---|---|---|");
    for (const s of r.steps) lines.push(`| ${s.step} | ${s.targetRate} | ${s.requests} (${Math.round(s.expectedRequests)}) | ${s.failed} | ${fmt(s.p95Ms)} | ${s.held ? "yes" : "no"} |`);
    lines.push("", `Highest step that held before the first break: ${r.sustainableRate ?? "none"} req/s. First step that broke: ${r.firstBrokenRate ?? "none (the top step held)"}.`, "");
  }
  if (r.cpu) {
    lines.push(`CPU used by the registration process during the load: ${fmt(r.cpu.cpuSeconds, 2)} CPU-seconds, ${fmt(r.cpu.perRequestMs, 3)} ms per request, ${fmt(r.cpu.coresUsed, 2)} cores on average.`, "");
  }
  if (r.memory) lines.push(`Resident memory: ${fmt(r.memory.firstMb, 0)} MB in the second minute, ${fmt(r.memory.lastMb, 0)} MB in the last minute (${fmt(r.memory.growthPercent)}%).`, "");

  lines.push("| Check | Result | Detail |", "|---|---|---|");
  for (const c of r.checks) lines.push(`| ${c.name} | ${c.ok ? "held" : "**FAILED**"} | ${c.detail} |`);
  if (r.notes.length) lines.push("", ...r.notes.map((n) => `- ${n}`));
  return lines.join("\n") + "\n";
}
