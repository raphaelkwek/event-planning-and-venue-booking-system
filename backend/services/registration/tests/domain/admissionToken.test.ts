import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { signAdmission, verifyAdmission, type AdmissionClaims } from "../../src/domain/admissionToken.js";

/**
 * EN-19 — the admission token: signed, bound to the event and the attendee,
 * and short-lived. A token is refused for the first thing wrong with it,
 * checked in this order: present, well formed, signed by us, for this event,
 * for this attendee, and not yet expired.
 */

const KEY = "k".repeat(32);
const OTHER_KEY = "o".repeat(32);
const EVENT = "11111111-1111-4111-8111-111111111111";
const ATTENDEE = "22222222-2222-4222-8222-222222222222";
const ENTRY = "33333333-3333-4333-8333-333333333333";
const EXPIRES = Date.parse("2026-12-05T02:05:00.000Z");
const claims: AdmissionClaims = { entryId: ENTRY, eventId: EVENT, attendeeId: ATTENDEE, expiresAtMs: EXPIRES };
const expected = { eventId: EVENT, attendeeId: ATTENDEE };
const before = new Date(EXPIRES - 1);

const reason = (token: string | null | undefined, now = before, key = KEY, who = expected) => {
  const checked = verifyAdmission(token, key, who, now);
  return checked.ok ? "OK" : checked.reason;
};

/** A token with this payload, correctly signed, to reach the checks after the signature. */
function signedPayload(payload: unknown): string {
  const body = Buffer.from(typeof payload === "string" ? payload : JSON.stringify(payload)).toString("base64url");
  return `v1.${body}.${createHmac("sha256", KEY).update(`v1.${body}`).digest().toString("base64url")}`;
}

describe("signAdmission and verifyAdmission", () => {
  it("EN-19-T5 accepts its own token and returns what it admits", () => {
    const checked = verifyAdmission(signAdmission(claims, KEY), KEY, expected, before);
    expect(checked).toEqual({ ok: true, claims });
  });

  it("EN-19-T8 accepts a token up to the instant before it expires, and refuses it at that instant and after", () => {
    const token = signAdmission(claims, KEY);
    expect(reason(token, new Date(EXPIRES - 1))).toBe("OK");
    expect(reason(token, new Date(EXPIRES))).toBe("EXPIRED");
    expect(reason(token, new Date(EXPIRES + 1000))).toBe("EXPIRED");
  });

  it("EN-19-T5 refuses another event's token and another attendee's token", () => {
    const token = signAdmission(claims, KEY);
    expect(reason(token, before, KEY, { eventId: "44444444-4444-4444-8444-444444444444", attendeeId: ATTENDEE })).toBe("WRONG_EVENT");
    expect(reason(token, before, KEY, { eventId: EVENT, attendeeId: "55555555-5555-4555-8555-555555555555" })).toBe("WRONG_ATTENDEE");
  });

  it("EN-19-T5 refuses a token signed with another key, one with its signature changed, and one with its payload changed", () => {
    const token = signAdmission(claims, KEY);
    expect(reason(signAdmission(claims, OTHER_KEY))).toBe("BAD_SIGNATURE");

    const [prefix, payload, signature] = token.split(".") as [string, string, string];
    const flipped = signature.startsWith("A") ? `B${signature.slice(1)}` : `A${signature.slice(1)}`;
    expect(reason(`${prefix}.${payload}.${flipped}`)).toBe("BAD_SIGNATURE");
    expect(reason(`${prefix}.${payload}.${signature.slice(0, -2)}`)).toBe("BAD_SIGNATURE");

    const forgedPayload = Buffer.from(JSON.stringify({ ent: ENTRY, evt: EVENT, att: "66666666-6666-4666-8666-666666666666", exp: EXPIRES })).toString("base64url");
    expect(reason(`${prefix}.${forgedPayload}.${signature}`, before, KEY, { eventId: EVENT, attendeeId: "66666666-6666-4666-8666-666666666666" })).toBe("BAD_SIGNATURE");
  });

  it("EN-19-T5 refuses a missing token and anything that is not a token", () => {
    for (const missing of [null, undefined, ""]) expect(reason(missing)).toBe("MISSING");
    for (const junk of ["nonsense", "v1.only-two", "v2.a.b", "v1..sig", "v1.payload.", "a.b.c.d"]) expect(reason(junk)).toBe("MALFORMED");
  });

  it("refuses a correctly signed payload that is not the claims it should be", () => {
    expect(reason(signedPayload("not json"))).toBe("MALFORMED");
    expect(reason(signedPayload("null"))).toBe("MALFORMED");
    expect(reason(signedPayload("7"))).toBe("MALFORMED");
    const whole = { ent: ENTRY, evt: EVENT, att: ATTENDEE, exp: EXPIRES };
    expect(reason(signedPayload(whole))).toBe("OK");
    for (const field of ["ent", "evt", "att", "exp"]) {
      const partial: Record<string, unknown> = { ...whole };
      delete partial[field];
      expect(reason(signedPayload(partial)), field).toBe("MALFORMED");
    }
    expect(reason(signedPayload({ ...whole, ent: "" }))).toBe("MALFORMED");
    expect(reason(signedPayload({ ...whole, exp: "soon" }))).toBe("MALFORMED");
    expect(reason(signedPayload({ ...whole, exp: null }))).toBe("MALFORMED");
    expect(reason(signedPayload(`{"ent":"${ENTRY}","evt":"${EVENT}","att":"${ATTENDEE}","exp":1e999}`))).toBe("MALFORMED");
  });

  it("checks the binding before the expiry, so an expired token of someone else's is not reported as expired", () => {
    const token = signAdmission(claims, KEY);
    const late = new Date(EXPIRES + 1);
    expect(reason(token, late, KEY, { eventId: EVENT, attendeeId: "55555555-5555-4555-8555-555555555555" })).toBe("WRONG_ATTENDEE");
    expect(reason(token, late)).toBe("EXPIRED");
  });
});
