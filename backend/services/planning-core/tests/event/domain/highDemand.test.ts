import { describe, expect, it } from "vitest";
import { highDemandChange, readHighDemand } from "../../../src/modules/event/domain/highDemand.js";

/**
 * EN-19 — the organiser's high-demand flag: what a request body may say, and
 * when a save is a change worth a history entry and a message.
 */

describe("readHighDemand", () => {
  it("accepts exactly true or false (EN-19-T1)", () => {
    expect(readHighDemand({ highDemand: true })).toEqual({ ok: true, highDemand: true });
    expect(readHighDemand({ highDemand: false })).toEqual({ ok: true, highDemand: false });
  });

  it("names the field when it is missing or not a boolean (EN-19-T2)", () => {
    for (const body of [{}, { highDemand: "yes" }, { highDemand: 1 }, { highDemand: null }]) {
      const read = readHighDemand(body);
      expect(read.ok).toBe(false);
      expect(read.ok ? [] : read.fields.map((f) => f.field)).toEqual(["highDemand"]);
    }
  });

  it("names every other field as one that can't be set here, alongside a bad value", () => {
    const read = readHighDemand({ highDemand: "x", name: "y", status: "CONFIRMED" });
    expect(read.ok ? [] : read.fields.map((f) => f.field)).toEqual(["name", "status", "highDemand"]);
  });

  it("refuses a body that is not an object", () => {
    for (const body of [null, undefined, "text", 3, [true]]) {
      const read = readHighDemand(body);
      expect(read).toEqual({ ok: false, fields: [{ field: "body", message: expect.stringContaining("highDemand") }] });
    }
  });
});

describe("highDemandChange", () => {
  it("is a history entry with before and after when the value changes", () => {
    expect(highDemandChange(false, true)).toEqual({ fieldName: "highDemand", previousValue: "false", newValue: "true" });
    expect(highDemandChange(true, false)).toEqual({ fieldName: "highDemand", previousValue: "true", newValue: "false" });
  });

  it("is nothing when the value is the one already set", () => {
    expect(highDemandChange(true, true)).toBeNull();
    expect(highDemandChange(false, false)).toBeNull();
  });
});
