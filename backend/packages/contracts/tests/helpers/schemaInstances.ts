import { randomUUID } from "node:crypto";

/**
 * A valid document for a JSON Schema, in two shapes: "full" has every optional
 * property, a non-null value wherever null is allowed and one item in each
 * array; "minimal" has only the required properties, null wherever null is
 * allowed and the fewest items. Between them they cover the awkward shapes a
 * message can take: absent properties, nulls and empty arrays.
 *
 * Test and CI support (the CDC parity check uses it to make one message of
 * every type); it understands only what the generated schemas contain, and
 * throws on anything else so a new construct is noticed.
 */

export type Variant = "full" | "minimal";

/**
 * Message types whose minimal shape contracts refuses, because zod refines it
 * (here: at least one booking or reservation) and a JSON Schema cannot say so.
 * Their full shape is accepted.
 */
export const MINIMAL_REFUSED_BY_A_REFINEMENT: ReadonlySet<string> = new Set(["change-request.arrangements-flagged"]);

type Schema = { readonly [keyword: string]: unknown };

/** A string that satisfies each `pattern` the schemas use. A new pattern needs a line here. */
const PATTERN_EXAMPLES: Record<string, string> = {
  "^[A-Z][A-Z_]*$": "APPROVE_EVENT",
  "^BKR-\\d{6}$": "BKR-000042",
  "^HLD-\\d{6}$": "HLD-000042",
};

export function instanceOf(schema: unknown, variant: Variant, now = new Date().toISOString()): unknown {
  if (schema === true || schema === undefined) return {};
  const node = schema as Schema;

  if ("const" in node) return node.const;
  if (Array.isArray(node.enum)) return node.enum[0];

  if (Array.isArray(node.anyOf)) {
    const alternatives = node.anyOf as Schema[];
    const nullAlternative = alternatives.find((alternative) => alternative.type === "null");
    const other = alternatives.find((alternative) => alternative.type !== "null");
    if (variant === "minimal" && nullAlternative) return null;
    return instanceOf(other ?? nullAlternative, variant, now);
  }

  if (Array.isArray(node.type)) {
    const types = node.type as string[];
    if (variant === "minimal" && types.includes("null")) return null;
    return instanceOf({ ...node, type: types.find((type) => type !== "null") ?? "null" }, variant, now);
  }

  switch (node.type) {
    case "string":
      return stringOf(node, now);
    case "integer":
    case "number":
      return numberOf(node);
    case "boolean":
      return true;
    case "null":
      return null;
    case "array":
      return arrayOf(node, variant, now);
    case "object":
      return objectOf(node, variant, now);
    default:
      throw new Error(`No example can be made for a schema of type ${JSON.stringify(node.type)}`);
  }
}

function stringOf(node: Schema, now: string): string {
  if (typeof node.pattern === "string") {
    const example = PATTERN_EXAMPLES[node.pattern];
    if (!example) throw new Error(`Add an example for the pattern ${node.pattern} to PATTERN_EXAMPLES`);
    return example;
  }
  if (node.format === "uuid") return randomUUID();
  if (node.format === "date-time") return now;
  if (node.format !== undefined) throw new Error(`Add an example for the format ${String(node.format)}`);
  const minLength = typeof node.minLength === "number" ? node.minLength : 0;
  return "sample".padEnd(Math.max(minLength, 1), "x");
}

function numberOf(node: Schema): number {
  const integer = node.type === "integer";
  if (typeof node.minimum === "number") return node.minimum;
  if (typeof node.exclusiveMinimum === "number") return integer ? node.exclusiveMinimum + 1 : node.exclusiveMinimum + 0.5;
  return 1;
}

function arrayOf(node: Schema, variant: Variant, now: string): unknown[] {
  const minItems = typeof node.minItems === "number" ? node.minItems : 0;
  const count = Math.max(minItems, variant === "full" ? 1 : 0);
  return Array.from({ length: count }, () => instanceOf(node.items, variant, now));
}

function objectOf(node: Schema, variant: Variant, now: string): Record<string, unknown> {
  const properties = (node.properties ?? {}) as Record<string, unknown>;
  const required = new Set((node.required ?? []) as string[]);
  const result: Record<string, unknown> = {};
  for (const [name, schema] of Object.entries(properties)) {
    if (variant === "full" || required.has(name)) result[name] = instanceOf(schema, variant, now);
  }
  return result;
}
