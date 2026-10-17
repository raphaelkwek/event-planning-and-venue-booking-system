import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { ERROR_CODES } from "@connectsphere/contracts";

/**
 * The OpenAPI file's ErrorCode schema documents the shared list in contracts
 * (implementation.md §5), so it must list exactly those codes, in the same order.
 * A code added to contracts without its spec entry fails CI here.
 */

const SPEC_PATH = fileURLToPath(
  new URL("../../../../../documentation/api/planning-core.openapi.yaml", import.meta.url)
);

describe("planning-core.openapi.yaml ErrorCode and contracts", () => {
  it("lists exactly the error codes contracts lists, in the same order", () => {
    const spec = parse(readFileSync(SPEC_PATH, "utf8")) as {
      components: { schemas: { ErrorCode: { enum: string[] } } };
    };
    expect(spec.components.schemas.ErrorCode.enum).toEqual([...ERROR_CODES]);
  });
});
