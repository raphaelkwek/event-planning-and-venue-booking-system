#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runCli, type CliDeps } from "../packages/contracts/src/compat/cli.js";
import { generatedSnapshotFiles } from "../packages/contracts/src/compat/snapshot.js";

// npm run schemas:generate | schemas:check | schemas:compat -- --base <git-ref>
// (EN-05, ADR-0008.) The logic is in contracts/src/compat/cli.ts; this file only
// reads and writes the schema files and asks git for the ones at another ref.

const SCHEMA_DIR = "backend/packages/contracts/schemas";

const repoRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
const dir = join(repoRoot, SCHEMA_DIR);

const git = (...args: string[]) => execFileSync("git", args, { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

const jsonFiles = (names: string[]) => names.filter((name) => name.endsWith(".json"));

const deps: CliDeps = {
  generated: generatedSnapshotFiles,
  committed() {
    try {
      // A Windows checkout may have turned the committed LF into CRLF.
      return new Map(jsonFiles(readdirSync(dir)).map((name) => [name, readFileSync(join(dir, name), "utf8").replaceAll("\r\n", "\n")]));
    } catch {
      return new Map();
    }
  },
  writeCommitted(files) {
    mkdirSync(dir, { recursive: true });
    for (const name of jsonFiles(readdirSync(dir))) rmSync(join(dir, name));
    for (const [name, text] of files) writeFileSync(join(dir, name), text);
  },
  baseSnapshots(ref) {
    git("rev-parse", "--verify", "--quiet", `${ref}^{commit}`);
    const listed = git("ls-tree", "-r", "--name-only", ref, "--", SCHEMA_DIR).split("\n").filter(Boolean);
    if (listed.length === 0) return null;
    return new Map(
      jsonFiles(listed).map((path) => [path.slice(SCHEMA_DIR.length + 1), git("show", `${ref}:${path}`)]),
    );
  },
  print: (line) => console.log(line),
};

try {
  process.exitCode = runCli(process.argv.slice(2), deps);
} catch (error) {
  console.error((error as Error).message);
  process.exitCode = 2;
}
