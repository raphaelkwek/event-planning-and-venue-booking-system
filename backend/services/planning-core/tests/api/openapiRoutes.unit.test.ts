import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { app } from "../../src/app.js";

/**
 * EN-09, ADR-0015: the OpenAPI file is the contract, so it must list exactly the
 * routes planning-core serves. A route added without its spec entry, or a spec
 * entry left behind after its route was removed, fails CI here.
 */

const SPEC_PATH = fileURLToPath(
  new URL("../../../../../documentation/api/planning-core.openapi.yaml", import.meta.url)
);
const HTTP_METHODS = ["get", "post", "put", "patch", "delete"];

interface Layer {
  name?: string;
  route?: { path: string; methods: Record<string, boolean> };
  handle?: { stack?: Layer[] };
}

function documentedRoutes(): string[] {
  const spec = parse(readFileSync(SPEC_PATH, "utf8")) as { paths: Record<string, Record<string, unknown>> };
  return Object.entries(spec.paths).flatMap(([path, item]) =>
    Object.keys(item)
      .filter((key) => HTTP_METHODS.includes(key))
      .map((method) => `${method.toUpperCase()} ${path}`)
  );
}

/** Walks the Express router tree; every module router is mounted at the root. */
function servedRoutes(stack: Layer[]): string[] {
  return stack.flatMap((layer) => {
    if (layer.route) {
      const path = layer.route.path.replace(/:(\w+)/g, "{$1}");
      return Object.keys(layer.route.methods)
        .filter((method) => HTTP_METHODS.includes(method))
        .map((method) => `${method.toUpperCase()} ${path}`);
    }
    if (layer.name === "router" && layer.handle?.stack) return servedRoutes(layer.handle.stack);
    return [];
  });
}

describe("documentation/api/planning-core.openapi.yaml", () => {
  it("documents every route planning-core serves, and no route it doesn't", () => {
    const served = [...new Set(servedRoutes((app as unknown as { _router: { stack: Layer[] } })._router.stack))];

    expect(documentedRoutes().sort()).toEqual(served.sort());
  });

  it("finds the routes at all (guards against the walk silently returning nothing)", () => {
    expect(servedRoutes((app as unknown as { _router: { stack: Layer[] } })._router.stack)).toContain(
      "POST /api/v1/events/{id}/approve"
    );
  });
});
