import { describe, expect, it } from "vitest";
import type { TransactionSql } from "postgres";
import { previewChangeRequest } from "../../../src/modules/change/repo/changeImpact.js";

// G2 — a role that cannot see change requests is refused before anything is read; no database
// needed. Every other case is in the API cards (tests/change/api/g2Cards.test.ts).

const untouchable = new Proxy(() => undefined, {
  apply: () => {
    throw new Error("the database was read");
  },
  get: () => {
    throw new Error("the database was read");
  },
}) as unknown as TransactionSql;

describe("previewChangeRequest (G2)", () => {
  it.each(["VENUE_STAFF", "TECH_SUPPORT_STAFF", "ATTENDEE"] as const)(
    "answers NOT_FOUND to %s without reading anything",
    async (role) => {
      await expect(
        previewChangeRequest(untouchable, "6b3c1f6e-0000-4000-8000-000000000001", { userId: "u1", role })
      ).resolves.toEqual({ ok: false, code: "NOT_FOUND" });
    }
  );
});
