/**
 * ADR-0004's second boundary check: a module's SQL touches only its own
 * schema. dependency-cruiser guards the imports; this guards the queries,
 * which an import rule cannot see. Cross-module reads go through the other
 * module's index.ts, never through its tables.
 */

/** Each module owns the Postgres schema of the same name. */
export const MODULES = ["identity", "event", "venue", "equipment", "change"] as const;
export type ModuleName = (typeof MODULES)[number];

export interface SourceFile {
  /** Relative to the planning-core folder, with forward slashes. */
  path: string;
  text: string;
}

export interface Violation {
  path: string;
  line: number;
  /** The module the file belongs to, or "shared" for code outside every module. */
  module: ModuleName | "shared";
  /** The other module's schema it names. */
  schema: ModuleName;
  text: string;
}

export function owningModule(path: string): ModuleName | "shared" {
  const match = /^(?:src\/modules|migrations)\/([^/]+)\//.exec(path);
  const name = match?.[1];
  return MODULES.includes(name as ModuleName) ? (name as ModuleName) : "shared";
}

// A schema-qualified table follows one of these keywords in every statement
// that reads or changes it: select/delete (from), join, insert (into), update,
// create/alter/drop/truncate (table, exists), a foreign key (references) and
// create index (on). The keyword and the table may be on different lines.
//
// This is a guard, not a proof of isolation: it misses a table reached any
// other way (a comma join, a dynamic identifier), and it can flag prose that
// happens to read like SQL. Review still applies.
const TABLE_REFERENCE = new RegExp(
  `\\b(?:from|join|into|update|table|exists|truncate|references|on)\\s+"?(${MODULES.join("|")})"?\\s*\\.\\s*"?[a-z_]`,
  "gid"
);

export function findSchemaViolations(files: readonly SourceFile[]): Violation[] {
  return files.flatMap((file) => {
    const owner = owningModule(file.path);
    const lines = file.text.split(/\r?\n/);

    return [...file.text.matchAll(TABLE_REFERENCE)]
      .map((match) => ({ schema: match[1]!.toLowerCase() as ModuleName, at: match.indices![1]![0] }))
      .filter(({ schema }) => schema !== owner)
      .map(({ schema, at }) => {
        const line = file.text.slice(0, at).split("\n").length;
        return { path: file.path, line, module: owner, schema, text: lines[line - 1]!.trim() };
      });
  });
}
