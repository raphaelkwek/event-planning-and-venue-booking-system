import { afterEach, describe, expect, it, vi } from "vitest";
import type { Response, NextFunction } from "express";
import type { ActorRequest } from "../../../src/modules/equipment/auth/actor.js";
vi.mock("../../../src/shared/auth/verifyJwt.js", () => ({ verifyJwt: vi.fn() }));
vi.mock("../../../src/modules/equipment/auth/identity.js", async () => ({ ...await vi.importActual<typeof import("../../../src/modules/equipment/auth/identity.js")>("../../../src/modules/equipment/auth/identity.js"), resolveCurrentUser: vi.fn() }));
vi.mock("../../../src/modules/equipment/api/errors.js", () => ({ refuse: vi.fn() }));
const { resolveCurrentUser, IdentityUnavailableError, IdentityRefusedError } = await import("../../../src/modules/equipment/auth/identity.js");
const { authenticate, requireRole } = await import("../../../src/modules/equipment/auth/actor.js");
const { verifyJwt } = await import("../../../src/shared/auth/verifyJwt.js");
const { refuse } = await import("../../../src/modules/equipment/api/errors.js");
const res = {} as Response;
const req = () => ({ auth: { supabaseUserId: "p2-subject" } } as ActorRequest);
afterEach(() => vi.clearAllMocks());
describe("P2 actor verification", () => {
  it("runs JWT verification before resolving current identity", () => { expect(authenticate[0]).toBe(verifyJwt); });
  it("resolves the current role into the request actor", async () => {
    vi.mocked(resolveCurrentUser).mockResolvedValue({id:"p2-user",email:"p2@test.invalid",role:"TECH_SUPPORT_STAFF"});
    const current = req(); const next = vi.fn();
    await authenticate[1]!(current,res,next);
    expect(resolveCurrentUser).toHaveBeenCalledWith("p2-subject");
    expect(current.actor).toEqual({userId:"p2-user",role:"TECH_SUPPORT_STAFF"});
    expect(next).toHaveBeenCalledWith(); expect(refuse).not.toHaveBeenCalled();
  });
  it("refuses identity outages with503 and no next middleware", async () => {
    vi.mocked(resolveCurrentUser).mockRejectedValue(new IdentityUnavailableError("offline"));
    const next=vi.fn(); await authenticate[1]!(req(),res,next);
    expect(refuse).toHaveBeenCalledWith(res,503,"IDENTITY_UNAVAILABLE",expect.stringContaining("permissions could not be verified"));
    expect(next).not.toHaveBeenCalled();
  });
  it.each([[401,"UNAUTHENTICATED"],[403,"NO_ROLE_ASSIGNED"]] as const)("preserves identity refusal %s %s", async (status,code) => {
    vi.mocked(resolveCurrentUser).mockRejectedValue(new IdentityRefusedError(status,code,"refusal detail"));
    const next=vi.fn(); await authenticate[1]!(req(),res,next);
    expect(refuse).toHaveBeenCalledWith(res,status,code,"refusal detail"); expect(next).not.toHaveBeenCalled();
  });
  it("passes unexpected defects to error middleware", async () => {
    const defect=new Error("defect"); vi.mocked(resolveCurrentUser).mockRejectedValue(defect);
    const next=vi.fn(); await authenticate[1]!(req(),res,next);
    expect(next).toHaveBeenCalledWith(defect); expect(refuse).not.toHaveBeenCalled();
  });
  it.each(["TECH_SUPPORT_STAFF","EVENT_COORDINATOR"] as const)("allows explicitly permitted %s", (role) => {
    const next=vi.fn(); requireRole("TECH_SUPPORT_STAFF","EVENT_COORDINATOR")({...req(),actor:{userId:"p2-user",role}},res,next as NextFunction);
    expect(next).toHaveBeenCalledWith(); expect(refuse).not.toHaveBeenCalled();
  });
  it("refuses a role outside the permitted set", () => {
    const next=vi.fn(); requireRole("TECH_SUPPORT_STAFF")({...req(),actor:{userId:"p2-user",role:"EVENT_COORDINATOR"}},res,next);
    expect(next).not.toHaveBeenCalled(); expect(refuse).toHaveBeenCalledWith(res,403,"ROLE_NOT_AUTHORISED",expect.any(String));
  });
});
