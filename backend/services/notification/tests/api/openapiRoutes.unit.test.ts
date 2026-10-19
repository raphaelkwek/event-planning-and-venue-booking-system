import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { app } from "../../src/app.js";

/**
 * ADR-0015: the OpenAPI file is the contract, so it must list exactly the
 * routes the notification service serves.
 */

const SPEC_PATH = fileURLToPath(new URL("../../../../../documentation/api/notification.openapi.yaml", import.meta.url));
const HTTP_METHODS = ["get", "post", "put", "patch", "delete"];

interface Layer {
  route?: { path: string; methods: Record<string, boolean> };
  handle?: { stack?: Layer[] };
}

function documentedRoutes(): string[] {
  const spec = parse(readFileSync(SPEC_PATH, "utf8")) as { paths: Record<string, Record<string, unknown>> };
  return Object.entries(spec.paths).flatMap(([path, item]) =>
    Object.keys(item)
      .filter((key) => HTTP_METHODS.includes(key))
      .map((method) => `${method.toUpperCase()} ${path}`),
  );
}

function servedRoutes(stack: Layer[]): string[] {
  return stack.flatMap((layer) => {
    if (layer.route) {
      const path = layer.route.path.replace(/:(\w+)/g, "{$1}");
      return Object.keys(layer.route.methods)
        .filter((method) => HTTP_METHODS.includes(method))
        .map((method) => `${method.toUpperCase()} ${path}`);
    }
    return layer.handle?.stack ? servedRoutes(layer.handle.stack) : [];
  });
}

describe("notification.openapi.yaml", () => {
  it("documents exactly the routes the service serves", () => {
    const served = servedRoutes((app as unknown as { _router: { stack: Layer[] } })._router.stack).sort();
    expect(served).toEqual(documentedRoutes().sort());
  });
});
