import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * EN-19 — the admission token the waiting room hands an admitted attendee, and
 * the register route checks. It is a signed statement, not a session: the
 * entry it admits, the event, the attendee, and the instant it stops being
 * accepted. Anyone can read it; only this service can make one, because the
 * signature is an HMAC-SHA256 under WAITING_ROOM_SIGNING_KEY. Pure but for the
 * crypto: the caller passes the key and the instant.
 *
 * Form: `v1.<payload>.<signature>`, both base64url.
 */

export interface AdmissionClaims {
  entryId: string;
  eventId: string;
  attendeeId: string;
  /** Epoch milliseconds: the token is accepted before this instant and refused at it. */
  expiresAtMs: number;
}

const PREFIX = "v1";

function mac(key: string, payload: string): Buffer {
  return createHmac("sha256", key).update(`${PREFIX}.${payload}`).digest();
}

export function signAdmission(claims: AdmissionClaims, key: string): string {
  const payload = Buffer.from(JSON.stringify({ ent: claims.entryId, evt: claims.eventId, att: claims.attendeeId, exp: claims.expiresAtMs })).toString("base64url");
  return `${PREFIX}.${payload}.${mac(key, payload).toString("base64url")}`;
}

export type AdmissionCheck =
  | { ok: true; claims: AdmissionClaims }
  | { ok: false; reason: "MISSING" | "MALFORMED" | "BAD_SIGNATURE" | "WRONG_EVENT" | "WRONG_ATTENDEE" | "EXPIRED" };

const isText = (value: unknown): value is string => typeof value === "string" && value.length > 0;

function readClaims(payload: string): AdmissionClaims | null {
  try {
    const raw = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<string, unknown> | null;
    if (!raw || typeof raw !== "object") return null;
    if (!isText(raw.ent) || !isText(raw.evt) || !isText(raw.att) || typeof raw.exp !== "number" || !Number.isFinite(raw.exp)) return null;
    return { entryId: raw.ent, eventId: raw.evt, attendeeId: raw.att, expiresAtMs: raw.exp };
  } catch {
    return null;
  }
}

/**
 * Whether `token` admits `expected.attendeeId` to `expected.eventId` at `now`.
 * The signature is checked before the payload is trusted, and expiry last, so
 * an expired token of someone else's is "wrong attendee", not "expired".
 */
export function verifyAdmission(
  token: string | null | undefined,
  key: string,
  expected: { eventId: string; attendeeId: string },
  now: Date,
): AdmissionCheck {
  if (!token) return { ok: false, reason: "MISSING" };
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== PREFIX || !parts[1] || !parts[2]) return { ok: false, reason: "MALFORMED" };
  const [, payload, signature] = parts as [string, string, string];

  const given = Buffer.from(signature, "base64url");
  const wanted = mac(key, payload);
  if (given.length !== wanted.length || !timingSafeEqual(given, wanted)) return { ok: false, reason: "BAD_SIGNATURE" };

  const claims = readClaims(payload);
  if (!claims) return { ok: false, reason: "MALFORMED" };
  if (claims.eventId !== expected.eventId) return { ok: false, reason: "WRONG_EVENT" };
  if (claims.attendeeId !== expected.attendeeId) return { ok: false, reason: "WRONG_ATTENDEE" };
  if (now.getTime() >= claims.expiresAtMs) return { ok: false, reason: "EXPIRED" };
  return { ok: true, claims };
}
