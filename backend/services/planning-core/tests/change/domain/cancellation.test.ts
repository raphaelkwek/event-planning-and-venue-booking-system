import { describe, expect, it } from "vitest";
import { validateCancellationBody } from "../../../src/modules/change/domain/cancellation.js";

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
