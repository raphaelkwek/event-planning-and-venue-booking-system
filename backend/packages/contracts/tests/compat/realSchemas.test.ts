import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compareSchemaSets, type SchemaSet } from "../../src/compat/compareSnapshots.js";
import { checkBackwardCompatible, type JsonSchema } from "../../src/compat/schemaCompat.js";
import { canonicalJson } from "../../src/compat/snapshot.js";

/**
 * EN-05-T2 and EN-05-T3 as the cards word them: the real committed schemas of
 * `event.approved`, `event.coordinator-assigned`, `event.status-changed` and
 * `event.rejected`, changed one way at a time.
 */

type Obj = { properties: Record<string, Record<string, unknown>>; required: string[]; [keyword: string]: unknown };

const schemaDir = fileURLToPath(new URL("../../schemas/", import.meta.url));
const load = (type: string): Obj => JSON.parse(readFileSync(`${schemaDir}${type}.json`, "utf8")) as Obj;
const clone = <T>(value: T): T => structuredClone(value);

const approved = () => load("event.approved");

const change = (type: string, edit: (schema: Obj) => void) => {
  const previous = load(type);
  const next = clone(previous);
  edit(next);
  return checkBackwardCompatible(previous as JsonSchema, next as JsonSchema);
};

describe("EN-05-T2 a change that an older message would not satisfy is refused, with the field and the rule", () => {
  it("EN-05-T2 (a) removing the required field approvedBy", () => {
    const findings = change("event.approved", (s) => {
      delete s.properties.approvedBy;
      s.required = s.required.filter((name) => name !== "approvedBy");
    });
    expect(findings).toEqual([expect.objectContaining({ path: "$.approvedBy", rule: "property-removed" })]);
  });

  it("EN-05-T2 (b) retyping approvedAt from a date-time string to a number", () => {
    const findings = change("event.approved", (s) => {
      s.properties.approvedAt = { type: "number" };
    });
    expect(findings).toEqual([
      expect.objectContaining({ path: "$.approvedAt", rule: "type-changed" }),
    ]);
  });

  it("EN-05-T2 (c) adding the new required field note", () => {
    const findings = change("event.approved", (s) => {
      s.properties.note = { type: "string" };
      s.required.push("note");
    });
    expect(findings).toEqual([expect.objectContaining({ path: "$.note", rule: "property-now-required" })]);
  });

  it("EN-05-T2 (d) making the optional coordinatorName of event.coordinator-assigned required", () => {
    const findings = change("event.coordinator-assigned", (s) => {
      s.required.push("coordinatorName");
    });
    expect(findings).toEqual([expect.objectContaining({ path: "$.coordinatorName", rule: "property-now-required" })]);
  });

  it("EN-05-T2 (e) removing one status from the previousStatus enum of event.status-changed", () => {
    const findings = change("event.status-changed", (s) => {
      (s.properties.previousStatus as { enum: string[] }).enum.pop();
    });
    expect(findings).toEqual([expect.objectContaining({ path: "$.previousStatus", rule: "values-narrowed" })]);
  });

  it("EN-05-T2 (f) raising the minimum length of event.rejected's reason from 1 to 2", () => {
    const findings = change("event.rejected", (s) => {
      s.properties.reason = { ...s.properties.reason, minLength: 2 };
    });
    expect(findings).toEqual([expect.objectContaining({ path: "$.reason", rule: "length-tightened" })]);
  });

  it("EN-05-T2 (g) removing the message type event.rejected altogether", () => {
    const base: SchemaSet = new Map([["event.approved", approved() as JsonSchema], ["event.rejected", load("event.rejected") as JsonSchema]]);
    const head: SchemaSet = new Map([["event.approved", approved() as JsonSchema]]);
    expect(compareSchemaSets(base, head).findings).toEqual([
      expect.objectContaining({ messageType: "event.rejected", rule: "message-removed" }),
    ]);
  });

  it("EN-05-T2 (h) a keyword the checker does not understand is refused as one it cannot check", () => {
    const findings = change("event.approved", (s) => {
      s.properties.approvedBy = { ...s.properties.approvedBy, contentEncoding: "base64" };
    });
    expect(findings).toEqual([expect.objectContaining({ path: "$.approvedBy", rule: "unsupported-keyword" })]);
    expect(findings[0]!.message).toContain("cannot be checked");
  });

  it("EN-05-T2 reports nothing for the fields that did not change", () => {
    const findings = change("event.approved", (s) => {
      s.properties.approvedAt = { type: "number" };
    });
    expect(findings.map((found) => found.path)).toEqual(["$.approvedAt"]);
  });
});

describe("EN-05-T3 a change that every older message still satisfies is accepted", () => {
  it("EN-05-T3 (a) no change at all", () => {
    expect(change("event.approved", () => undefined)).toEqual([]);
  });

  it("EN-05-T3 (b) the same fields declared in another order", () => {
    const previous = approved();
    const reordered = { ...clone(previous), properties: Object.fromEntries(Object.entries(previous.properties).reverse()), required: [...previous.required].reverse() };
    expect(checkBackwardCompatible(previous as JsonSchema, reordered as JsonSchema)).toEqual([]);
    expect(canonicalJson(reordered)).toBe(canonicalJson(previous));
  });

  it("EN-05-T3 (c) adding a new optional field", () => {
    expect(
      change("event.approved", (s) => {
        s.properties.note = { type: "string" };
      }),
    ).toEqual([]);
  });

  it("EN-05-T3 (d) changing a required field to optional", () => {
    expect(
      change("event.approved", (s) => {
        s.required = s.required.filter((name) => name !== "approvedBy");
      }),
    ).toEqual([]);
  });

  it("EN-05-T3 (e) adding a status to an enum", () => {
    expect(
      change("event.status-changed", (s) => {
        (s.properties.newStatus as { enum: string[] }).enum.push("ARCHIVED");
      }),
    ).toEqual([]);
  });

  it("EN-05-T3 (f) lowering a minimum length from 2 to 1", () => {
    const previous = load("event.rejected");
    previous.properties.reason = { ...previous.properties.reason, minLength: 2 };
    expect(checkBackwardCompatible(previous as JsonSchema, load("event.rejected") as JsonSchema)).toEqual([]);
  });

  it("EN-05-T3 (g) adding a nullable alternative to a field", () => {
    expect(
      change("event.approved", (s) => {
        s.properties.approvedBy = { anyOf: [s.properties.approvedBy, { type: "null" }] };
      }),
    ).toEqual([]);
  });

  it("EN-05-T3 a message type that is not in the previous version is accepted and listed as new", () => {
    const base: SchemaSet = new Map([["event.approved", approved() as JsonSchema]]);
    const head: SchemaSet = new Map([["event.approved", approved() as JsonSchema], ["event.rejected", load("event.rejected") as JsonSchema]]);
    const result = compareSchemaSets(base, head);
    expect(result.findings).toEqual([]);
    expect(result.added).toEqual(["event.rejected"]);
  });
});
