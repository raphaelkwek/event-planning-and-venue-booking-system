import { compareSchemaSets, describeResult, type SchemaSet } from "./compareSnapshots.js";
import { nameFromFile } from "./snapshot.js";
import type { JsonSchema } from "./schemaCompat.js";

/**
 * The logic behind `npm run schemas:generate`, `schemas:check` and
 * `schemas:compat` (backend/scripts/schema-compat.ts is the thin shell that
 * supplies the file system and git). Everything it needs from outside comes in
 * as `deps`, so every branch is unit-tested without touching either.
 */

export interface CliDeps {
  /** File name to text, from the zod schemas in `contracts`. */
  generated(): Map<string, string>;
  /** The files committed in `backend/packages/contracts/schemas`. */
  committed(): Map<string, string>;
  /** Replaces the committed files with these. */
  writeCommitted(files: Map<string, string>): void;
  /** The files committed at a git ref, or null when that ref has none yet. Throws when the ref does not exist. */
  baseSnapshots(ref: string): Map<string, string> | null;
  print(line: string): void;
}

export const EXIT_OK = 0;
export const EXIT_BREAKING = 1;
export const EXIT_USAGE = 2;

const USAGE = "usage: schema-compat generate | check | compat --base <git-ref>";

function parseSet(files: Map<string, string>, where: string): SchemaSet {
  const set = new Map<string, JsonSchema>();
  for (const [fileName, text] of files) {
    try {
      set.set(nameFromFile(fileName), JSON.parse(text) as JsonSchema);
    } catch {
      throw new Error(`${where}: ${fileName} is not valid JSON`);
    }
  }
  return set;
}

function check(deps: CliDeps): number {
  const generated = deps.generated();
  const committed = deps.committed();
  const problems: string[] = [];
  for (const [fileName, text] of generated) {
    const have = committed.get(fileName);
    if (have === undefined) problems.push(`missing: ${fileName} is not committed`);
    else if (have !== text) problems.push(`differs: ${fileName} is not what contracts generates`);
  }
  for (const fileName of committed.keys()) {
    if (!generated.has(fileName)) problems.push(`stale: ${fileName} has no schema in contracts`);
  }
  if (problems.length === 0) {
    deps.print(`The ${generated.size} committed schema files match contracts.`);
    return EXIT_OK;
  }
  for (const problem of problems.sort()) deps.print(problem);
  deps.print("Run `npm run schemas:generate` and commit the result.");
  return EXIT_BREAKING;
}

function compat(args: string[], deps: CliDeps): number {
  const at = args.indexOf("--base");
  const ref = at >= 0 ? args[at + 1] : undefined;
  if (!ref) {
    deps.print(USAGE);
    return EXIT_USAGE;
  }
  let base: Map<string, string> | null;
  try {
    base = deps.baseSnapshots(ref);
  } catch (error) {
    deps.print(`Cannot read the schemas at "${ref}": ${(error as Error).message}`);
    return EXIT_USAGE;
  }
  if (base === null) {
    deps.print(`"${ref}" has no committed schema files yet, so there is nothing to compare with.`);
    return EXIT_OK;
  }
  let result;
  try {
    result = compareSchemaSets(parseSet(base, ref), parseSet(deps.generated(), "contracts"));
  } catch (error) {
    deps.print((error as Error).message);
    return EXIT_USAGE;
  }
  for (const line of describeResult(result, ref)) deps.print(line);
  return result.findings.length === 0 ? EXIT_OK : EXIT_BREAKING;
}

/** Runs one command and returns the process exit code. */
export function runCli(args: string[], deps: CliDeps): number {
  const [command, ...rest] = args;
  if (command === "generate") {
    const files = deps.generated();
    deps.writeCommitted(files);
    deps.print(`Wrote ${files.size} schema files.`);
    return EXIT_OK;
  }
  if (command === "check") return check(deps);
  if (command === "compat") return compat(rest, deps);
  deps.print(USAGE);
  return EXIT_USAGE;
}
