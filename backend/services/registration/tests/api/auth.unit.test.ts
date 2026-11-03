import { describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import { attendeeOnly, CallerRefusedError, IdentityUnavailableError, signedIn, type CallerRequest } from "../../src/api/auth.js";
import { identifyCaller } from "../../src/api/identity.js";
import { fakeAuth } from "../support/fixtures.js";

/**
 * R1 to R4 — who may call (implementation.md §6): browsing needs a valid token
 * only; registering, withdrawing and my registrations need identity to say the
 * caller is an attendee. No database.
 */

function appWith(guard: express.RequestHandler) {
  const app = express();
  app.get("/probe", guard, (req, res) => res.json({ caller: (req as CallerRequest).caller ?? null }));
  return app;
}

describe("signedIn (R1)", () => {
  const app = appWith(signedIn(fakeAuth));

  it("lets through any valid token, without asking identity", async () => {
    expect((await request(app).get("/probe").set({ Authorization: "Bearer down" })).status).toBe(200);
  });

  it("refuses no token, a malformed header, or a token that fails its signature check", async () => {
    for (const header of [undefined, "Token abc", "Bearer bad"]) {
      const req = request(app).get("/probe");
      const res = await (header ? req.set({ Authorization: header }) : req);
      expect([res.status, res.body.error.code]).toEqual([401, "UNAUTHENTICATED"]);
    }
  });
});

describe("attendeeOnly (R2 to R4)", () => {
  const app = appWith(attendeeOnly(fakeAuth));

  it("lets an attendee through, knowing who they are", async () => {
    const res = await request(app).get("/probe").set({ Authorization: "Bearer attendee:00000000-0000-0000-0000-000000000005" });
    expect(res.body.caller).toMatchObject({ id: "00000000-0000-0000-0000-000000000005", role: "ATTENDEE" });
  });

  it("refuses another role, no token, a revoked session and an unreachable identity, each as itself", async () => {
    const cases: Array<[string | undefined, number, string]> = [
      ["Bearer organiser:00000000-0000-0000-0000-000000000001", 403, "ROLE_NOT_AUTHORISED"],
      [undefined, 401, "UNAUTHENTICATED"],
      ["Bearer revoked", 401, "UNAUTHENTICATED"],
      ["Bearer down", 503, "IDENTITY_UNAVAILABLE"],
    ];
    for (const [header, status, code] of cases) {
      const req = request(app).get("/probe");
      const res = await (header ? req.set({ Authorization: header }) : req);
      expect([res.status, res.body.error.code]).toEqual([status, code]);
    }
  });

  it("passes any other failure on to the error handler", async () => {
    const broken = appWith(attendeeOnly({ ...fakeAuth, identify: async () => Promise.reject(new Error("boom")) }));
    expect((await request(broken).get("/probe").set({ Authorization: "Bearer x" })).status).toBe(500);
  });
});

describe("identifyCaller", () => {
  const user = { id: "00000000-0000-0000-0000-000000000005", email: "attendee@connectsphere.test", role: "ATTENDEE" };
  const answer = (status: number, body: unknown) => async () => new Response(JSON.stringify(body), { status });

  it("asks identity's /users/me with the caller's own token", async () => {
    let asked = "";
    const fetcher = async (url: string, init: { headers: Record<string, string> }) => {
      asked = `${url} ${init.headers.Authorization}`;
      return new Response(JSON.stringify(user), { status: 200 });
    };
    expect(await identifyCaller("tok", { baseUrl: "http://core", fetcher })).toEqual(user);
    expect(asked).toBe("http://core/api/v1/users/me Bearer tok");
  });

  it("passes on identity's refusals, and treats anything else as identity being unavailable", async () => {
    await expect(identifyCaller("t", { baseUrl: "http://core", fetcher: answer(401, { error: { message: "No active session for this token." } }) })).rejects.toEqual(
      new CallerRefusedError(401, "UNAUTHENTICATED", "No active session for this token."),
    );
    await expect(identifyCaller("t", { baseUrl: "http://core", fetcher: answer(403, null) })).rejects.toMatchObject({ status: 403, code: "NO_ROLE_ASSIGNED" });
    await expect(identifyCaller("t", { baseUrl: "http://core", fetcher: answer(401, null) })).rejects.toMatchObject({ message: "No active session for this token." });
    await expect(identifyCaller("t", { baseUrl: "http://core", fetcher: answer(500, {}) })).rejects.toBeInstanceOf(IdentityUnavailableError);
    await expect(identifyCaller("t", { baseUrl: "http://core", fetcher: answer(200, { id: "nope" }) })).rejects.toBeInstanceOf(IdentityUnavailableError);
    await expect(
      identifyCaller("t", {
        baseUrl: "http://core",
        fetcher: async () => {
          throw new Error("ECONNREFUSED");
        },
      }),
    ).rejects.toThrow(/ECONNREFUSED/);
  });
});
