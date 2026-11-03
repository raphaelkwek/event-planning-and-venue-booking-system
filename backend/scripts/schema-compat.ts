#!/usr/bin/env node
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runCli, type CliDeps } from "../packages/contracts/src/compat/cli.js";
import { generatedSnapshotFiles } from "../packages/contracts/src/compat/snapshot.js";
import { baseSnapshots, committedSnapshots, jsonFiles, schemaDir } from "./lib/schemaFiles.js";

// npm run schemas:generate | schemas:check | schemas:compat -- --base <git-ref>
// (EN-05, ADR-0008.) The logic is in contracts/src/compat/cli.ts; this file only
// reads and writes the schema files and asks git for the ones at another ref.

const deps: CliDeps = {
  generated: generatedSnapshotFiles,
  committed: committedSnapshots,
  writeCommitted(files) {
    mkdirSync(schemaDir, { recursive: true });
    for (const name of jsonFiles(readdirSync(schemaDir))) rmSync(join(schemaDir, name));
    for (const [name, text] of files) writeFileSync(join(schemaDir, name), text);
  },
  baseSnapshots,
  print: (line) => console.log(line),
};

try {
  process.exitCode = runCli(process.argv.slice(2), deps);
} catch (error) {
  console.error((error as Error).message);
  process.exitCode = 2;
}
