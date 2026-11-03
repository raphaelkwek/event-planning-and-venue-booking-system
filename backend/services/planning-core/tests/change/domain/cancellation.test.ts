import { describe, expect, it } from "vitest";
import {
  CANCELLATION_ATTEMPTS,
  retryWhile,
  unlockedVenues,
  validateCancellationBody,
} from "../../../src/modules/change/domain/cancellation.js";

describe("validateCancellationBody (F3 AC2)", () => {
  it("accepts a reason, trimmed", () => {
    expect(validateCancellationBody({ reason: "  The speaker withdrew.  " })).toEqual({ ok: true, reason: "The speaker withdrew." });
  });

  it.each([
    ["no body", undefined],
    ["an array", []],
    ["no reason", {}],
    ["a reason that is not text", { reason: 42 }],
    ["an empty reason", { reason: "" }],
    ["a blank reason", { reason: "   " }],
  ])("refuses %s, naming the reason", (_case, body) => {
    expect(validateCancellationBody(body)).toEqual({
      ok: false,
      fields: [{ field: "reason", message: "Give a reason for cancelling the event." }],
    });
  });

  it("accepts a reason of 1,000 characters and refuses one of 1,001", () => {
    expect(validateCancellationBody({ reason: "x".repeat(1000) }).ok).toBe(true);
    expect(validateCancellationBody({ reason: "x".repeat(1001) })).toEqual({
      ok: false,
      fields: [{ field: "reason", message: "The reason can be at most 1000 characters." }],
    });
  });
});

describe("unlockedVenues (F4: the event's venues re-read under the event lock)", () => {
  it("is empty when every venue now was locked first, in any order", () => {
    expect(unlockedVenues(["v1", "v2"], ["v2", "v1"])).toEqual([]);
    expect(unlockedVenues(["v1", "v2"], ["v1"])).toEqual([]);
    expect(unlockedVenues([], [])).toEqual([]);
  });

  it("names each venue the event gained after the venue locks", () => {
    expect(unlockedVenues(["v1"], ["v1", "v3", "v2"])).toEqual(["v3", "v2"]);
    expect(unlockedVenues([], ["v1"])).toEqual(["v1"]);
  });
});

describe("retryWhile (F4: a cancellation whose venues changed is tried again)", () => {
  const attempts = (outcomes: string[]) => {
    const queue = [...outcomes];
    let calls = 0;
    return {
      run: async () => {
        calls += 1;
        return queue.shift()!;
      },
      calls: () => calls,
    };
  };
  const changed = (outcome: string) => outcome === "CHANGED";

  it("tries three times by default", () => {
    expect(CANCELLATION_ATTEMPTS).toBe(3);
  });

  it("returns the first outcome that needs no retry, without trying again", async () => {
    const attempt = attempts(["DONE", "DONE"]);
    await expect(retryWhile(attempt.run, changed)).resolves.toBe("DONE");
    expect(attempt.calls()).toBe(1);
  });

  it("tries again while the outcome asks for it", async () => {
    const attempt = attempts(["CHANGED", "CHANGED", "DONE"]);
    await expect(retryWhile(attempt.run, changed)).resolves.toBe("DONE");
    expect(attempt.calls()).toBe(3);
  });

  it("stops after the last attempt and returns its outcome", async () => {
    const attempt = attempts(["CHANGED", "CHANGED", "CHANGED", "DONE"]);
    await expect(retryWhile(attempt.run, changed)).resolves.toBe("CHANGED");
    expect(attempt.calls()).toBe(3);
  });

  it("honours a smaller bound", async () => {
    const attempt = attempts(["CHANGED", "DONE"]);
    await expect(retryWhile(attempt.run, changed, 1)).resolves.toBe("CHANGED");
    expect(attempt.calls()).toBe(1);
  });
});
