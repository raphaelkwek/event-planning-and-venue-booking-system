import type { ZodTypeAny } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { cloudEventSchema, MESSAGE_DATA_SCHEMAS } from "../cloudEvent.js";
import type { JsonSchema } from "./schemaCompat.js";

/**
 * The committed JSON Schema files (backend/packages/contracts/schemas): one
 * for the CloudEvents envelope and one for each message type's `data`. They
 * are what the compatibility check compares across branches, and what a schema
 * registry is given. zod stays the source of truth: the files are generated
 * from it, and a test fails when they drift.
 *
 * Not representable in JSON Schema, so not in the files: zod refinements (the
 * envelope's `actor` format) and a date-time's millisecond precision.
 */

export const ENVELOPE_NAME = "cloudevent";

/** What goes into the files: the envelope, then every message type's data. */
export function snapshotSources(): Record<string, ZodTypeAny> {
  return { [ENVELOPE_NAME]: cloudEventSchema, ...MESSAGE_DATA_SCHEMAS };
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      // Keys of one object are unique, so two are never equal.
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([key, inner]) => [key, key === "required" && Array.isArray(inner) ? [...inner].sort() : sortKeys(inner)]),
  );
}

/** Stable text for a schema: sorted keys and required names, so reordering fields in zod changes nothing. */
export function canonicalJson(schema: unknown): string {
  return `${JSON.stringify(sortKeys(schema), null, 2)}\n`;
}

export function toJsonSchema(schema: ZodTypeAny): JsonSchema {
  return zodToJsonSchema(schema, { target: "jsonSchema7", $refStrategy: "none" }) as JsonSchema;
}

export const fileNameFor = (name: string): string => `${name}.json`;
export const nameFromFile = (fileName: string): string => fileName.replace(/\.json$/, "");

/** File name to file text, for every schema `contracts` defines. */
export function generatedSnapshotFiles(): Map<string, string> {
  return new Map(
    Object.entries(snapshotSources()).map(([name, schema]) => [fileNameFor(name), canonicalJson(toJsonSchema(schema))]),
  );
}
