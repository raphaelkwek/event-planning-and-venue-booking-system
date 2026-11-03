import { vi } from "vitest";

// jsdom has no matchMedia, and Atlaskit reads it for theming and motion preferences.
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }),
});

// EN-07: the console asks the server which screens the signed-in role may open
// (POST /api/v1/permissions/check). Screen tests have no server, so the answer
// comes from the same policies/ the server's Cerbos PDP loads, for the role in
// the stored session. permissions.test.tsx tests the real request.
vi.mock("../src/api/permissions.js", async () => {
  const actual = await vi.importActual<typeof import("../src/api/permissions.js")>("../src/api/permissions.js");
  const { allowedFor } = await import("./support/policyAnswers.js");
  return {
    ...actual,
    checkPermissions: vi.fn(async (_token: string, checks: import("../src/api/permissions.js").PermissionCheck[]) => {
      const role = (JSON.parse(sessionStorage.getItem("connectsphere.session") ?? "{}") as { role?: string }).role ?? "";
      return new Set(checks.filter((check) => allowedFor(role, check)).map(actual.permissionKey));
    }),
  };
});
