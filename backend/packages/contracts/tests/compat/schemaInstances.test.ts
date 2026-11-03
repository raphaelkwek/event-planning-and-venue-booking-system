import { describe, expect, it } from "vitest";
import { MESSAGE_DATA_SCHEMAS } from "../../src/cloudEvent.js";
import { toJsonSchema } from "../../src/compat/snapshot.js";
import { instanceOf, MINIMAL_REFUSED_BY_A_REFINEMENT, type Variant } from "../helpers/schemaInstances.js";

/**
 * The CDC parity check (backend/scripts/cdc-parity-check.ts) makes one message
 * of every type from the committed JSON Schemas. Here that generator is shown
 * to make documents zod accepts, which also shows the schemas and zod agree.
 */

const VARIANTS: Variant[] = ["full", "minimal"];

describe("EN-05-T8 the example messages the parity check sends", () => {
  for (const [type, zodSchema] of Object.entries(MESSAGE_DATA_SCHEMAS)) {
    for (const variant of VARIANTS) {
      const refused = variant === "minimal" && MINIMAL_REFUSED_BY_A_REFINEMENT.has(type);
      it(`makes a ${variant} ${type} that contracts ${refused ? "refuses, as a refinement the schema cannot express demands" : "accepts"}`, () => {
        const document = instanceOf(toJsonSchema(zodSchema), variant);
        expect(zodSchema.safeParse(document).success, JSON.stringify(document)).toBe(!refused);
      });
    }
  }

  it("has a minimal shape with a null and an empty array, and a full shape with neither", () => {
    const schema = toJsonSchema(MESSAGE_DATA_SCHEMAS["event.cancelled"]);
    const minimal = instanceOf(schema, "minimal") as Record<string, unknown>;
    expect(minimal.assignedCoordinatorId).toBeNull();
    expect(minimal.bookings).toEqual([]);
    const full = instanceOf(schema, "full") as Record<string, unknown>;
    expect(typeof full.assignedCoordinatorId).toBe("string");
    expect((full.bookings as unknown[]).length).toBe(1);
  });
});

describe("the generator's own rules", () => {
  it("uses a constant or the first enum value", () => {
    expect(instanceOf({ const: "A" }, "full")).toBe("A");
    expect(instanceOf({ enum: ["X", "Y"] }, "full")).toBe("X");
  });

  it("picks the null alternative of a nullable only in the minimal shape", () => {
    const nullable = { anyOf: [{ type: "string", format: "uuid" }, { type: "null" }] };
    expect(instanceOf(nullable, "minimal")).toBeNull();
    expect(typeof instanceOf(nullable, "full")).toBe("string");
    expect(instanceOf({ type: ["string", "null"] }, "minimal")).toBeNull();
    expect(instanceOf({ type: ["string", "null"] }, "full")).toBe("sample");
    expect(instanceOf({ anyOf: [{ type: "null" }] }, "full")).toBeNull();
    expect(instanceOf({ type: ["null"] }, "full")).toBeNull();
  });

  it("makes a string as long as its minimum length and one that matches its pattern", () => {
    expect(instanceOf({ type: "string", minLength: 8 }, "full")).toBe("samplexx");
    expect(instanceOf({ type: "string", pattern: "^HLD-\\d{6}$" }, "full")).toBe("HLD-000042");
  });

  it("makes a UUID and a timestamp", () => {
    expect(instanceOf({ type: "string", format: "uuid" }, "full")).toMatch(/^[0-9a-f-]{36}$/);
    expect(instanceOf({ type: "string", format: "date-time" }, "full", "2026-11-03T00:00:00.000Z")).toBe("2026-11-03T00:00:00.000Z");
  });

  it("makes numbers that respect a lower bound", () => {
    expect(instanceOf({ type: "integer" }, "full")).toBe(1);
    expect(instanceOf({ type: "integer", minimum: 5 }, "full")).toBe(5);
    expect(instanceOf({ type: "integer", exclusiveMinimum: 0 }, "full")).toBe(1);
    expect(instanceOf({ type: "number", exclusiveMinimum: 0 }, "full")).toBe(0.5);
  });

  it("makes a boolean, a null, an open object and an array with the minimum items", () => {
    expect(instanceOf({ type: "boolean" }, "minimal")).toBe(true);
    expect(instanceOf({ type: "null" }, "full")).toBeNull();
    expect(instanceOf(true, "full")).toEqual({});
    expect(instanceOf(undefined, "full")).toEqual({});
    expect(instanceOf({ type: "object" }, "full")).toEqual({});
    expect(instanceOf({ type: "array", items: { type: "string" }, minItems: 2 }, "minimal")).toEqual(["sample", "sample"]);
    expect(instanceOf({ type: "array" }, "full")).toEqual([{}]);
  });

  it("refuses a pattern, a format or a type it has no example for", () => {
    expect(() => instanceOf({ type: "string", pattern: "^x$" }, "full")).toThrow("PATTERN_EXAMPLES");
    expect(() => instanceOf({ type: "string", format: "email" }, "full")).toThrow("email");
    expect(() => instanceOf({ type: "thing" }, "full")).toThrow('"thing"');
  });
});
