import { describe, expect, it } from "vitest";
import { compareSchemaSets, describeResult, type SchemaSet } from "../../src/compat/compareSnapshots.js";
import type { JsonSchema } from "../../src/compat/schemaCompat.js";

const closed = (properties: Record<string, JsonSchema>, required: string[]): JsonSchema => ({
  type: "object",
  properties,
  required,
  additionalProperties: false,
});

const text = { type: "string" } as const;
const approved = closed({ id: text, approvedBy: text }, ["id", "approvedBy"]);

const set = (entries: Record<string, JsonSchema>): SchemaSet => new Map(Object.entries(entries));

describe("EN-05-T2 / EN-05-T3 comparing the base branch's schemas with the branch's", () => {
  it("EN-05-T3 reports an unchanged message type as unchanged", () => {
    const result = compareSchemaSets(set({ "event.approved": approved }), set({ "event.approved": approved }));
    expect(result).toEqual({ findings: [], unchanged: ["event.approved"], compatible: [], added: [] });
  });

  it("EN-05-T3 reports a compatible change, and a type that is new", () => {
    const widened = closed({ id: text, approvedBy: text, note: text }, ["id", "approvedBy"]);
    const result = compareSchemaSets(
      set({ "event.approved": approved }),
      set({ "event.approved": widened, "event.rejected": approved }),
    );
    expect(result.findings).toEqual([]);
    expect(result.compatible).toEqual(["event.approved"]);
    expect(result.added).toEqual(["event.rejected"]);
  });

  it("EN-05-T2 names the message type of each finding", () => {
    const narrowed = closed({ id: text }, ["id"]);
    const result = compareSchemaSets(set({ "event.approved": approved }), set({ "event.approved": narrowed }));
    expect(result.findings).toEqual([
      expect.objectContaining({ messageType: "event.approved", path: "$.approvedBy", rule: "property-removed" }),
    ]);
    expect(result.compatible).toEqual([]);
  });

  it("EN-05-T2 refuses removing a message type", () => {
    const result = compareSchemaSets(set({ "event.approved": approved, "event.rejected": approved }), set({ "event.approved": approved }));
    expect(result.findings).toEqual([
      expect.objectContaining({ messageType: "event.rejected", path: "$", rule: "message-removed" }),
    ]);
  });

  it("lists message types in alphabetical order", () => {
    const result = compareSchemaSets(set({ b: approved, a: approved }), set({ b: approved, a: approved, d: approved, c: approved }));
    expect(result.unchanged).toEqual(["a", "b"]);
    expect(result.added).toEqual(["c", "d"]);
  });

  it("describes a comparison in one summary line and one line per message and finding", () => {
    const narrowed = closed({ id: text }, ["id"]);
    const widened = closed({ id: text, approvedBy: text, note: text }, ["id", "approvedBy"]);
    const result = compareSchemaSets(
      set({ "event.approved": approved, "event.rejected": approved, "event.cancelled": approved }),
      set({ "event.approved": widened, "event.rejected": narrowed, "event.cancelled": approved, "event.new": approved }),
    );
    expect(describeResult(result, "origin/main")).toEqual([
      "Compared against origin/main: 1 unchanged, 1 changed compatibly, 1 new, 1 breaking.",
      "  changed compatibly: event.approved",
      "  new: event.new",
      "  BREAKING event.rejected $.approvedBy [property-removed] the property was removed from an object that refuses unknown names",
    ]);
  });
});
