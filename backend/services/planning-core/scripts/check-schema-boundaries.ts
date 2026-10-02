import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { findSchemaViolations, type SourceFile } from "./schemaBoundaries.js";

/**
 * `npm run lint:boundaries` (second half): fails when any file under src/ or
 * migrations/ names another module's schema. Run from anywhere.
 */

const root = fileURLToPath(new URL("..", import.meta.url));

function listFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return listFiles(path);
    return /\.(ts|sql)$/.test(entry.name) ? [path] : [];
  });
}

const files: SourceFile[] = ["src", "migrations"]
  .flatMap((dir) => listFiles(join(root, dir)))
  .map((path) => ({ path: relative(root, path).split(sep).join("/"), text: readFileSync(path, "utf8") }));

const violations = findSchemaViolations(files);

if (violations.length > 0) {
  for (const v of violations) {
    console.error(`${v.path}:${v.line}  ${v.module} names the ${v.schema} schema  →  ${v.text}`);
  }
  console.error(
    `\n${violations.length} schema boundary violation(s). A module may query only its own schema;` +
      " read another module's data through its index.ts (ADR-0004)."
  );
  process.exit(1);
}

console.log(`schema boundaries ok: ${files.length} files checked`);
