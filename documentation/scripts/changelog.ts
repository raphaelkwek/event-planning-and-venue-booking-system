#!/usr/bin/env node
/**
 * Prints the whole changelog, newest first: every changelog/<YYYY-MM-DD>-<branch-or-slug>.md
 * fragment, then the entries CHANGELOG.md held before fragments began (implementation.md §11.2).
 *
 * Usage: npm run changelog [-- --out <path>]
 */
import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { readCombinedChangelog } from "./confluence-digest.ts";

export function main(args: string[] = process.argv.slice(2), root: string = process.cwd()): string {
  const log = readCombinedChangelog(root);
  const at = args.indexOf("--out");
  if (at !== -1 && args[at + 1]) writeFileSync(args[at + 1]!, log, "utf8");
  else process.stdout.write(log);
  return log;
}

const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main();
}
