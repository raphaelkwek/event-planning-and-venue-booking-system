import { vi } from "vitest";
import type { Sql } from "postgres";
import type { Listing } from "../../src/repo/listings.js";
import type { Registration } from "../../src/repo/registrations.js";
import type { WaitlistEntry } from "../../src/repo/waitlist.js";

/** Plain-value builders for the unit tests that stand in for the repo layer (no database). */

export const EVENT = "11111111-1111-4111-8111-111111111111";
export const ATTENDEE = "22222222-2222-4222-8222-222222222222";
export const OWNER = "00000000-0000-0000-0000-000000000001";
export const REG = "33333333-3333-4333-8333-333333333333";
export const NOW = new Date("2026-12-05T02:00:00.000Z");

export const aListing = (over: Partial<Listing> = {}): Listing => ({
  eventId: EVENT,
  eventReference: "EVT-000123",
  name: "R Test Symposium",
  description: null,
  ownerId: OWNER,
  assignedCoordinatorId: null,
  status: "CONFIRMED",
  startsAt: "2026-12-16T06:00:00.000Z",
  endsAt: "2026-12-16T10:00:00.000Z",
  registrationRequired: true,
  registrationOpensAt: "2026-12-01T01:00:00.000Z",
  registrationClosesAt: "2026-12-10T10:00:00.000Z",
  withdrawalDeadlineAt: null,
  highDemand: false,
  ...over,
});

export const aRegistration = (over: Partial<Registration> = {}): Registration => ({
  id: REG,
  reference: "REG-000001",
  eventId: EVENT,
  attendeeId: ATTENDEE,
  seatId: "seat-1",
  status: "REGISTERED",
  registeredAt: "2026-12-05T02:00:00.000Z",
  withdrawnAt: null,
  cancelledAt: null,
  addedBy: null,
  additionReason: null,
  addedOverCapacity: false,
  ...over,
});

export const anEntry = (over: Partial<WaitlistEntry> = {}): WaitlistEntry => ({
  id: "44444444-4444-4444-8444-444444444444",
  reference: "WL-000001",
  eventId: EVENT,
  attendeeId: ATTENDEE,
  status: "WAITLISTED",
  joinedAt: "2026-12-05T02:00:00.000Z",
  lastNotifiedAt: null,
  registrationId: null,
  registeredAt: null,
  withdrawnAt: null,
  cancelledAt: null,
  position: 1,
  ...over,
});

/** A database whose transaction runs the work with the same object as the transaction handle. */
export function fakeSql() {
  const tx = {} as unknown;
  const sql = { begin: vi.fn(async (work: (t: unknown) => Promise<unknown>) => work(tx)) };
  return { sql: sql as unknown as Sql, tx, begin: sql.begin };
}
