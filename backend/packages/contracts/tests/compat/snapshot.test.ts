import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { MESSAGE_DATA_SCHEMAS } from "../../src/cloudEvent.js";
import { checkBackwardCompatible } from "../../src/compat/schemaCompat.js";
import {
  canonicalJson,
  ENVELOPE_NAME,
  fileNameFor,
  generatedSnapshotFiles,
  nameFromFile,
  snapshotSources,
  toJsonSchema,
} from "../../src/compat/snapshot.js";

const schemaDir = fileURLToPath(new URL("../../schemas/", import.meta.url));
const committed = new Map(
  readdirSync(schemaDir)
    .filter((name) => name.endsWith(".json"))
    // A Windows checkout may have turned the committed LF into CRLF.
    .map((name) => [name, readFileSync(`${schemaDir}${name}`, "utf8").replaceAll("\r\n", "\n")]),
);

describe("EN-05-T4 the committed JSON Schema files match contracts", () => {
  it("EN-05-T4 holds exactly the files contracts generates, with the same text", () => {
    const generated = generatedSnapshotFiles();
    expect([...committed.keys()].sort()).toEqual([...generated.keys()].sort());
    for (const [name, text] of generated) expect(committed.get(name), name).toBe(text);
  });

  it("EN-05-T4 has a file for the envelope and one for every message type", () => {
    const expected = [ENVELOPE_NAME, ...Object.keys(MESSAGE_DATA_SCHEMAS)].map(fileNameFor).sort();
    expect([...committed.keys()].sort()).toEqual(expected);
    expect(Object.keys(snapshotSources())[0]).toBe(ENVELOPE_NAME);
  });

  it("names a file after its message type and back", () => {
    expect(fileNameFor("event.status-changed")).toBe("event.status-changed.json");
    expect(nameFromFile("event.status-changed.json")).toBe("event.status-changed");
  });

  it("EN-05-T4 lists properties in a fixed order, so reordering fields in zod changes no file", () => {
    const one = z.object({ b: z.string(), a: z.string().uuid(), c: z.number().int().optional() });
    const other = z.object({ c: z.number().int().optional(), a: z.string().uuid(), b: z.string() });
    expect(canonicalJson(toJsonSchema(one))).toBe(canonicalJson(toJsonSchema(other)));
    expect(canonicalJson(toJsonSchema(one)).endsWith("}\n")).toBe(true);
  });

  it("keeps the order of an enum's values and of an array's items, which can matter", () => {
    expect(canonicalJson({ enum: ["B", "A"], required: ["z", "a"] })).toBe('{\n  "enum": [\n    "B",\n    "A"\n  ],\n  "required": [\n    "a",\n    "z"\n  ]\n}\n');
  });

  it("describes a message the way the checker understands it: no committed schema uses a keyword it cannot check", () => {
    for (const [name, text] of committed) {
      const schema = JSON.parse(text) as unknown as Record<string, unknown>;
      expect(checkBackwardCompatible(schema, schema), name).toEqual([]);
    }
  });

  it("closes every object, so an unknown field in a message is refused and the registry rules apply", () => {
    const open: string[] = [];
    const walk = (node: unknown, where: string) => {
      if (Array.isArray(node)) return node.forEach((inner, i) => walk(inner, `${where}[${i}]`));
      if (node === null || typeof node !== "object") return;
      const schema = node as Record<string, unknown>;
      if (schema.type === "object" && schema.additionalProperties !== false) open.push(where);
      for (const [key, inner] of Object.entries(schema)) walk(inner, `${where}.${key}`);
    };
    for (const [name, text] of committed) walk(JSON.parse(text), name);
    // The envelope's data is a record whose shape the message type's own schema gives.
    expect(open).toEqual(["cloudevent.json.properties.data"]);
  });
});
