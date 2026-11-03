import type { JsonSchema, Rule } from "./schemaCompat.js";

/**
 * Changes to a schema and whether each is backward compatible. Two things read
 * this table: the checker's unit tests, and the CI job that asks a real
 * Redpanda Schema Registry the same question about each pair
 * (backend/scripts/schema-registry-check.ts). The registry must agree with
 * `compatible` for every case, which is how the checker is shown to follow the
 * registry's rules and not only its author's reading of them.
 */

export interface CompatCase {
  readonly name: string;
  readonly previous: JsonSchema;
  readonly next: JsonSchema;
  readonly compatible: boolean;
  /** For an incompatible case: the rule and path the checker reports first. */
  readonly rule?: Rule;
  readonly path?: string;
}

const text = { type: "string" } as const;
const uuid = { type: "string", format: "uuid" } as const;

const closed = (properties: Record<string, JsonSchema>, required: string[] = []): JsonSchema => ({
  type: "object",
  properties,
  required,
  additionalProperties: false,
});

const open = (properties: Record<string, JsonSchema>, required: string[] = []): JsonSchema => ({
  type: "object",
  properties,
  required,
});

const base = closed({ id: uuid, name: text }, ["id", "name"]);

export const COMPAT_CASES: readonly CompatCase[] = [
  // Compatible: every old message is still accepted.
  { name: "identical schemas", previous: base, next: base, compatible: true },
  {
    name: "an optional property is added to a closed object",
    previous: base,
    next: closed({ id: uuid, name: text, note: text }, ["id", "name"]),
    compatible: true,
  },
  {
    name: "a required property becomes optional",
    previous: base,
    next: closed({ id: uuid, name: text }, ["id"]),
    compatible: true,
  },
  {
    name: "an enum gains a value",
    previous: closed({ status: { type: "string", enum: ["A", "B"] } }, ["status"]),
    next: closed({ status: { type: "string", enum: ["A", "B", "C"] } }, ["status"]),
    compatible: true,
  },
  {
    name: "a string's minimum length is lowered",
    previous: closed({ name: { type: "string", minLength: 2 } }, ["name"]),
    next: closed({ name: { type: "string", minLength: 1 } }, ["name"]),
    compatible: true,
  },
  {
    name: "a string's maximum length is removed",
    previous: closed({ name: { type: "string", maxLength: 10 } }, ["name"]),
    next: closed({ name: text }, ["name"]),
    compatible: true,
  },
  {
    name: "a number's lower bound is lowered",
    previous: closed({ n: { type: "integer", minimum: 1 } }, ["n"]),
    next: closed({ n: { type: "integer", minimum: 0 } }, ["n"]),
    compatible: true,
  },
  {
    name: "an integer becomes a number",
    previous: closed({ n: { type: "integer" } }, ["n"]),
    next: closed({ n: { type: "number" } }, ["n"]),
    compatible: true,
  },
  {
    name: "a property becomes nullable",
    previous: closed({ n: text }, ["n"]),
    next: closed({ n: { anyOf: [text, { type: "null" }] } }, ["n"]),
    compatible: true,
  },
  {
    name: "a closed object becomes open",
    previous: base,
    next: open({ id: uuid, name: text }, ["id", "name"]),
    compatible: true,
  },
  {
    name: "an array's item type is widened",
    previous: closed({ list: { type: "array", items: { type: "string", enum: ["A"] } } }, ["list"]),
    next: closed({ list: { type: "array", items: { type: "string", enum: ["A", "B"] } } }, ["list"]),
    compatible: true,
  },
  {
    name: "an array's minimum size is lowered",
    previous: closed({ list: { type: "array", items: text, minItems: 1 } }, ["list"]),
    next: closed({ list: { type: "array", items: text } }, ["list"]),
    compatible: true,
  },
  {
    name: "a format is dropped",
    previous: closed({ id: uuid }, ["id"]),
    next: closed({ id: text }, ["id"]),
    compatible: true,
  },
  {
    name: "only a description changes",
    previous: base,
    next: { ...(base as object), description: "reworded" },
    compatible: true,
  },
  {
    name: "an open object stays open and unchanged",
    previous: { type: "object", additionalProperties: {} },
    next: { type: "object", additionalProperties: {} },
    compatible: true,
  },

  // Incompatible: some old message would now be refused.
  {
    name: "a required property is removed from a closed object",
    previous: base,
    next: closed({ id: uuid }, ["id"]),
    compatible: false,
    rule: "property-removed",
    path: "$.name",
  },
  {
    name: "an optional property is removed from a closed object",
    previous: closed({ id: uuid, note: text }, ["id"]),
    next: closed({ id: uuid }, ["id"]),
    compatible: false,
    rule: "property-removed",
    path: "$.note",
  },
  {
    name: "a property changes type",
    previous: base,
    next: closed({ id: uuid, name: { type: "number" } }, ["id", "name"]),
    compatible: false,
    rule: "type-changed",
    path: "$.name",
  },
  {
    name: "a new required property is added",
    previous: base,
    next: closed({ id: uuid, name: text, note: text }, ["id", "name", "note"]),
    compatible: false,
    rule: "property-now-required",
    path: "$.note",
  },
  {
    name: "an optional property becomes required",
    previous: closed({ id: uuid, name: text }, ["id"]),
    next: base,
    compatible: false,
    rule: "property-now-required",
    path: "$.name",
  },
  {
    name: "an enum loses a value",
    previous: closed({ status: { type: "string", enum: ["A", "B"] } }, ["status"]),
    next: closed({ status: { type: "string", enum: ["A"] } }, ["status"]),
    compatible: false,
    rule: "values-narrowed",
    path: "$.status",
  },
  {
    name: "a string becomes an enum",
    previous: closed({ status: text }, ["status"]),
    next: closed({ status: { type: "string", enum: ["A"] } }, ["status"]),
    compatible: false,
    rule: "values-narrowed",
    path: "$.status",
  },
  {
    name: "a string's minimum length is raised",
    previous: closed({ name: { type: "string", minLength: 1 } }, ["name"]),
    next: closed({ name: { type: "string", minLength: 2 } }, ["name"]),
    compatible: false,
    rule: "length-tightened",
    path: "$.name",
  },
  {
    name: "a string gains a maximum length",
    previous: closed({ name: text }, ["name"]),
    next: closed({ name: { type: "string", maxLength: 10 } }, ["name"]),
    compatible: false,
    rule: "length-tightened",
    path: "$.name",
  },
  {
    name: "a number's lower bound is raised",
    previous: closed({ n: { type: "integer", minimum: 0 } }, ["n"]),
    next: closed({ n: { type: "integer", minimum: 1 } }, ["n"]),
    compatible: false,
    rule: "range-tightened",
    path: "$.n",
  },
  {
    name: "a plain string gains a format",
    previous: closed({ id: text }, ["id"]),
    next: closed({ id: uuid }, ["id"]),
    compatible: false,
    rule: "format-tightened",
    path: "$.id",
  },
  {
    name: "a nullable property stops being nullable",
    previous: closed({ n: { anyOf: [text, { type: "null" }] } }, ["n"]),
    next: closed({ n: text }, ["n"]),
    compatible: false,
    rule: "type-changed",
    path: "$.n",
  },
  {
    name: "a number becomes an integer",
    previous: closed({ n: { type: "number" } }, ["n"]),
    next: closed({ n: { type: "integer" } }, ["n"]),
    compatible: false,
    rule: "type-changed",
    path: "$.n",
  },
  {
    name: "an open object becomes closed",
    previous: open({ id: uuid }, ["id"]),
    next: closed({ id: uuid }, ["id"]),
    compatible: false,
    rule: "object-closed",
    path: "$",
  },
  {
    name: "a constrained property is added to an open object",
    previous: open({ id: uuid }, ["id"]),
    next: open({ id: uuid, note: text }, ["id"]),
    compatible: false,
    rule: "property-added-to-open-object",
    path: "$.note",
  },
  {
    name: "an array's item type changes",
    previous: closed({ list: { type: "array", items: text } }, ["list"]),
    next: closed({ list: { type: "array", items: { type: "number" } } }, ["list"]),
    compatible: false,
    rule: "type-changed",
    path: "$.list[]",
  },
  {
    name: "an array's minimum size is raised",
    previous: closed({ list: { type: "array", items: text } }, ["list"]),
    next: closed({ list: { type: "array", items: text, minItems: 1 } }, ["list"]),
    compatible: false,
    rule: "items-tightened",
    path: "$.list",
  },
  {
    name: "a nested required property is removed",
    previous: closed({ inner: closed({ a: text, b: text }, ["a", "b"]) }, ["inner"]),
    next: closed({ inner: closed({ a: text }, ["a"]) }, ["inner"]),
    compatible: false,
    rule: "property-removed",
    path: "$.inner.b",
  },
  {
    name: "a union loses an alternative",
    previous: closed({ v: { anyOf: [text, { type: "number" }] } }, ["v"]),
    next: closed({ v: { anyOf: [text] } }, ["v"]),
    compatible: false,
    rule: "alternatives-narrowed",
    path: "$.v",
  },
];
