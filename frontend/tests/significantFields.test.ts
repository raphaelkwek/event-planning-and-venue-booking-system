import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SIGNIFICANT_EVENT_FIELDS, SIGNIFICANT_FIELD_LABELS as CONTRACT_LABELS } from "@connectsphere/contracts";
import { SIGNIFICANT_FIELD_LABELS } from "../src/shared/changeRequests.js";

// G2 (AC1) — the significant fields are held once, in @connectsphere/contracts, which the server
// uses for G1's edit and S1/S2's change requests. The web app's change-request screens (the request
// form, the decision and the pending-change notice) read the same list rather than a copy.

const SRC = join(__dirname, "..", "src");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? sourceFiles(join(dir, entry.name)) : /\.tsx?$/.test(entry.name) ? [join(dir, entry.name)] : []
  );
}

describe("significant fields (G2 AC1)", () => {
  it("G2-T1 the screens take the significant fields and their labels from the contracts list", () => {
    // The very object the contracts export, not a copy that could drift.
    expect(SIGNIFICANT_FIELD_LABELS).toBe(CONTRACT_LABELS);
    expect(Object.keys(SIGNIFICANT_FIELD_LABELS)).toEqual([...SIGNIFICANT_EVENT_FIELDS]);

    // No file of the web app spells out the six names itself, as a list or a union type would.
    const copies = sourceFiles(SRC).filter((file) => {
      const text = readFileSync(file, "utf8");
      return SIGNIFICANT_EVENT_FIELDS.every((field) => text.includes(`"${field}"`) || text.includes(`'${field}'`));
    });
    expect(copies).toEqual([]);
  });
});
