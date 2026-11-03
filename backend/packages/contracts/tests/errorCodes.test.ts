import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { ERROR_CODES } from "../src/errorCodes.js";

/**
 * The codes are kept in alphabetical order so that pull requests adding a code touch different
 * lines instead of all appending at the end. planning-core's OpenAPI ErrorCode enum is the same
 * list, in the same order.
 */
const spec = join(dirname(fileURLToPath(import.meta.url)), "../../../../documentation/api/planning-core.openapi.yaml");
const specCodes: string[] = parse(readFileSync(spec, "utf8")).components.schemas.ErrorCode.enum;

describe("ERROR_CODES", () => {
  it("is in alphabetical order, with no repeats", () => {
    expect([...new Set(ERROR_CODES)].sort()).toEqual([...ERROR_CODES]);
  });

  it("holds the same codes as planning-core's OpenAPI ErrorCode enum", () => {
    expect(new Set(specCodes)).toEqual(new Set(ERROR_CODES));
  });

  it("matches the OpenAPI enum, which is in alphabetical order too", () => {
    expect(specCodes).toEqual([...specCodes].sort());
    expect(specCodes).toEqual([...ERROR_CODES]);
  });
});
