import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SIGNIFICANT_EVENT_FIELDS, SIGNIFICANT_FIELD_LABELS as CONTRACT_LABELS } from "@connectsphere/contracts";
import { SIGNIFICANT_FIELD_LABELS } from "../src/shared/changeRequests.js";

// G2 (AC1) — the significant fields are held once, in @connectsphere/contracts, which the server
// uses for G1's edit and S1/S2's change requests. The web app's change-request screens (the request
// form, the decision and the pending-change notice) read the same list rather than a copy.

const SRC = join(__dirname, "..", "src");
const CONTRACTS = "@connectsphere/contracts";

/** The list, its labels and the field type, under any of the names the web app has used for them. */
const SIGNIFICANT_NAMES = ["SIGNIFICANT_EVENT_FIELDS", "SIGNIFICANT_FIELD_LABELS", "SignificantEventField", "SignificantField"];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? sourceFiles(join(dir, entry.name)) : /\.tsx?$/.test(entry.name) ? [join(dir, entry.name)] : []
  );
}

/** Each module a file imports (or re-exports) from, with the names it takes, `type` and aliases stripped. */
function importsOf(file: string): Map<string, string[]> {
  const text = readFileSync(join(SRC, file), "utf8");
  const found = new Map<string, string[]>();
  for (const [, names, from] of text.matchAll(/(?:import|export)\s+(?:type\s+)?\{([^}]*)\}\s*from\s*["']([^"']+)["']/g)) {
    const taken = names!
      .split(",")
      .map((name) => name.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0]!)
      .filter(Boolean);
    found.set(from!, [...(found.get(from!) ?? []), ...taken]);
  }
  return found;
}

/** The significant-field names a file takes from a module other than the contracts. */
function takenElsewhere(imports: Map<string, string[]>): string[] {
  return [...imports].filter(([from]) => from !== CONTRACTS).flatMap(([, names]) => names.filter((name) => SIGNIFICANT_NAMES.includes(name)));
}

describe("significant fields (G2 AC1)", () => {
  it("G2-T1 the screens take the significant fields and their labels from the contracts list", () => {
    // The six fields, spelled out as the card names them, in the contracts' order.
    const six = ["proposedStartAt", "proposedEndAt", "expectedAttendance", "venueRequirements", "equipmentRequired", "equipmentRequirements"];
    expect([...SIGNIFICANT_EVENT_FIELDS]).toEqual(six);

    // The very object the contracts export, not a copy that could drift.
    expect(SIGNIFICANT_FIELD_LABELS).toBe(CONTRACT_LABELS);
    expect(Object.keys(SIGNIFICANT_FIELD_LABELS)).toEqual(six);

    // No file of the web app spells out the six names itself, as a list or a union type would.
    const copies = sourceFiles(SRC).filter((file) => {
      const text = readFileSync(file, "utf8");
      return SIGNIFICANT_EVENT_FIELDS.every((field) => text.includes(`"${field}"`) || text.includes(`'${field}'`));
    });
    expect(copies).toEqual([]);

    // Step 2: the shared file takes the labelled list and the field type from the contracts, and the
    // api file the field type; neither takes either from anywhere else, such as the other's alias.
    const shared = importsOf("shared/changeRequests.ts");
    expect(shared.get(CONTRACTS)).toEqual(expect.arrayContaining(["SIGNIFICANT_FIELD_LABELS", "SignificantEventField"]));
    expect(takenElsewhere(shared)).toEqual([]);
    const api = importsOf("api/changeRequests.ts");
    expect(api.get(CONTRACTS)).toEqual(expect.arrayContaining(["SignificantEventField"]));
    expect(takenElsewhere(api)).toEqual([]);
  });
});
