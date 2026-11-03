import { spawn } from "node:child_process";
import { chmodSync, closeSync, mkdirSync, openSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { userInfo } from "node:os";
import { REPO_ROOT } from "./stack.js";
import type { K6Summary } from "./evaluate.js";

/**
 * Runs a k6 script with the grafana/k6 image, on the runner's own network so 127.0.0.1 is the service
 * under test (EN-18, EN-20). Containers are allowed in CI only (ADR-0012); this is for the load workflow.
 */

export const K6_IMAGE = "grafana/k6:1.4.0";
export const K6_SCRIPTS = join(REPO_ROOT, "load/k6");

export interface K6Run {
  exitCode: number;
  summary: K6Summary;
  logPath: string;
  summaryPath: string;
  startedAt: Date;
  finishedAt: Date;
}

export async function runK6(options: { script: string; env: Record<string, string>; outDir: string }): Promise<K6Run> {
  mkdirSync(options.outDir, { recursive: true });
  // The image runs as an unprivileged user; it must be able to write its summary into the folder we mount.
  chmodSync(options.outDir, 0o777);
  const logPath = join(options.outDir, "k6.log");
  const summaryPath = join(options.outDir, "k6-summary.json");
  const log = openSync(logPath, "a");
  const { uid, gid } = userInfo();
  const envArgs = Object.entries({ ...options.env, SUMMARY_FILE: "/out/k6-summary.json" }).flatMap(([k, v]) => ["-e", `${k}=${v}`]);
  const args = [
    "run",
    "--rm",
    "--network",
    "host",
    ...(uid >= 0 ? ["--user", `${uid}:${gid}`] : []),
    "-v",
    `${K6_SCRIPTS}:/scripts:ro`,
    "-v",
    `${options.outDir}:/out`,
    ...envArgs,
    K6_IMAGE,
    "run",
    `/scripts/${options.script}`,
  ];
  const startedAt = new Date();
  const exitCode = await new Promise<number>((resolve, reject) => {
    const child = spawn("docker", args, { stdio: ["ignore", log, log] });
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });
  closeSync(log);
  const finishedAt = new Date();
  let summary: K6Summary;
  try {
    summary = JSON.parse(readFileSync(summaryPath, "utf8")) as K6Summary;
  } catch (error) {
    throw new Error(`k6 exited ${exitCode} without a summary (${(error as Error).message}); see ${logPath}`);
  }
  return { exitCode, summary, logPath, summaryPath, startedAt, finishedAt };
}
