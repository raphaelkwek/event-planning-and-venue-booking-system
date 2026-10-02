import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { ROLES } from "../src/accessScope.js";

/**
 * EN-07.1, ADR-0010: role names live here, in contracts, and the Cerbos
 * policies in policies/ must use exactly these. A typo in a policy would
 * otherwise deny a whole role silently.
 */

const POLICIES = fileURLToPath(new URL("../../../../policies/", import.meta.url));

function policyFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "tests" ? [] : policyFiles(path);
    return entry.name.endsWith(".yaml") ? [path] : [];
  });
}

/** Every `roles:` and `parentRoles:` list anywhere in a parsed policy. */
function rolesIn(node: unknown): string[] {
  if (Array.isArray(node)) return node.flatMap(rolesIn);
  if (node === null || typeof node !== "object") return [];
  return Object.entries(node).flatMap(([key, value]) =>
    (key === "roles" || key === "parentRoles") && Array.isArray(value) ? value.map(String) : rolesIn(value)
  );
}

describe("Cerbos policy roles", () => {
  const used = [...new Set(policyFiles(POLICIES).flatMap((file) => rolesIn(parse(readFileSync(file, "utf8")))))];

  it("finds the policies (guards against reading an empty folder)", () => {
    expect(used.length).toBeGreaterThan(0);
  });

  it("uses only the roles defined in contracts", () => {
    expect(used.filter((role) => !(ROLES as readonly string[]).includes(role))).toEqual([]);
  });

  it("gives every role defined in contracts at least one permission", () => {
    expect(ROLES.filter((role) => !used.includes(role))).toEqual([]);
  });
});
