import { afterEach, describe, expect, it, vi } from "vitest";
import type { Sql } from "postgres";
import { listHeldHolds, scheduleHoldExpiries, type HeldHold } from "../../src/modules/venue/jobs/scheduleHoldExpiries.js";
import { logger } from "../../src/shared/logger.js";

/** L6 — the backfill that starts an expiry timer for every hold placed before L6, with a fake scheduler and a fake database. */

afterEach(() => vi.restoreAllMocks());

const hold = (n: number): HeldHold => ({
  holdId: `00000000-0000-4000-8000-00000000000${n}`,
  expiresAt: `2026-11-2${n}T09:00:00.000Z`,
  reminderLeadMinutes: 60,
});

describe("listHeldHolds", () => {
  it("reads the Held holds with an expiry, as the ids, instants and lead times the scheduler takes", async () => {
    let query = "";
    const sql = (async (strings: TemplateStringsArray) => {
      query = strings.join("?");
      return [{ id: hold(1).holdId, expiresAt: new Date("2026-11-21T09:00:00.000Z"), reminderLeadMinutes: 60 }];
    }) as unknown as Sql;

    expect(await listHeldHolds(sql)).toEqual([hold(1)]);
    expect(query).toContain("status = 'HELD'");
  });
});

describe("scheduleHoldExpiries", () => {
  it("schedules every held hold and exits 0", async () => {
    const info = vi.spyOn(logger, "info").mockImplementation(() => undefined);
    const scheduled: HeldHold[] = [];

    const code = await scheduleHoldExpiries([hold(1), hold(2)], { schedule: async (h) => void scheduled.push(h) });

    expect(code).toBe(0);
    expect(scheduled).toEqual([hold(1), hold(2)]);
    expect(info).toHaveBeenCalledWith("hold expiry backfill finished", { held: 2, scheduled: 2, failed: 0 });
  });

  it("does nothing, successfully, when no hold is held", async () => {
    vi.spyOn(logger, "info").mockImplementation(() => undefined);
    expect(await scheduleHoldExpiries([], { schedule: async () => Promise.reject(new Error("unused")) })).toBe(0);
  });

  it("carries on past a failure, reports it and exits 1", async () => {
    const info = vi.spyOn(logger, "info").mockImplementation(() => undefined);
    const error = vi.spyOn(logger, "error").mockImplementation(() => undefined);
    const scheduled: string[] = [];

    const code = await scheduleHoldExpiries([hold(1), hold(2), hold(3)], {
      schedule: async (h) => {
        if (h.holdId === hold(2).holdId) throw new Error("Temporal unreachable");
        scheduled.push(h.holdId);
      },
    });

    expect(code).toBe(1);
    expect(scheduled).toEqual([hold(1).holdId, hold(3).holdId]);
    expect(info).toHaveBeenCalledWith("hold expiry backfill finished", { held: 3, scheduled: 2, failed: 1 });
    expect(error).toHaveBeenCalledWith("hold expiry could not be scheduled", { holdId: hold(2).holdId, error: "Temporal unreachable" });
  });
});
