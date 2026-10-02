#!/usr/bin/env node
/**
 * Runs the Cerbos CLI without Docker (EN-07.1, ADR-0010): downloads the pinned
 * release for this platform once, checks it against the release's published
 * SHA-256, caches it under node_modules/.cache/cerbos/, then runs it with the
 * arguments given. `npm run policies:test` uses it to compile the policies in
 * policies/ and run their tests.
 *
 * Cerbos publishes Linux and macOS builds only. On Windows this explains the
 * options and exits non-zero rather than pretending the tests passed.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const VERSION = "0.56.0";
const RELEASES = `https://github.com/cerbos/cerbos/releases/download/v${VERSION}`;
const CACHE = join(process.cwd(), "node_modules", ".cache", "cerbos", VERSION);
const BINARY = join(CACHE, "cerbos");

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function assetName(): string {
  const os = { linux: "Linux", darwin: "Darwin" }[process.platform as string];
  const arch = { x64: "x86_64", arm64: "arm64" }[process.arch as string];
  if (process.platform === "win32") {
    fail(
      "Cerbos has no Windows build, so the policy tests can't run natively here.\n" +
        "They run in CI on every pull request (the 'Permission policy tests' step).\n" +
        "To run them locally, use WSL: `wsl --install -d Ubuntu`, then run `npm run policies:test` inside it."
    );
  }
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

if (!existsSync(BINARY)) await install();
const run = spawnSync(BINARY, process.argv.slice(2), { stdio: "inherit" });
process.exit(run.status ?? 1);
