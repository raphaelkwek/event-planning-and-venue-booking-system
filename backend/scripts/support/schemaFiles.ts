import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Reading the committed JSON Schema files, in the working tree and at a git ref.
// Shared by schema-compat.ts and schema-registry-check.ts (EN-05).

export const SCHEMA_DIR = "backend/packages/contracts/schemas";

export const repoRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
export const schemaDir = join(repoRoot, SCHEMA_DIR);

const git = (...args: string[]) =>
  execFileSync("git", args, { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

export const jsonFiles = (names: string[]) => names.filter((name) => name.endsWith(".json"));

/** The files in the working tree, file name to text. A Windows checkout may have turned LF into CRLF. */
export function committedSnapshots(): Map<string, string> {
  try {
    return new Map(
      jsonFiles(readdirSync(schemaDir)).map((name) => [name, readFileSync(join(schemaDir, name), "utf8").replaceAll("\r\n", "\n")]),
    );
  } catch {
    return new Map();
  }
}

/** The files committed at a git ref, or null when that ref has none yet. Throws when the ref does not exist. */
export function baseSnapshots(ref: string): Map<string, string> | null {
  git("rev-parse", "--verify", "--quiet", `${ref}^{commit}`);
  const listed = git("ls-tree", "-r", "--name-only", ref, "--", SCHEMA_DIR).split("\n").filter(Boolean);
  if (listed.length === 0) return null;
  return new Map(jsonFiles(listed).map((path) => [path.slice(SCHEMA_DIR.length + 1), git("show", `${ref}:${path}`)]));
}
