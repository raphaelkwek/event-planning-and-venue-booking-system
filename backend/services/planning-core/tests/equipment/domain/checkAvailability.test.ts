import { describe, expect, it } from "vitest";
import { validateAvailabilityQuery } from "../../../src/modules/equipment/domain/checkAvailability.js";
const valid = { startsAt: "2026-11-02T10:00:00+08:00", endsAt: "2026-11-02T12:00:00+08:00", requestedQuantity: "0" };
describe("P1 availability inputs", () => {
  it("accepts zero and normalises explicit offsets to instants", () => {
    const result = validateAvailabilityQuery(valid);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.input).toEqual({ startsAt: new Date("2026-11-02T02:00:00Z"), endsAt: new Date("2026-11-02T04:00:00Z"), requestedQuantity: 0 });
  });
  it.each(["-1", "1.5", "1e2", "", "9007199254740992"])("refuses invalid requested quantity %s", (requestedQuantity) => {
    expect(validateAvailabilityQuery({ ...valid, requestedQuantity })).toMatchObject({ ok: false, fields: [expect.objectContaining({ field: "requestedQuantity" })] });
  });
  it.each(["2026-02-30T10:00:00Z", "2026-11-02T10:00:00", "garbage", undefined])("refuses invalid or timezone-free timestamp %s", (startsAt) => {
    expect(validateAvailabilityQuery({ ...valid, startsAt })).toMatchObject({ ok: false, fields: [expect.objectContaining({ field: "startsAt" })] });
  });
  it.each(["2026-11-02T02:00:00Z", "2026-11-02T01:59:59Z"])("refuses non-increasing period %s", (endsAt) => {
    expect(validateAvailabilityQuery({ ...valid, endsAt })).toMatchObject({ ok: false, fields: [expect.objectContaining({ field: "endsAt" })] });
  });
  it("accepts a multi-digit requested quantity", () => {
    const result = validateAvailabilityQuery({ ...valid, requestedQuantity: "12" });
    expect(result).toMatchObject({ ok: true, input: { requestedQuantity: 12 } });
  });
  it("gives actionable messages for quantity and period errors", () => {
    expect(validateAvailabilityQuery({ ...valid, requestedQuantity: "-1" })).toMatchObject({ ok: false, fields: [ { field: "requestedQuantity", message: "Requested quantity must be a whole number of zero or greater." } ] });
    expect(validateAvailabilityQuery({ ...valid, requestedQuantity: "9007199254740992" })).toMatchObject({ ok: false, fields: [ { field: "requestedQuantity", message: "Requested quantity must be a safe whole number." } ] });
    expect(validateAvailabilityQuery({ ...valid, endsAt: valid.startsAt })).toMatchObject({ ok: false, fields: [ { field: "endsAt", message: "End must be later than start." } ] });
  });
  it("refuses repeated query values instead of coercing them", () => {
    expect(validateAvailabilityQuery({ ...valid, requestedQuantity: ["1", "2"] }).ok).toBe(false);
  });
});
