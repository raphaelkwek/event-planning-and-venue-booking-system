import { expect, it } from "vitest";

// Throwaway (SPM-114): proves CI fails when a test fails. Removed in the next commit.
it("fails on purpose", () => {
  expect(1 + 1).toBe(3);
});
