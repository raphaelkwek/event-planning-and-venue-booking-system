/**
 * EN-19 — the waiting room's rules, pure: no database, no clock of their own.
 * The caller passes the instant to judge by.
 *
 * How the queue works (ADR-0011, migration 0009). Each event has a gate with
 * the earliest time its next joiner may be admitted. Joining takes the next
 * slot, `max(now, gate)`, and moves the gate on by one interval (1/N of a
 * second, rounded up to a whole millisecond so the rate can only be at or
 * below N). The attendee is admitted when the clock reaches their slot. So
 * admissions are at least one interval apart: N a second per event, with no
 * burst beyond one, however many join at once.
 */

/** 500 requests a second overall is what EN-18 tests; five high-demand events at this rate fill it. */
export const DEFAULT_ADMIT_PER_SECOND = 100;
export const MAX_ADMIT_PER_SECOND = 1000;
/** Long enough to finish registering, short enough that a token is not worth hoarding. */
export const DEFAULT_TOKEN_TTL_SECONDS = 300;
export const MIN_TOKEN_TTL_SECONDS = 10;
export const MAX_TOKEN_TTL_SECONDS = 3600;
export const MIN_SIGNING_KEY_LENGTH = 32;

export interface WaitingRoomSettings {
  admitPerSecond: number;
  tokenTtlSeconds: number;
}

type Env = Record<string, string | undefined>;

function wholeNumber(env: Env, name: string, fallback: number, min: number, max: number): number {
  const raw = env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be a whole number from ${min} to ${max}, but it is "${raw}".`);
  }
  return value;
}

/** The admission rate and the token's life, from the environment. An invalid value is an error, so the service does not start with it. */
export function readWaitingRoomSettings(env: Env): WaitingRoomSettings {
  return {
    admitPerSecond: wholeNumber(env, "WAITING_ROOM_ADMIT_PER_SECOND", DEFAULT_ADMIT_PER_SECOND, 1, MAX_ADMIT_PER_SECOND),
    tokenTtlSeconds: wholeNumber(env, "WAITING_ROOM_TOKEN_TTL_SECONDS", DEFAULT_TOKEN_TTL_SECONDS, MIN_TOKEN_TTL_SECONDS, MAX_TOKEN_TTL_SECONDS),
  };
}

/** The key admission tokens are signed with; empty when none is set, which switches the waiting room off for flagged events. */
export function readSigningKey(env: Env): string {
  const key = env.WAITING_ROOM_SIGNING_KEY?.trim() ?? "";
  if (key !== "" && key.length < MIN_SIGNING_KEY_LENGTH) {
    throw new Error(`WAITING_ROOM_SIGNING_KEY must be at least ${MIN_SIGNING_KEY_LENGTH} characters, or left unset.`);
  }
  return key;
}

/** The gap between two admissions: 1/N of a second, rounded up to a whole millisecond. */
export function slotIntervalMs(admitPerSecond: number): number {
  return Math.ceil(1000 / admitPerSecond);
}

/**
 * The slot a joiner gets, and where the gate moves to. The first joiner of an
 * idle gate is admitted at once; the next waits one interval, and so on.
 */
export function assignSlot(now: Date, gateNextSlotAt: Date, intervalMs: number): { admitAt: Date; nextSlotAt: Date } {
  const admitAt = new Date(Math.max(now.getTime(), gateNextSlotAt.getTime()));
  return { admitAt, nextSlotAt: new Date(admitAt.getTime() + intervalMs) };
}

export type EntryState = "WAITING" | "ADMITTED" | "EXPIRED" | "USED";

/** When an admitted entry's token stops being accepted: its slot plus the token's life. */
export function admissionExpiresAt(admitAt: Date, tokenTtlSeconds: number): Date {
  return new Date(admitAt.getTime() + tokenTtlSeconds * 1000);
}

/**
 * Where an entry stands. Spent beats everything; before the slot it waits; from
 * the slot until the instant of expiry it is admitted (the expiry instant
 * itself is already too late).
 */
export function entryState(entry: { admitAt: Date; consumedAt: Date | null }, now: Date, tokenTtlSeconds: number): EntryState {
  if (entry.consumedAt !== null) return "USED";
  const t = now.getTime();
  if (t < entry.admitAt.getTime()) return "WAITING";
  return t < admissionExpiresAt(entry.admitAt, tokenTtlSeconds).getTime() ? "ADMITTED" : "EXPIRED";
}

/** Whole seconds until the slot, rounded up; 0 once it has come. */
export function estimatedWaitSeconds(admitAt: Date, now: Date): number {
  return Math.max(0, Math.ceil((admitAt.getTime() - now.getTime()) / 1000));
}

/** 1 for the next to be admitted; 0 for anyone no longer waiting. `ahead` is the entries still waiting before this one. */
export function queuePosition(state: EntryState, ahead: number): number {
  return state === "WAITING" ? ahead + 1 : 0;
}

/** Whether a joiner who already has an entry keeps it: only while it is waiting or admitted. */
export function keepsPlace(state: EntryState): boolean {
  return state === "WAITING" || state === "ADMITTED";
}
