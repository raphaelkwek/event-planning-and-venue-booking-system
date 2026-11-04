import { afterEach, describe, expect, it, vi } from "vitest";
import type { CompletionSchedule } from "../../src/temporal/domain/completionTrigger.js";
import type { HoldExpirySchedule } from "../../src/temporal/domain/holdExpiryTrigger.js";
import { reconcileTimers, type TimerSources } from "../../src/temporal/reconcileTimers.js";
import { logger } from "../../src/shared/logger.js";

/**
 * EN-11-T4 — what the worker does when it starts: it asks the database which timers there should
 * be (every Confirmed event with an end, every Held hold) and signal-with-starts each one, so a
 * timer a redeploy lost comes back. Here the database and Temporal are fakes; the time-skipping
 * server test (reconcileTimersServer.unit.test.ts) runs the same reconcile against real workflows.
 */

afterEach(() => vi.restoreAllMocks());

const event = (n: number): CompletionSchedule => ({
  eventId: `00000000-0000-4000-8000-0000000000e${n}`,
  endsAt: `2026-11-0${n}T06:40:00.000Z`,
});
const hold = (n: number): HoldExpirySchedule => ({
  holdId: `00000000-0000-4000-8000-0000000000a${n}`,
  expiresAt: `2026-11-1${n}T09:00:00.000Z`,
  reminderLeadMinutes: 60,
});

function sources(events: CompletionSchedule[] | Error, holds: HoldExpirySchedule[] | Error): TimerSources {
  return {
    awaitingCompletion: async () => {
      if (events instanceof Error) throw events;
      return events;
    },
    heldHolds: async () => {
      if (holds instanceof Error) throw holds;
      return holds;
    },
  };
}

function recordingSchedulers(fail: { eventId?: string; holdId?: string } = {}) {
  const completions: CompletionSchedule[] = [];
  const expiries: HoldExpirySchedule[] = [];
  return {
    completions,
    expiries,
    schedulers: {
      completion: {
        async schedule(schedule: CompletionSchedule) {
          if (schedule.eventId === fail.eventId) throw new Error("Temporal unreachable");
          completions.push(schedule);
        },
      },
      holdExpiry: {
        async schedule(schedule: HoldExpirySchedule) {
          if (schedule.holdId === fail.holdId) throw new Error("Temporal unreachable");
          expiries.push(schedule);
        },
      },
    },
  };
}

/** The summary line the worker logs once it has reconciled. */
function summaryOf(info: ReturnType<typeof vi.spyOn>) {
  const call = info.mock.calls.find(([message]) => message === "timers reconciled");
  return call?.[1] as Record<string, unknown> | undefined;
}

describe("reconcileTimers (EN-11-T4)", () => {
  it("EN-11-T4 re-creates the completion timer of every listed event and the expiry timer of every held hold", async () => {
    const info = vi.spyOn(logger, "info").mockImplementation(() => undefined);
    const recorded = recordingSchedulers();

    const result = await reconcileTimers(sources([event(1), event(2)], [hold(1), hold(2), hold(3)]), recorded.schedulers);

    expect(recorded.completions).toEqual([event(1), event(2)]);
    expect(recorded.expiries).toEqual([hold(1), hold(2), hold(3)]);
    expect(result).toEqual({
      events: { listed: 2, scheduled: 2, failed: 0 },
      holds: { listed: 3, scheduled: 3, failed: 0 },
    });
    expect(summaryOf(info)).toMatchObject({
      route: "worker reconcile-timers",
      outcome: "success",
      code: null,
      userId: null,
      events: 2,
      eventsScheduled: 2,
      eventsFailed: 0,
      holds: 3,
      holdsScheduled: 3,
      holdsFailed: 0,
    });
  });

  it("does nothing, successfully, when no event or hold is waiting on a timer", async () => {
    const info = vi.spyOn(logger, "info").mockImplementation(() => undefined);
    const recorded = recordingSchedulers();

    const result = await reconcileTimers(sources([], []), recorded.schedulers);

    expect(recorded.completions).toEqual([]);
    expect(recorded.expiries).toEqual([]);
    expect(result).toEqual({ events: { listed: 0, scheduled: 0, failed: 0 }, holds: { listed: 0, scheduled: 0, failed: 0 } });
    expect(summaryOf(info)).toMatchObject({ outcome: "success", events: 0, holds: 0 });
  });

  it("EN-11-T4 carries on past an event or hold it cannot schedule, and logs each by id", async () => {
    const info = vi.spyOn(logger, "info").mockImplementation(() => undefined);
    const error = vi.spyOn(logger, "error").mockImplementation(() => undefined);
    const recorded = recordingSchedulers({ eventId: event(1).eventId, holdId: hold(2).holdId });

    const result = await reconcileTimers(sources([event(1), event(2)], [hold(1), hold(2), hold(3)]), recorded.schedulers);

    expect(recorded.completions).toEqual([event(2)]);
    expect(recorded.expiries).toEqual([hold(1), hold(3)]);
    expect(result).toEqual({
      events: { listed: 2, scheduled: 1, failed: 1 },
      holds: { listed: 3, scheduled: 2, failed: 1 },
    });
    expect(error).toHaveBeenCalledWith(
      "event completion timer could not be re-created",
      expect.objectContaining({ eventId: event(1).eventId, error: "Temporal unreachable", outcome: "error" })
    );
    expect(error).toHaveBeenCalledWith(
      "hold expiry timer could not be re-created",
      expect.objectContaining({ holdId: hold(2).holdId, error: "Temporal unreachable", outcome: "error" })
    );
    expect(summaryOf(info)).toMatchObject({ outcome: "error", eventsFailed: 1, holdsFailed: 1 });
  });

  it("EN-11-T4 logs a failure to list the events, still reconciles the holds, and does not throw", async () => {
    const info = vi.spyOn(logger, "info").mockImplementation(() => undefined);
    const error = vi.spyOn(logger, "error").mockImplementation(() => undefined);
    const recorded = recordingSchedulers();

    const result = await reconcileTimers(sources(new Error("database unreachable"), [hold(1)]), recorded.schedulers);

    expect(recorded.expiries).toEqual([hold(1)]);
    expect(result).toEqual({ events: { listed: null, scheduled: 0, failed: 0 }, holds: { listed: 1, scheduled: 1, failed: 0 } });
    expect(error).toHaveBeenCalledWith(
      "events awaiting completion could not be listed",
      expect.objectContaining({ error: "database unreachable", outcome: "error" })
    );
    expect(summaryOf(info)).toMatchObject({ outcome: "error", events: null, holds: 1 });
  });

  it("EN-11-T4 logs a failure to list the holds, still reconciles the events, and does not throw", async () => {
    vi.spyOn(logger, "info").mockImplementation(() => undefined);
    const error = vi.spyOn(logger, "error").mockImplementation(() => undefined);
    const recorded = recordingSchedulers();

    const result = await reconcileTimers(sources([event(1)], new Error("database unreachable")), recorded.schedulers);

    expect(recorded.completions).toEqual([event(1)]);
    expect(result).toEqual({ events: { listed: 1, scheduled: 1, failed: 0 }, holds: { listed: null, scheduled: 0, failed: 0 } });
    expect(error).toHaveBeenCalledWith("held holds could not be listed", expect.objectContaining({ error: "database unreachable" }));
  });

  it("reports a thrown value that is not an Error by its text", async () => {
    vi.spyOn(logger, "info").mockImplementation(() => undefined);
    const error = vi.spyOn(logger, "error").mockImplementation(() => undefined);
    const failing = {
      completion: {
        schedule: async () => {
          throw "refused";
        },
      },
      holdExpiry: { schedule: async () => undefined },
    };

    await reconcileTimers(sources([event(1)], []), failing);

    expect(error).toHaveBeenCalledWith("event completion timer could not be re-created", expect.objectContaining({ error: "refused" }));
  });
});
