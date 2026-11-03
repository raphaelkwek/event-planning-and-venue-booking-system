import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { attendeeIdOf, attendeeNumberOf, startIdentityStub, type IdentityStub } from "../support/identity-stub.js";

/**
 * EN-18: the identity stand-in the load and chaos runs use. It must give every attendee number the same
 * id every time (the database is read back by it), and refuse anything that is not one of its tokens.
 */

describe("attendee tokens", () => {
  it("gives each attendee number its own stable user id", () => {
    expect(attendeeIdOf(0)).toBe("00000000-0000-4000-8000-000000000000");
    expect(attendeeIdOf(4999)).toBe("00000000-0000-4000-8000-000000001387");
    expect(attendeeIdOf(1)).not.toBe(attendeeIdOf(2));
    expect(attendeeIdOf(7)).toBe(attendeeIdOf(7));
  });

  it("reads the number out of a stand-in token, and nothing else", () => {
    expect(attendeeNumberOf("load-attendee-42")).toBe(42);
    expect(attendeeNumberOf("load-attendee-")).toBeNull();
    expect(attendeeNumberOf("load-attendee-4x")).toBeNull();
    expect(attendeeNumberOf("load-attendee-1234567890123")).toBeNull();
    expect(attendeeNumberOf("attendee:42")).toBeNull();
  });
});

describe("the stand-in server", () => {
  let stub: IdentityStub;
  beforeAll(async () => {
    stub = await startIdentityStub(0);
  });
  afterAll(async () => {
    await stub.close();
  });

  const me = (token?: string) => fetch(`${stub.url}/api/v1/users/me`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });

  it("answers an attendee token with that attendee as an ATTENDEE", async () => {
    const response = await me("load-attendee-12");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: attendeeIdOf(12), email: "attendee-12@connectsphere.test", role: "ATTENDEE" });
  });

  it("refuses a missing or foreign token with UNAUTHENTICATED", async () => {
    for (const response of [await me(), await me("somebody-else")]) {
      expect(response.status).toBe(401);
      expect(((await response.json()) as { error: { code: string } }).error.code).toBe("UNAUTHENTICATED");
    }
  });

  it("knows no other route", async () => {
    expect((await fetch(`${stub.url}/api/v1/anything`)).status).toBe(404);
    expect((await fetch(`${stub.url}/api/v1/users/me`, { method: "POST" })).status).toBe(404);
  });
});
