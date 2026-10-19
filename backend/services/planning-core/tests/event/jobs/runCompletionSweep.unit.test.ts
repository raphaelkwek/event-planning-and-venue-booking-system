import type { Sql } from "postgres";
import { afterEach, describe, expect, it, vi } from "vitest";
import { logger } from "../../../src/shared/logger.js";
import { reportCompletionRun, runCompletionSweep } from "../../../src/modules/event/jobs/completeEvents.js";

/** F1 AC6 — what `npm run jobs:complete-events` logs and how it exits. */

afterEach(() => {
  vi.restoreAllMocks();
});

describe("reportCompletionRun (F1)", () => {
  it("logs one line per event and a summary, and exits 1 when an event failed", () => {
    const info = vi.spyOn(logger, "info").mockImplementation(() => undefined);
    const error = vi.spyOn(logger, "error").mockImplementation(() => undefined);

    const code = reportCompletionRun(
      {
        completed: ["e-1"],
        skipped: [{ id: "e-2", currentStatus: "CANCELLED", message: "Cancelled cannot be completed." }],
        failed: [{ id: "e-3", error: "deadlock detected" }],
      },
      "corr-1",
      Date.now()
    );

    expect(code).toBe(1);
    expect(info).toHaveBeenCalledWith("event completed", expect.objectContaining({ eventId: "e-1", outcome: "success" }));
    expect(info).toHaveBeenCalledWith(
      "Cancelled cannot be completed.",
      expect.objectContaining({
        eventId: "e-2",
        currentStatus: "CANCELLED",
        outcome: "refused",
        code: "STATUS_TRANSITION_NOT_PERMITTED",
      })
    );
    expect(error).toHaveBeenCalledWith(
      "event could not be completed",
      expect.objectContaining({ eventId: "e-3", error: "deadlock detected", outcome: "error" })
    );
    expect(info).toHaveBeenLastCalledWith(
      "completion sweep finished",
      expect.objectContaining({ correlationId: "corr-1", outcome: "error", completed: 1, skipped: 1, failed: 1 })
    );
  });

  it("exits 0 when nothing failed", () => {
    const info = vi.spyOn(logger, "info").mockImplementation(() => undefined);

    expect(reportCompletionRun({ completed: [], skipped: [], failed: [] }, "corr-2", Date.now())).toBe(0);
    expect(info).toHaveBeenCalledWith(
      "completion sweep finished",
      expect.objectContaining({ outcome: "success", completed: 0, skipped: 0, failed: 0 })
    );
  });
});

describe("runCompletionSweep (F1)", () => {
  it("logs a sweep that fails outright as a structured error and exits 1", async () => {
    const error = vi.spyOn(logger, "error").mockImplementation(() => undefined);
    const unreachable = (() => {
      throw new Error("connect ECONNREFUSED");
    }) as unknown as Sql;

    expect(await runCompletionSweep(unreachable)).toBe(1);
    expect(error).toHaveBeenCalledWith(
      "completion sweep failed",
      expect.objectContaining({ outcome: "error", error: "connect ECONNREFUSED" })
    );
  });
});
