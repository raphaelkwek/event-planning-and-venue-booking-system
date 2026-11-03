/**
 * Backward-compatibility of one JSON Schema against the version before it
 * (ADR-0008, EN-05). "Backward" is the registry default in Confluent Schema
 * Registry and in Redpanda's: a consumer that has moved to the new schema must
 * still accept every message that was valid under the old one, because Kafka
 * keeps old messages and a dead-letter topic replays them.
 *
 * The check asks one question: does the new schema accept everything the old
 * schema accepted? It handles the keywords `zod-to-json-schema` produces from
 * the zod schemas in this package. A keyword it does not understand is a
 * finding, not a pass: the checker fails closed so a new construct cannot slip
 * through unchecked.
 *
 * Object rules follow the registries' reading of JSON Schema's content models:
 * - in a closed object (`additionalProperties: false`) a property may be added
 *   if optional, and may not be removed;
 * - in an open object a property may not be added, because an old message may
 *   already carry that name with a value of another type.
 *
 * Pure: no I/O, so every rule is unit-tested.
 */

export type JsonSchema = boolean | { readonly [keyword: string]: unknown };
type SchemaObject = { readonly [keyword: string]: unknown };

export const RULES = [
  "unsupported-keyword",
  "type-changed",
  "values-narrowed",
  "alternatives-narrowed",
  "format-tightened",
  "pattern-tightened",
  "length-tightened",
  "range-tightened",
  "multiple-tightened",
  "items-tightened",
  "property-removed",
  "property-added-to-open-object",
  "property-now-required",
  "object-closed",
  "message-removed",
] as const;

export type Rule = (typeof RULES)[number];

export interface Finding {
  /** Where in `data`: `$` is the root, `$.a.b` a property, `$.a[]` an array's items. */
  readonly path: string;
  readonly rule: Rule;
  readonly message: string;
}

const ANNOTATIONS = new Set([
  "$schema",
  "$id",
  "$comment",
  "title",
  "description",
  "default",
  "examples",
  "deprecated",
  "readOnly",
  "writeOnly",
]);

const SUPPORTED = new Set([
  ...ANNOTATIONS,
  "type",
  "enum",
  "const",
  "format",
  "pattern",
  "minLength",
  "maxLength",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "multipleOf",
  "properties",
  "required",
  "additionalProperties",
  "items",
  "minItems",
  "maxItems",
  "uniqueItems",
  "anyOf",
]);

/** Everything except the annotations: the keywords that decide what a document may be. */
function constraintKeys(schema: SchemaObject): string[] {
  return Object.keys(schema).filter((key) => !ANNOTATIONS.has(key));
}

function isUnconstrained(schema: JsonSchema): boolean {
  return schema === true || (typeof schema === "object" && constraintKeys(schema).length === 0);
}

const finding = (path: string, rule: Rule, message: string): Finding => ({ path, rule, message });

type Bound = { readonly value: number; readonly exclusive: boolean };

function jsonTypeOf(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "number" && Number.isInteger(value)) return "integer";
  return typeof value;
}

function typeAccepts(nextType: string, previousType: string): boolean {
  return nextType === previousType || (nextType === "number" && previousType === "integer");
}

function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function allowedValues(schema: SchemaObject): readonly unknown[] | undefined {
  if ("const" in schema) return [schema.const];
  return Array.isArray(schema.enum) ? schema.enum : undefined;
}

/** The types a schema allows: its `type`, or those of its enumerated values; undefined when anything goes. */
function allowedTypes(schema: SchemaObject): readonly string[] | undefined {
  if (typeof schema.type === "string") return [schema.type];
  const values = allowedValues(schema);
  return values ? [...new Set(values.map(jsonTypeOf))] : undefined;
}

function lowerBound(schema: SchemaObject): Bound | undefined {
  const bounds: Bound[] = [];
  if (typeof schema.minimum === "number") bounds.push({ value: schema.minimum, exclusive: false });
  if (typeof schema.exclusiveMinimum === "number") bounds.push({ value: schema.exclusiveMinimum, exclusive: true });
  return bounds.reduce<Bound | undefined>(
    (tightest, bound) =>
      !tightest || bound.value > tightest.value || (bound.value === tightest.value && bound.exclusive) ? bound : tightest,
    undefined,
  );
}

function upperBound(schema: SchemaObject): Bound | undefined {
  const bounds: Bound[] = [];
  if (typeof schema.maximum === "number") bounds.push({ value: schema.maximum, exclusive: false });
  if (typeof schema.exclusiveMaximum === "number") bounds.push({ value: schema.exclusiveMaximum, exclusive: true });
  return bounds.reduce<Bound | undefined>(
    (tightest, bound) =>
      !tightest || bound.value < tightest.value || (bound.value === tightest.value && bound.exclusive) ? bound : tightest,
    undefined,
  );
}

/** Does every value that meets `previous` also meet `next`, for a lower bound? */
function lowerBoundHolds(previous: Bound | undefined, next: Bound): boolean {
  if (!previous) return false;
  return previous.value > next.value || (previous.value === next.value && (previous.exclusive || !next.exclusive));
}

function upperBoundHolds(previous: Bound | undefined, next: Bound): boolean {
  if (!previous) return false;
  return previous.value < next.value || (previous.value === next.value && (previous.exclusive || !next.exclusive));
}

/** `type: ["string", "null"]` is the same as an `anyOf` of the two types. */
function expandTypeList(schema: SchemaObject): SchemaObject {
  if (!Array.isArray(schema.type)) return schema;
  const { type, ...rest } = schema;
  return { ...rest, anyOf: (type as string[]).map((single) => ({ type: single })) };
}

function unsupported(schema: SchemaObject, path: string): Finding[] {
  const found: Finding[] = [];
  for (const key of Object.keys(schema)) {
    if (!SUPPORTED.has(key)) {
      found.push(finding(path, "unsupported-keyword", `"${key}" cannot be checked; extend the checker before using it`));
    }
  }
  if (typeof schema.exclusiveMinimum === "boolean" || typeof schema.exclusiveMaximum === "boolean") {
    found.push(finding(path, "unsupported-keyword", "a boolean exclusiveMinimum/exclusiveMaximum is draft-04; use a number"));
  }
  if (Array.isArray(schema.items)) {
    found.push(finding(path, "unsupported-keyword", "tuple-form items cannot be checked"));
  }
  if ("anyOf" in schema && constraintKeys(schema).some((key) => key !== "anyOf")) {
    found.push(finding(path, "unsupported-keyword", "anyOf next to other constraints cannot be checked"));
  }
  return found;
}

function checkSchema(previousIn: JsonSchema, nextIn: JsonSchema, path: string, out: Finding[]): void {
  if (previousIn === false) return;
  if (nextIn === false) {
    out.push(finding(path, "type-changed", "the new schema accepts no value"));
    return;
  }
  const previous = expandTypeList(previousIn === true ? {} : previousIn);
  const next = expandTypeList(nextIn === true ? {} : nextIn);

  const unchecked = [...unsupported(previous, path), ...unsupported(next, path)];
  if (unchecked.length > 0) {
    out.push(...unchecked);
    return;
  }

  if (Array.isArray(previous.anyOf)) {
    for (const alternative of previous.anyOf as JsonSchema[]) checkSchema(alternative, next, path, out);
    return;
  }

  if (Array.isArray(next.anyOf)) {
    const attempts = (next.anyOf as JsonSchema[]).map((alternative) => {
      const attempt: Finding[] = [];
      checkSchema(previous, alternative, path, attempt);
      return attempt;
    });
    if (!attempts.some((attempt) => attempt.length === 0)) {
      out.push(finding(path, "alternatives-narrowed", "no alternative of the new schema accepts everything the old one did"));
    }
    return;
  }

  checkTypes(previous, next, path, out);
  checkValues(previous, next, path, out);
  checkStrings(previous, next, path, out);
  checkNumbers(previous, next, path, out);
  checkArrays(previous, next, path, out);
  checkObjects(previous, next, path, out);
}

function checkTypes(previous: SchemaObject, next: SchemaObject, path: string, out: Finding[]): void {
  if (typeof next.type !== "string") return;
  const previousTypes = allowedTypes(previous);
  if (!previousTypes) {
    out.push(finding(path, "type-changed", `the old schema allowed any type; the new one allows only ${next.type}`));
    return;
  }
  for (const type of previousTypes) {
    if (!typeAccepts(next.type, type)) {
      out.push(finding(path, "type-changed", `the old schema allowed ${type}; the new one allows only ${next.type}`));
    }
  }
}

function checkValues(previous: SchemaObject, next: SchemaObject, path: string, out: Finding[]): void {
  const nextValues = allowedValues(next);
  if (!nextValues) return;
  const previousValues = allowedValues(previous);
  if (!previousValues) {
    out.push(finding(path, "values-narrowed", "the old schema allowed any value; the new one allows only specific values"));
    return;
  }
  const dropped = previousValues.filter((value) => !nextValues.some((candidate) => sameValue(value, candidate)));
  if (dropped.length > 0) {
    out.push(finding(path, "values-narrowed", `the new schema no longer allows ${dropped.map((v) => JSON.stringify(v)).join(", ")}`));
  }
}

function checkStrings(previous: SchemaObject, next: SchemaObject, path: string, out: Finding[]): void {
  if (next.format !== undefined && next.format !== previous.format) {
    out.push(finding(path, "format-tightened", `the new schema requires format ${JSON.stringify(next.format)}`));
  }
  if (next.pattern !== undefined && next.pattern !== previous.pattern) {
    out.push(finding(path, "pattern-tightened", `the new schema requires pattern ${JSON.stringify(next.pattern)}`));
  }
  if (typeof next.minLength === "number" && next.minLength > ((previous.minLength as number | undefined) ?? 0)) {
    out.push(finding(path, "length-tightened", `minLength rose to ${next.minLength}`));
  }
  if (
    typeof next.maxLength === "number" &&
    (typeof previous.maxLength !== "number" || previous.maxLength > next.maxLength)
  ) {
    out.push(finding(path, "length-tightened", `maxLength fell to ${next.maxLength}`));
  }
}

function checkNumbers(previous: SchemaObject, next: SchemaObject, path: string, out: Finding[]): void {
  const nextLower = lowerBound(next);
  if (nextLower && !lowerBoundHolds(lowerBound(previous), nextLower)) {
    out.push(finding(path, "range-tightened", "the new schema raises the lower bound"));
  }
  const nextUpper = upperBound(next);
  if (nextUpper && !upperBoundHolds(upperBound(previous), nextUpper)) {
    out.push(finding(path, "range-tightened", "the new schema lowers the upper bound"));
  }
  if (typeof next.multipleOf === "number") {
    const previousStep = previous.multipleOf;
    if (typeof previousStep !== "number" || !Number.isInteger(previousStep / next.multipleOf)) {
      out.push(finding(path, "multiple-tightened", `the new schema requires multiples of ${next.multipleOf}`));
    }
  }
}

function checkArrays(previous: SchemaObject, next: SchemaObject, path: string, out: Finding[]): void {
  if (next.items !== undefined && !isUnconstrained(next.items as JsonSchema)) {
    if (previous.items === undefined) {
      out.push(finding(`${path}[]`, "items-tightened", "the old schema allowed any items; the new one constrains them"));
    } else {
      checkSchema(previous.items as JsonSchema, next.items as JsonSchema, `${path}[]`, out);
    }
  }
  if (typeof next.minItems === "number" && next.minItems > ((previous.minItems as number | undefined) ?? 0)) {
    out.push(finding(path, "items-tightened", `minItems rose to ${next.minItems}`));
  }
  if (typeof next.maxItems === "number" && (typeof previous.maxItems !== "number" || previous.maxItems > next.maxItems)) {
    out.push(finding(path, "items-tightened", `maxItems fell to ${next.maxItems}`));
  }
  if (next.uniqueItems === true && previous.uniqueItems !== true) {
    out.push(finding(path, "items-tightened", "the new schema requires unique items"));
  }
}

/** What an object schema says about names it does not list: true is open, false is closed, a schema constrains them. */
function additional(schema: SchemaObject): JsonSchema {
  const value = schema.additionalProperties as JsonSchema | undefined;
  return value === undefined || isUnconstrained(value) ? true : value;
}

function propertiesOf(schema: SchemaObject): Record<string, JsonSchema> {
  return (schema.properties as Record<string, JsonSchema> | undefined) ?? {};
}

function requiredOf(schema: SchemaObject): readonly string[] {
  return (schema.required as string[] | undefined) ?? [];
}

function checkObjects(previous: SchemaObject, next: SchemaObject, path: string, out: Finding[]): void {
  const previousProps = propertiesOf(previous);
  const nextProps = propertiesOf(next);
  const previousAdditional = additional(previous);
  const nextAdditional = additional(next);

  for (const [name, schema] of Object.entries(previousProps)) {
    if (name in nextProps) {
      checkSchema(schema, nextProps[name]!, `${path}.${name}`, out);
    } else if (nextAdditional === false) {
      out.push(finding(`${path}.${name}`, "property-removed", "the property was removed from an object that refuses unknown names"));
    } else {
      checkSchema(schema, nextAdditional, `${path}.${name}`, out);
    }
  }

  for (const [name, schema] of Object.entries(nextProps)) {
    if (name in previousProps || previousAdditional === false) continue;
    if (previousAdditional === true) {
      if (!isUnconstrained(schema)) {
        out.push(finding(`${path}.${name}`, "property-added-to-open-object", "an old message may already carry this name with another type"));
      }
    } else {
      checkSchema(previousAdditional, schema, `${path}.${name}`, out);
    }
  }

  const previousRequired = requiredOf(previous);
  for (const name of requiredOf(next)) {
    if (!previousRequired.includes(name)) {
      out.push(finding(`${path}.${name}`, "property-now-required", "an old message may not carry it"));
    }
  }

  if (nextAdditional === false) {
    if (previousAdditional !== false) {
      out.push(finding(path, "object-closed", "the new schema refuses names the old one allowed"));
    }
  } else if (nextAdditional !== true) {
    if (previousAdditional === true) {
      out.push(finding(path, "object-closed", "the new schema constrains the names it did not list"));
    } else if (previousAdditional !== false) {
      checkSchema(previousAdditional, nextAdditional, `${path}.*`, out);
    }
  }
}

/**
 * The reasons `next` does not accept everything `previous` accepted. Empty
 * means backward compatible.
 */
export function checkBackwardCompatible(previous: JsonSchema, next: JsonSchema): Finding[] {
  const findings: Finding[] = [];
  checkSchema(previous, next, "$", findings);
  return findings;
}
