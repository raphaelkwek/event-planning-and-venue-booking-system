import { describe, expect, it, vi } from "vitest";
import type { Sql } from "postgres";
import { findEventInScope } from "../../../src/modules/event/repo/events.js";
import {
  findDraftForOwner,
  findOwnedRequest,
  isOwnedBy,
  updateDraft,
} from "../../../src/modules/event/repo/drafts.js";

/**
 * An id from the URL that isn't a UUID would make Postgres refuse the query
 * (22P02), and Express 4 leaves an async handler's rejection unhandled, which
 * stops the process. The lookups answer "no such event" without querying, so
 * each route gives its usual 404.
 */

const NOT_A_UUID = "not-a-uuid";
const OWNER = "3f1c2a4e-9b7d-4e2a-8c1f-0a2b3c4d5e6f";

function databaseThatMustNotBeQueried() {
  const query = vi.fn(() => {
    throw new Error("queried the database");
  });
  return { sql: query as unknown as Sql, query };
}

describe("event lookups with an id that isn't a UUID", () => {
  it("findEventInScope answers null without querying", async () => {
    const { sql, query } = databaseThatMustNotBeQueried();

    await expect(findEventInScope(sql, NOT_A_UUID, { scopeType: "ALL" }, OWNER)).resolves.toBeNull();
    expect(query).not.toHaveBeenCalled();
  });

  it("findDraftForOwner, findOwnedRequest and updateDraft answer null without querying", async () => {
    const { sql, query } = databaseThatMustNotBeQueried();

    await expect(findDraftForOwner(sql, NOT_A_UUID, OWNER)).resolves.toBeNull();
    await expect(findOwnedRequest(sql, NOT_A_UUID, OWNER)).resolves.toBeNull();
    await expect(updateDraft(sql, NOT_A_UUID, OWNER, {} as never)).resolves.toBeNull();
    expect(query).not.toHaveBeenCalled();
  });

  it("isOwnedBy answers false without querying", async () => {
    const { sql, query } = databaseThatMustNotBeQueried();

    await expect(isOwnedBy(sql, NOT_A_UUID, OWNER)).resolves.toBe(false);
    expect(query).not.toHaveBeenCalled();
  });

  it("still queries for a real UUID", async () => {
    const { sql, query } = databaseThatMustNotBeQueried();

    await expect(findDraftForOwner(sql, OWNER, OWNER)).rejects.toThrow("queried the database");
    expect(query).toHaveBeenCalled();
  });
});
