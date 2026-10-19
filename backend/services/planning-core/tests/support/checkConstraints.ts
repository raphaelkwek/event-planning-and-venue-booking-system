import { readFileSync } from "node:fs";

/**
 * implementation.md §4.1: permitted values are `text` plus a check constraint,
 * and the list itself lives in contracts. The boundaries tests use this to
 * compare a migration's lists with contracts, so the two can't drift apart.
 */

export function readMigration(relativeToPlanningCore: string): string {
  return readFileSync(new URL(`../../${relativeToPlanningCore}`, import.meta.url), "utf8");
}

/** The quoted values of the first `check (<column> in (...))` after `after` in the migration. */
export function checkedValues(migration: string, column: string, after: string): string[] {
  const start = migration.indexOf(after);
  const match = new RegExp(`check \\(${column} in \\(([^)]*)\\)\\)`).exec(migration.slice(Math.max(start, 0)));
  if (start < 0 || !match) throw new Error(`no check constraint on ${column} after "${after}"`);
  return [...match[1]!.matchAll(/'([^']+)'/g)].map((m) => m[1]!);
}
