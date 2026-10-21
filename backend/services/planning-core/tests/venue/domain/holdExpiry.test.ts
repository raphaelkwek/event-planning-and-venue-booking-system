import { describe, expect, it } from "vitest";
import { expiryNotChangeableMessage, readExpiryChange, reminderAt } from "../../../src/modules/venue/domain/holdExpiry.js";

/** L6 — a hold's reminder time and the expiry change Venue Staff send. */

const NOW = new Date("2026-12-01T10:00:00Z");

describe("reminderAt", () => {
  it("is the lead time before the expiry", () => {
    expect(reminderAt("2026-12-02T12:00:00.000Z", 60).toISOString()).toBe("2026-12-02T11:00:00.000Z");
    expect(reminderAt("2026-12-02T12:00:00.000Z", 1440).toISOString()).toBe("2026-12-01T12:00:00.000Z");
  });
});

describe("readExpiryChange", () => {
  it("accepts an instant later than now, normalised to UTC", () => {
    expect(readExpiryChange({ expiresAt: "2026-12-01T19:00+08:00" }, NOW)).toEqual({ ok: true, expiresAt: "2026-12-01T11:00:00.000Z" });
  });

  it("refuses a time equal to or before now", () => {
    const message = [{ field: "expiresAt", message: "The expiry must be later than now." }];
    expect(readExpiryChange({ expiresAt: NOW.toISOString() }, NOW)).toEqual({ ok: false, fields: message });
    expect(readExpiryChange({ expiresAt: "2026-12-01T09:59:00Z" }, NOW)).toEqual({ ok: false, fields: message });
  });

  it("refuses a missing or unparseable value", () => {
    const missing = [{ field: "expiresAt", message: "Enter the expiry date and time." }];
    expect(readExpiryChange({}, NOW)).toEqual({ ok: false, fields: missing });
    expect(readExpiryChange(null, NOW)).toEqual({ ok: false, fields: missing });
    expect(readExpiryChange({ expiresAt: "not-a-date" }, NOW)).toEqual({
      ok: false,
      fields: [{ field: "expiresAt", message: "Enter a date and time with its offset, for example 2026-12-02T14:00+08:00." }],
    });
  });
});

describe("expiryNotChangeableMessage", () => {
  it("names the hold and its status", () => {
    expect(expiryNotChangeableMessage("HLD-000001", "EXPIRED")).toContain("HLD-000001 is Expired");
  });
});
