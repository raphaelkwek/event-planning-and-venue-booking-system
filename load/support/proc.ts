import { spawn, execFileSync, type ChildProcess } from "node:child_process";
import { closeSync, mkdirSync, openSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Starting, watching and stopping the processes of a load or chaos run (EN-18, EN-20).
 * Linux-only where it measures (/proc); CI is Linux, and a laptop gets nulls rather than numbers.
 */

export interface ManagedProcess {
  name: string;
  pid: number;
  logPath: string;
  /** Resolves with the exit code (null when killed by a signal) once the process is gone. */
  exited: Promise<number | null>;
  stop(signal?: NodeJS.Signals): Promise<void>;
}

export interface StartOptions {
  name: string;
  command: string;
  args: string[];
  cwd: string;
  env: Record<string, string>;
  logDir: string;
}

export function startProcess(options: StartOptions): ManagedProcess {
  mkdirSync(options.logDir, { recursive: true });
  const logPath = join(options.logDir, `${options.name}.log`);
  const log = openSync(logPath, "a");
  const child: ChildProcess = spawn(options.command, options.args, {
    cwd: options.cwd,
    // Only what the stack needs: the shell's own settings (a teammate's DATABASE_URL, KAFKA_*) never leak in.
    env: { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "", ...options.env },
    stdio: ["ignore", log, log],
  });
  closeSync(log);
  if (child.pid === undefined) throw new Error(`${options.name} did not start`);

  const exited = new Promise<number | null>((resolve) => child.once("exit", (code) => resolve(code)));
  return {
    name: options.name,
    pid: child.pid,
    logPath,
    exited,
    async stop(signal = "SIGTERM") {
      if (child.exitCode !== null || child.signalCode !== null) return;
      child.kill(signal);
      const timer = setTimeout(() => child.kill("SIGKILL"), 10_000);
      await exited;
      clearTimeout(timer);
    },
  };
}

export async function waitForUrl(url: string, timeoutMs: number, accept: (status: number) => boolean = (s) => s < 500): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let last = "no answer";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (accept(response.status)) return;
      last = `status ${response.status}`;
    } catch (error) {
      last = (error as Error).message;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`${url} did not come up in ${timeoutMs} ms (${last})`);
}

export interface ProcUsage {
  /** User + system CPU time the process (all its threads) has used, in seconds. */
  cpuSeconds: number;
  rssMegabytes: number;
}

let clockTicks: number | null = null;

function ticksPerSecond(): number {
  clockTicks ??= Number(execFileSync("getconf", ["CLK_TCK"], { encoding: "utf8" }).trim());
  return clockTicks;
}

/** The CPU time and resident memory of a process, or null where /proc is not there. */
export function readProcUsage(pid: number): ProcUsage | null {
  try {
    const stat = readFileSync(`/proc/${pid}/stat`, "utf8");
    // The process name sits in brackets and may hold spaces; the fields that follow it do not.
    const fields = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
    const userTicks = Number(fields[11]);
    const systemTicks = Number(fields[12]);
    const residentPages = Number(readFileSync(`/proc/${pid}/statm`, "utf8").split(" ")[1]);
    const pageSize = Number(execFileSync("getconf", ["PAGESIZE"], { encoding: "utf8" }).trim());
    if (![userTicks, systemTicks, residentPages].every(Number.isFinite)) return null;
    return {
      cpuSeconds: (userTicks + systemTicks) / ticksPerSecond(),
      rssMegabytes: (residentPages * pageSize) / (1024 * 1024),
    };
  } catch {
    return null;
  }
}

export interface UsageSample {
  atSeconds: number;
  cpuSeconds: number;
  rssMegabytes: number;
}

/** Samples a process every `everyMs` until stopped. */
export function sampleUsage(pid: number, everyMs: number): { stop(): UsageSample[] } {
  const startedAt = Date.now();
  const samples: UsageSample[] = [];
  const take = () => {
    const usage = readProcUsage(pid);
    if (usage) samples.push({ atSeconds: Math.round((Date.now() - startedAt) / 100) / 10, ...usage });
  };
  take();
  const timer = setInterval(take, everyMs);
  return {
    stop() {
      clearInterval(timer);
      take();
      return samples;
    },
  };
}
