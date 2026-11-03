import { describe, expect, it } from "vitest";
import { COMPAT_CASES } from "../../src/compat/cases.js";
import { checkBackwardCompatible, RULES, type JsonSchema } from "../../src/compat/schemaCompat.js";

const text = { type: "string" } as const;

function rulesOf(previous: JsonSchema, next: JsonSchema) {
  return checkBackwardCompatible(previous, next).map((found) => found.rule);
}

describe("EN-05-T2 / EN-05-T3 the table of compatible and incompatible changes", () => {
  for (const testCase of COMPAT_CASES.filter((c) => !c.compatible)) {
    it(`EN-05-T2 refuses: ${testCase.name}`, () => {
      const findings = checkBackwardCompatible(testCase.previous, testCase.next);
      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0]!.rule).toBe(testCase.rule);
      expect(findings[0]!.path).toBe(testCase.path);
      expect(findings[0]!.message.length).toBeGreaterThan(0);
    });
  }

  for (const testCase of COMPAT_CASES.filter((c) => c.compatible)) {
    it(`EN-05-T3 accepts: ${testCase.name}`, () => {
      expect(checkBackwardCompatible(testCase.previous, testCase.next)).toEqual([]);
    });
  }

  it("EN-05-T7 records a registry verdict only where Redpanda differs from the case's own", () => {
    for (const testCase of COMPAT_CASES.filter((c) => c.registry !== undefined)) {
      expect(testCase.registry, testCase.name).not.toBe(testCase.compatible);
    }
  });

  it("names every case once", () => {
    const names = COMPAT_CASES.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("every rule the checker can report is exercised by a case or by a test below", () => {
    const covered = new Set(COMPAT_CASES.flatMap((c) => (c.rule ? [c.rule] : [])));
    // "unsupported-keyword" and "message-removed" have their own tests.
    expect(RULES.filter((rule) => !covered.has(rule))).toEqual([
      "unsupported-keyword",
      "pattern-tightened",
      "multiple-tightened",
      "message-removed",
    ]);
  });
});

describe("EN-05-T2 keywords the checker does not understand are findings, not passes", () => {
  it("refuses an unknown keyword in the new schema, naming it", () => {
    const [found] = checkBackwardCompatible(text, { type: "string", contentEncoding: "base64" });
    expect(found).toMatchObject({ rule: "unsupported-keyword", path: "$" });
    expect(found!.message).toContain("contentEncoding");
  });

  it("refuses an unknown keyword in the old schema too", () => {
    expect(rulesOf({ type: "string", $ref: "#/x" }, text)).toEqual(["unsupported-keyword"]);
  });

  it("refuses a boolean exclusiveMinimum or exclusiveMaximum (draft-04)", () => {
    expect(rulesOf({ type: "number", minimum: 1, exclusiveMinimum: true }, { type: "number" })).toEqual(["unsupported-keyword"]);
    expect(rulesOf({ type: "number" }, { type: "number", maximum: 1, exclusiveMaximum: true })).toEqual(["unsupported-keyword"]);
  });

  it("refuses tuple-form items", () => {
    expect(rulesOf({ type: "array", items: [text] }, { type: "array", items: [text] })).toEqual([
      "unsupported-keyword",
      "unsupported-keyword",
    ]);
  });

  it("refuses an anyOf that sits next to other constraints", () => {
    expect(rulesOf({ type: "string", anyOf: [text] }, text)).toEqual(["unsupported-keyword"]);
  });

  it("reports an unchecked place once and stops looking inside it", () => {
    const previous = { type: "object", properties: { a: { not: {} } }, additionalProperties: false };
    expect(rulesOf(previous, previous)).toEqual(["unsupported-keyword", "unsupported-keyword"]);
  });

  it("ignores annotations", () => {
    const annotated = { type: "string", title: "t", description: "d", default: "x", examples: ["x"], $comment: "c", $schema: "s" };
    expect(checkBackwardCompatible(annotated, text)).toEqual([]);
    expect(checkBackwardCompatible(text, annotated)).toEqual([]);
  });
});

describe("EN-05-T2 / EN-05-T3 boolean and empty schemas", () => {
  it("accepts any change from a schema that accepted nothing", () => {
    expect(checkBackwardCompatible(false, text)).toEqual([]);
  });

  it("refuses a change to a schema that accepts nothing", () => {
    expect(rulesOf(text, false)).toEqual(["type-changed"]);
  });

  it("accepts a change to a schema that accepts anything", () => {
    expect(checkBackwardCompatible(text, true)).toEqual([]);
    expect(checkBackwardCompatible(text, {})).toEqual([]);
  });

  it("refuses narrowing a schema that accepted anything", () => {
    expect(rulesOf(true, text)).toEqual(["type-changed"]);
    expect(rulesOf({}, { enum: ["A"] })).toEqual(["values-narrowed"]);
  });
});

describe("EN-05-T2 / EN-05-T3 types, values and alternatives", () => {
  it("compares a list of types as alternatives", () => {
    expect(checkBackwardCompatible({ type: ["string", "null"] }, { anyOf: [text, { type: "null" }] })).toEqual([]);
    expect(checkBackwardCompatible({ anyOf: [text, { type: "null" }] }, { type: ["null", "string"] })).toEqual([]);
    expect(rulesOf({ type: ["string", "null"] }, text)).toEqual(["type-changed"]);
  });

  it("accepts a type list that gains a type, and refuses one that loses a type", () => {
    expect(checkBackwardCompatible({ type: ["string"] }, { type: ["string", "number"] })).toEqual([]);
    expect(rulesOf({ type: ["string", "number"] }, { type: ["string"] })).toEqual(["alternatives-narrowed"]);
  });

  it("matches an old schema to the new alternative that accepts it", () => {
    expect(checkBackwardCompatible(text, { anyOf: [{ type: "number" }, text] })).toEqual([]);
    expect(rulesOf(text, { anyOf: [{ type: "number" }, { type: "null" }] })).toEqual(["alternatives-narrowed"]);
  });

  it("reads the type of an enum or a const from its values", () => {
    expect(checkBackwardCompatible({ enum: ["A", "B"] }, text)).toEqual([]);
    expect(checkBackwardCompatible({ const: 1 }, { type: "number" })).toEqual([]);
    expect(rulesOf({ enum: ["A", 1] }, text)).toEqual(["type-changed"]);
    expect(rulesOf({ enum: [null] }, text)).toEqual(["type-changed"]);
    expect(rulesOf({ enum: [[1]] }, { type: "object" })).toEqual(["type-changed"]);
  });

  it("compares a const with an enum", () => {
    expect(checkBackwardCompatible({ const: "A" }, { enum: ["A", "B"] })).toEqual([]);
    expect(rulesOf({ enum: ["A", "B"] }, { const: "A" })).toEqual(["values-narrowed"]);
    expect(rulesOf({ const: "A" }, { const: "B" })).toEqual(["values-narrowed"]);
  });

  it("names the values a new enum dropped", () => {
    const [found] = checkBackwardCompatible({ enum: ["A", "B", "C"] }, { enum: ["A"] });
    expect(found!.message).toContain('"B"');
    expect(found!.message).toContain('"C"');
  });

  it("compares object and array values by content", () => {
    expect(checkBackwardCompatible({ enum: [{ a: 1 }] }, { enum: [{ a: 1 }, { a: 2 }] })).toEqual([]);
    expect(rulesOf({ enum: [{ a: 1 }] }, { enum: [{ a: 2 }] })).toEqual(["values-narrowed"]);
  });
});

describe("EN-05-T2 / EN-05-T3 strings and numbers", () => {
  it("refuses a changed pattern, and accepts a dropped or unchanged one", () => {
    expect(rulesOf({ type: "string", pattern: "^a" }, { type: "string", pattern: "^b" })).toEqual(["pattern-tightened"]);
    expect(rulesOf(text, { type: "string", pattern: "^a" })).toEqual(["pattern-tightened"]);
    expect(checkBackwardCompatible({ type: "string", pattern: "^a" }, text)).toEqual([]);
    expect(checkBackwardCompatible({ type: "string", pattern: "^a" }, { type: "string", pattern: "^a" })).toEqual([]);
  });

  it("refuses a lowered maximum length, and accepts a raised one", () => {
    expect(rulesOf({ type: "string", maxLength: 10 }, { type: "string", maxLength: 5 })).toEqual(["length-tightened"]);
    expect(checkBackwardCompatible({ type: "string", maxLength: 5 }, { type: "string", maxLength: 10 })).toEqual([]);
    expect(checkBackwardCompatible({ type: "string", maxLength: 5 }, { type: "string", maxLength: 5 })).toEqual([]);
  });

  it("treats a missing minimum length as zero", () => {
    expect(rulesOf(text, { type: "string", minLength: 1 })).toEqual(["length-tightened"]);
    expect(checkBackwardCompatible(text, { type: "string", minLength: 0 })).toEqual([]);
  });

  it("compares lower bounds including whether they are exclusive", () => {
    const lower = (bound: Record<string, number>) => ({ type: "number", ...bound });
    expect(checkBackwardCompatible(lower({ minimum: 5 }), lower({ minimum: 5 }))).toEqual([]);
    expect(checkBackwardCompatible(lower({ minimum: 5 }), lower({ exclusiveMinimum: 4 }))).toEqual([]);
    expect(checkBackwardCompatible(lower({ exclusiveMinimum: 5 }), lower({ minimum: 5 }))).toEqual([]);
    expect(checkBackwardCompatible(lower({ exclusiveMinimum: 5 }), lower({ exclusiveMinimum: 5 }))).toEqual([]);
    expect(rulesOf(lower({ minimum: 5 }), lower({ exclusiveMinimum: 5 }))).toEqual(["range-tightened"]);
    expect(rulesOf(lower({ minimum: 5 }), lower({ minimum: 6 }))).toEqual(["range-tightened"]);
    expect(rulesOf(lower({}), lower({ minimum: 0 }))).toEqual(["range-tightened"]);
    // the tighter of a minimum and an exclusive minimum decides
    expect(checkBackwardCompatible(lower({ minimum: 5, exclusiveMinimum: 5 }), lower({ exclusiveMinimum: 5 }))).toEqual([]);
    expect(checkBackwardCompatible(lower({ minimum: 3, exclusiveMinimum: 5 }), lower({ minimum: 5 }))).toEqual([]);
    expect(checkBackwardCompatible(lower({ minimum: 7, exclusiveMinimum: 5 }), lower({ minimum: 7 }))).toEqual([]);
  });

  it("compares upper bounds including whether they are exclusive", () => {
    const upper = (bound: Record<string, number>) => ({ type: "number", ...bound });
    expect(checkBackwardCompatible(upper({ maximum: 5 }), upper({ maximum: 5 }))).toEqual([]);
    expect(checkBackwardCompatible(upper({ maximum: 5 }), upper({ exclusiveMaximum: 6 }))).toEqual([]);
    expect(checkBackwardCompatible(upper({ exclusiveMaximum: 5 }), upper({ maximum: 5 }))).toEqual([]);
    expect(rulesOf(upper({ maximum: 5 }), upper({ exclusiveMaximum: 5 }))).toEqual(["range-tightened"]);
    expect(rulesOf(upper({ maximum: 5 }), upper({ maximum: 4 }))).toEqual(["range-tightened"]);
    expect(rulesOf(upper({}), upper({ maximum: 4 }))).toEqual(["range-tightened"]);
    expect(checkBackwardCompatible(upper({ maximum: 5, exclusiveMaximum: 5 }), upper({ exclusiveMaximum: 5 }))).toEqual([]);
    expect(checkBackwardCompatible(upper({ maximum: 9, exclusiveMaximum: 5 }), upper({ maximum: 5 }))).toEqual([]);
    expect(checkBackwardCompatible(upper({ maximum: 3, exclusiveMaximum: 5 }), upper({ maximum: 3 }))).toEqual([]);
  });

  it("accepts a multipleOf that the old step is a multiple of, and refuses the rest", () => {
    expect(checkBackwardCompatible({ type: "number", multipleOf: 10 }, { type: "number", multipleOf: 5 })).toEqual([]);
    expect(rulesOf({ type: "number", multipleOf: 5 }, { type: "number", multipleOf: 10 })).toEqual(["multiple-tightened"]);
    expect(rulesOf({ type: "number" }, { type: "number", multipleOf: 5 })).toEqual(["multiple-tightened"]);
  });
});

describe("EN-05-T2 / EN-05-T3 arrays", () => {
  const list = (extra: Record<string, unknown> = {}, items: JsonSchema = text) => ({ type: "array", items, ...extra });

  it("refuses constraining the items of an array that had none", () => {
    expect(checkBackwardCompatible({ type: "array" }, list())).not.toEqual([]);
    expect(rulesOf({ type: "array" }, list())).toEqual(["items-tightened"]);
  });

  it("accepts leaving the items unconstrained", () => {
    expect(checkBackwardCompatible(list(), { type: "array" })).toEqual([]);
    expect(checkBackwardCompatible(list(), list({}, {}))).toEqual([]);
    expect(checkBackwardCompatible(list(), list({}, true))).toEqual([]);
  });

  it("refuses a lowered maximum size and accepts a raised one", () => {
    expect(rulesOf(list({ maxItems: 5 }), list({ maxItems: 2 }))).toEqual(["items-tightened"]);
    expect(rulesOf(list(), list({ maxItems: 2 }))).toEqual(["items-tightened"]);
    expect(checkBackwardCompatible(list({ maxItems: 2 }), list({ maxItems: 5 }))).toEqual([]);
  });

  it("refuses requiring unique items", () => {
    expect(rulesOf(list(), list({ uniqueItems: true }))).toEqual(["items-tightened"]);
    expect(checkBackwardCompatible(list({ uniqueItems: true }), list({ uniqueItems: true }))).toEqual([]);
    expect(checkBackwardCompatible(list({ uniqueItems: true }), list())).toEqual([]);
  });

  it("looks inside the items of nested arrays", () => {
    expect(rulesOf(list({}, list()), list({}, list({}, { type: "number" })))).toEqual(["type-changed"]);
  });
});

describe("EN-05-T2 / EN-05-T3 objects", () => {
  const obj = (properties: Record<string, JsonSchema>, extra: Record<string, unknown> = {}) => ({
    type: "object",
    properties,
    ...extra,
  });

  it("checks the schema an additionalProperties schema puts on names the old one listed", () => {
    const previous = obj({ a: text }, { additionalProperties: false });
    expect(checkBackwardCompatible(previous, obj({}, { additionalProperties: text }))).toEqual([]);
    expect(rulesOf(previous, obj({}, { additionalProperties: { type: "number" } }))).toEqual(["type-changed"]);
  });

  it("lets an open object lose a property when the rest are unconstrained", () => {
    expect(checkBackwardCompatible(obj({ a: text }), obj({}))).toEqual([]);
  });

  it("checks a property the old object listed against what the new one says about other names", () => {
    expect(rulesOf(obj({ a: text }), obj({}, { additionalProperties: { type: "number" } }))).toEqual(["type-changed", "object-closed"]);
  });

  it("checks a property added to an object that constrained its other names", () => {
    const previous = obj({}, { additionalProperties: text });
    expect(checkBackwardCompatible(previous, obj({ a: text }, { additionalProperties: text }))).toEqual([]);
    expect(rulesOf(previous, obj({ a: { type: "number" } }, { additionalProperties: text }))).toEqual(["type-changed"]);
  });

  it("accepts an unconstrained property added to an open object", () => {
    expect(checkBackwardCompatible(obj({}), obj({ a: {} }))).toEqual([]);
    expect(checkBackwardCompatible(obj({}), obj({ a: true }))).toEqual([]);
  });

  it("refuses constraining the other names of an object that left them open", () => {
    expect(rulesOf(obj({}), obj({}, { additionalProperties: text }))).toEqual(["object-closed"]);
  });

  it("compares the constraints on other names when both objects have them", () => {
    expect(checkBackwardCompatible(obj({}, { additionalProperties: text }), obj({}, { additionalProperties: text }))).toEqual([]);
    expect(rulesOf(obj({}, { additionalProperties: text }), obj({}, { additionalProperties: { type: "number" } }))).toEqual([
      "type-changed",
    ]);
    expect(rulesOf(obj({}, { additionalProperties: text }), obj({}, { additionalProperties: { type: "number" } }))).toEqual([
      "type-changed",
    ]);
  });

  it("accepts a closed object whose other names become constrained", () => {
    expect(checkBackwardCompatible(obj({}, { additionalProperties: false }), obj({}, { additionalProperties: text }))).toEqual([]);
  });

  it("treats an empty additionalProperties schema as open", () => {
    expect(checkBackwardCompatible(obj({}, { additionalProperties: {} }), obj({}, { additionalProperties: true }))).toEqual([]);
    expect(rulesOf(obj({}, { additionalProperties: {} }), obj({}, { additionalProperties: false }))).toEqual(["object-closed"]);
  });

  it("reports a path for every level it looks into", () => {
    const previous = obj({ outer: obj({ inner: text }, { additionalProperties: false }) }, { additionalProperties: false });
    const next = obj({ outer: obj({ inner: { type: "number" } }, { additionalProperties: false }) }, { additionalProperties: false });
    expect(checkBackwardCompatible(previous, next)).toEqual([
      expect.objectContaining({ path: "$.outer.inner", rule: "type-changed" }),
    ]);
  });

  it("reports an additionalProperties schema's path with a star", () => {
    const previous = obj({}, { additionalProperties: text });
    const next = obj({}, { additionalProperties: { type: "number" } });
    expect(checkBackwardCompatible(previous, next)).toEqual([expect.objectContaining({ path: "$.*", rule: "type-changed" })]);
  });
});
