import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { EVENT_STATUSES } from "@connectsphere/contracts";

/**
 * F1 AC2 — status changes only through a defined action. In code that means
 * one statement writes `event.events.status` (repo/eventStatus.ts, reached
 * through transitionEvent), and a new event starts as a Draft. This test fails
 * if a later change adds another way.
 *
 * It reads SQL written as tagged templates. A status set through a dynamic
 * column list (`${tx(columns)}`) is not visible to it; AMENDABLE_COLUMNS is
 * what keeps status out of the amendable columns. Likewise SQL fragments
 * spliced into an `update event.events` from elsewhere (`${fragment}`) are not
 * inspected, and migrations/ is not scanned (a trigger could still write
 * status). Reviewers own those.
 */

const SRC = join(__dirname, "../../../src/modules/event");
const THE_ONE_WRITER = join(SRC, "repo/eventStatus.ts");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sourceFiles(path) : path.endsWith(".ts") ? [path] : [];
  });
}

/** The text of each `update event.events …` / `insert into event.events …` up to the closing backtick. */
function statements(source: string, pattern: RegExp): string[] {
  return [...source.matchAll(pattern)].map((match) => match[1] ?? "");
}

/**
 * Only the SET clause counts: `where … status = 'DRAFT'` (repo/drafts.ts)
 * filters on status and must not be mistaken for writing it.
 */
export function updatesSetStatus(source: string): boolean {
  return statements(source, /update\s+"?event"?\s*\.\s*"?events"?\b([\s\S]*?)`/gi).some((text) => {
    const setClause = /\bset\b([\s\S]*?)(?:\bwhere\b|\bfrom\b|\breturning\b|$)/i.exec(text)?.[1] ?? "";
    return /\b"?status"?\s*=/i.test(setClause);
  });
}

export function insertsPastDraft(source: string): boolean {
  const pastDraft = EVENT_STATUSES.filter((status) => status !== "DRAFT");
  return statements(source, /insert\s+into\s+"?event"?\s*\.\s*"?events"?\b([\s\S]*?)`/gi).some((text) => {
    const literalPastDraft = pastDraft.some((status) => text.includes(`'${status}'`));
    const columns = /\(([\s\S]*?)\)/.exec(text)?.[1] ?? "";
    const namesStatus = /\b"?status"?\b/i.test(columns);
    return literalPastDraft || (namesStatus && !text.includes("'DRAFT'"));
  });
}

describe("status writes (F1)", () => {
  it("recognises a status write and an insert past Draft when it sees them", () => {
    expect(updatesSetStatus("update event.events set status = 'APPROVED' where id = $1`")).toBe(true);
    expect(updatesSetStatus("update event.events set name = $1 where id = $2`")).toBe(false);
    expect(
      updatesSetStatus("update event.events set name = $1 where id = $2 and status = 'DRAFT'`")
    ).toBe(false);
    expect(updatesSetStatus('UPDATE "event"."events" SET "status" = $1 where id = $2`')).toBe(true);
    expect(updatesSetStatus("update event.events set STATUS = $1 where id = $2`")).toBe(true);
    expect(insertsPastDraft("insert into event.events (name, status) values ($1, ${s})`")).toBe(true);
    expect(insertsPastDraft("insert into event.events (status) values ('SUBMITTED')`")).toBe(true);
    expect(insertsPastDraft("insert into event.events (status) values ('DRAFT')`")).toBe(false);
  });

  it("has no statement other than updateStatusIf that sets an event's status", () => {
    const offenders = sourceFiles(SRC)
      .filter((file) => file !== THE_ONE_WRITER)
      .filter((file) => updatesSetStatus(readFileSync(file, "utf8")))
      .map((file) => relative(SRC, file));

    expect(offenders).toEqual([]);
  });

  it("inserts events at Draft only", () => {
    const offenders = sourceFiles(SRC)
      .filter((file) => insertsPastDraft(readFileSync(file, "utf8")))
      .map((file) => relative(SRC, file));

    expect(offenders).toEqual([]);
  });
});
