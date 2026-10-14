import { describe, expect, it } from "vitest";
import { isEventId } from "../../../src/modules/event/domain/ids.js";

describe("isEventId", () => {
  it.each(["3f1c2a4e-9b7d-4e2a-8c1f-0a2b3c4d5e6f", "3F1C2A4E-9B7D-4E2A-8C1F-0A2B3C4D5E6F"])("accepts a UUID (%s)", (id) => {
    expect(isEventId(id)).toBe(true);
  });

  it.each([
    "not-a-uuid",
    "",
    "queue",
    "3f1c2a4e-9b7d-4e2a-8c1f-0a2b3c4d5e6",
    "3f1c2a4e-9b7d-4e2a-8c1f-0a2b3c4d5e6f0",
    " 3f1c2a4e-9b7d-4e2a-8c1f-0a2b3c4d5e6f",
    "3f1c2a4e9b7d4e2a8c1f0a2b3c4d5e6f",
    "3f1c2a4e-9b7d-4e2a-8c1f-0a2b3c4d5e6g",
  ])("refuses anything else (%j)", (id) => {
    expect(isEventId(id)).toBe(false);
  });
});
