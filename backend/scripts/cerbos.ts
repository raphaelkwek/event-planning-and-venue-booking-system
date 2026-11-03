#!/usr/bin/env node
/**
 * Runs the Cerbos CLI without Docker (EN-07, ADR-0010): downloads the pinned
 * release once, checks it against the release's published SHA-256, caches it
 * under node_modules/.cache/cerbos/, then runs it with the arguments given.
 *
 * - `npm run policies:test` compiles policies/ and runs its tests.
 * - `npm run cerbos:start` (and so `npm run dev`) starts the policy decision
 *   point (PDP) on policies/, at http://127.0.0.1:3592, which is CERBOS_URL's
 *   local value. It reloads a policy when the file changes.
 *
 * Cerbos publishes Linux and macOS builds only. On Windows this runs the Linux
 * build inside WSL when a Linux distribution is installed (WSL 2 forwards the
 * port, so http://127.0.0.1:3592 works from Windows). Without one it says how
 * to get one. For `server` it then exits 0, so `npm run dev` keeps running and
 * planning-core, finding no PDP, uses its development-only local-policies mode
 * (src/shared/authz/startup.ts); for anything else it exits 1 rather than
 * pretending the policy tests passed.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const VERSION = "0.56.0";
const RELEASES = `https://github.com/cerbos/cerbos/releases/download/v${VERSION}`;
const CACHE = join(process.cwd(), "node_modules", ".cache", "cerbos", VERSION);
const BINARY = join(CACHE, "cerbos");
const WINDOWS = process.platform === "win32";
const SERVING = process.argv[2] === "server";

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function assetName(): string {
  // On Windows the Linux build is fetched, to run inside WSL.
  const os = WINDOWS ? "Linux" : { linux: "Linux", darwin: "Darwin" }[process.platform as string];
  const arch = { x64: "x86_64", arm64: "arm64" }[process.arch as string];
  if (!os || !arch) fail(`No Cerbos ${VERSION} build for ${process.platform}/${process.arch}.`);
  return `cerbos_${VERSION}_${os}_${arch}.tar.gz`;
}

async function download(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) fail(`Download failed (${response.status}): ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

async function install(): Promise<void> {
  const asset = assetName();
  const checksums = (await download(`${RELEASES}/checksums.txt`)).toString("utf8");
  const expected = checksums
    .split("\n")
    .map((line) => line.trim().split(/\s+/))
    .find(([, name]) => name === asset)?.[0];
  if (!expected) fail(`${asset} is not listed in the release's checksums.txt.`);

  const archive = await download(`${RELEASES}/${asset}`);
  const actual = createHash("sha256").update(archive).digest("hex");
  if (actual !== expected) fail(`Checksum mismatch for ${asset}: expected ${expected}, got ${actual}.`);

  mkdirSync(CACHE, { recursive: true });
  const archivePath = join(CACHE, asset);
  writeFileSync(archivePath, archive);
  const untar = spawnSync("tar", ["-xzf", archivePath, "-C", CACHE, "cerbos"], { stdio: "inherit" });
  if (untar.status !== 0) fail(`Could not extract ${asset}.`);
  chmodSync(BINARY, 0o755);
  console.log(`Installed Cerbos ${VERSION} (SHA-256 verified) to ${CACHE}`);
}

/** The first installed WSL distribution that can run a Linux binary (Docker Desktop's can't). */
function wslDistribution(): string | null {
  const listed = spawnSync("wsl.exe", ["-l", "-q"]);
  if (listed.status !== 0 || !listed.stdout) return null;
  const names = listed.stdout
    .toString("utf16le")
    .split(/\r?\n/)
    .map((name) => name.replace(/\0/g, "").trim())
    .filter((name) => name.length > 0 && !name.startsWith("docker-desktop"));
  return names[0] ?? null;
}

function toWslPath(distribution: string, windowsPath: string): string {
  const converted = spawnSync("wsl.exe", ["-d", distribution, "-e", "wslpath", "-a", windowsPath], { encoding: "utf8" });
  if (converted.status !== 0) fail(`WSL could not translate ${windowsPath}.`);
  return converted.stdout.trim();
}

function noWsl(): never {
  const message =
    "Cerbos has no Windows build, and no WSL Linux distribution is installed to run its Linux build.\n" +
    "Install one with `wsl --install -d Ubuntu`, then run this again. CI runs the policy tests and a PDP on every pull request.";
  if (SERVING) {
    console.warn(
      `${message}\nUntil then planning-core, in development, evaluates policies/ itself (its log says LOCAL-POLICIES MODE); in production it never does, and refuses with 503 POLICY_UNAVAILABLE.`
    );
    process.exit(0);
  }
  fail(message);
}

/** A --config=… path or a path argument is a Windows path; WSL needs its own form of it. */
function argsForWsl(distribution: string, args: string[]): string[] {
  return args.map((arg) => {
    const config = arg.match(/^--config=(.+)$/);
    if (config) return `--config=${toWslPath(distribution, resolve(config[1]!))}`;
    return existsSync(arg) ? toWslPath(distribution, resolve(arg)) : arg;
  });
}

const args = process.argv.slice(2);
// Look for WSL before downloading anything, so a machine without it isn't sent a binary it can't run.
const distribution = WINDOWS ? wslDistribution() : null;
if (WINDOWS && !distribution) noWsl();
if (!existsSync(BINARY)) await install();

const run = distribution
  ? spawnSync(
      "wsl.exe",
      ["-d", distribution, "--cd", toWslPath(distribution, process.cwd()), "-e", toWslPath(distribution, BINARY), ...argsForWsl(distribution, args)],
      { stdio: "inherit" }
    )
  : spawnSync(BINARY, args, { stdio: "inherit" });
process.exit(run.status ?? 1);
