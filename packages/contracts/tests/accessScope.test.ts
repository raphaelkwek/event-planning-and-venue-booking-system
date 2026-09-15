import { describe, expect, it } from "vitest";
import { accessScopeSchema } from "../src/accessScope.js";

describe("accessScopeSchema", () => {
  it.each([
    { scopeType: "OWNED_BY_USER", userId: "00000000-0000-0000-0000-000000000001" },
    { scopeType: "ALL" },
    { scopeType: "STAFF_OWNED_VENUES", staffUserId: "00000000-0000-0000-0000-000000000002" },
    { scopeType: "STAFF_OWNED_EQUIPMENT", staffUserId: "00000000-0000-0000-0000-000000000003" },
    { scopeType: "PUBLISHED_OPEN_REGISTRATION" },
    { scopeType: "NONE" },
  ])("accepts a valid $scopeType scope", (scope) => {
    expect(() => accessScopeSchema.parse(scope)).not.toThrow();
  });

  it("rejects an unknown scopeType", () => {
    expect(() => accessScopeSchema.parse({ scopeType: "MADE_UP" })).toThrow();
  });

  it("rejects OWNED_BY_USER without a userId", () => {
    expect(() => accessScopeSchema.parse({ scopeType: "OWNED_BY_USER" })).toThrow();
  });
});
