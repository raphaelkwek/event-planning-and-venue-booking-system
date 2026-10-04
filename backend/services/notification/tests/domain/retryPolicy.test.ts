import { describe, expect, it } from "vitest";
import {
  ATTEMPT_HEADER,
  attemptOf,
  MAX_RETRIES,
  NOT_BEFORE_HEADER,
  retryDelayMs,
} from "../../src/domain/retryPolicy.js";

/**
 * implementation.md §3.5 leaves EN-04.3 to set the number of retries and the
 * delay between them: three, after 5 s, 30 s and 2 min. That rides out a
 * database restart or a pooler blip without holding a bad message for long.
 */

describe("the retry policy", () => {
  it("retries three times before dead-lettering", () => {
    expect(MAX_RETRIES).toBe(3);
  });

  it("waits 5 s, then 30 s, then 2 min", () => {
    expect([1, 2, 3].map(retryDelayMs)).toEqual([5_000, 30_000, 120_000]);
  });

  it("counts a message read from the event topic as attempt 0", () => {
    expect(attemptOf({})).toBe(0);
  });

  it("reads the attempt a retried message carries", () => {
    expect(attemptOf({ [ATTEMPT_HEADER]: "2" })).toBe(2);
  });

  it("treats an unreadable attempt header as attempt 0 rather than looping forever", () => {
    expect(attemptOf({ [ATTEMPT_HEADER]: "lots" })).toBe(0);
  });

  it("names its headers so they cannot clash with CloudEvents' ce_ prefix", () => {
    expect([ATTEMPT_HEADER, NOT_BEFORE_HEADER].every((h) => h.startsWith("connectsphere-"))).toBe(true);
  });
});
