import { beforeEach, describe, expect, it, vi } from "vitest";
import { signAdmission } from "../../src/domain/admissionToken.js";
import { aListing, aRegistration, ATTENDEE, EVENT, fakeSql, NOW } from "../support/builders.js";

/**
 * R2, EN-19 — the registration service's decisions, with the repo layer
 * replaced by scripted answers: which refusal comes back for which state, what
 * is written when a registration is made, and that a refusal writes nothing.
 * The SQL itself (locks, SKIP LOCKED, the unique index) runs against Postgres
 * in r2Cards.test.ts.
 */

const repo = vi.hoisted(() => ({
  findListing: vi.fn(),
  findActiveRegistration: vi.fn(),
  insertRegistration: vi.fn(),
  claimSeat: vi.fn(),
  lockAttendee: vi.fn(),
  lockPlaces: vi.fn(),
  closeEntryRegistered: vi.fn(),
  spendEntry: vi.fn(),
  writeRegistrationOutbox: vi.fn(),
}));

vi.mock("../../src/repo/listings.js", () => ({ findListing: repo.findListing }));
vi.mock("../../src/repo/registrations.js", () => ({
  DuplicateRegistrationError: class DuplicateRegistrationError extends Error {},
  findActiveRegistration: repo.findActiveRegistration,
  insertRegistration: repo.insertRegistration,
}));
vi.mock("../../src/repo/seats.js", () => ({ claimSeat: repo.claimSeat, lockAttendee: repo.lockAttendee, lockPlaces: repo.lockPlaces }));
vi.mock("../../src/repo/waitlist.js", () => ({ closeEntryRegistered: repo.closeEntryRegistered }));
vi.mock("../../src/repo/waitingRoom.js", () => ({ spendEntry: repo.spendEntry }));
vi.mock("../../src/outbox/write.js", () => ({ writeRegistrationOutbox: repo.writeRegistrationOutbox }));

const { register } = await import("../../src/service/register.js");
const { DuplicateRegistrationError } = await import("../../src/repo/registrations.js");

const KEY = "unit-test-signing-key-of-32-chars!!";
const ENTRY = "55555555-5555-4555-8555-555555555555";
const input = { eventId: EVENT, attendeeId: ATTENDEE, now: NOW, correlationId: "corr-1" };

beforeEach(() => {
  vi.resetAllMocks();
  repo.findListing.mockResolvedValue(aListing());
  repo.findActiveRegistration.mockResolvedValue(null);
  repo.claimSeat.mockResolvedValue({ id: "seat-1" });
  repo.insertRegistration.mockResolvedValue(aRegistration());
  repo.spendEntry.mockResolvedValue(true);
});

describe("register", () => {
  it("registers: claims a public seat, inserts, closes a waiting entry and writes registration.confirmed", async () => {
    const { sql, begin } = fakeSql();
    const outcome = await register(sql, input);

    expect(outcome).toMatchObject({ ok: true, registration: { id: aRegistration().id } });
    expect(begin).toHaveBeenCalledOnce();
    expect(repo.lockPlaces).toHaveBeenCalledWith(expect.anything(), EVENT, "shared");
    expect(repo.claimSeat).toHaveBeenCalledWith(expect.anything(), { eventId: EVENT, pool: "PUBLIC", attendeeId: ATTENDEE });
    expect(repo.closeEntryRegistered).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ eventId: EVENT, attendeeId: ATTENDEE, by: ATTENDEE }));
    expect(repo.writeRegistrationOutbox).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        messageType: "registration.confirmed",
        correlationId: "corr-1",
        actor: { userId: ATTENDEE, role: "ATTENDEE" },
        data: expect.objectContaining({ eventReference: "EVT-000123", attendeeId: ATTENDEE }),
      }),
    );
    expect(repo.spendEntry).not.toHaveBeenCalled();
  });

  it.each([
    ["the event is unknown", null],
    ["the event is not confirmed", aListing({ status: "PLANNING" })],
    ["registration is not enabled", aListing({ registrationRequired: false })],
  ])("answers EVENT_NOT_FOUND when %s, without opening a transaction", async (_why, listing) => {
    repo.findListing.mockResolvedValue(listing);
    const { sql, begin } = fakeSql();
    expect(await register(sql, input)).toEqual({ ok: false, code: "EVENT_NOT_FOUND" });
    expect(begin).not.toHaveBeenCalled();
  });

  it("refuses outside the window, naming which side of it", async () => {
    const { sql, begin } = fakeSql();
    const early = await register(sql, { ...input, now: new Date("2026-11-30T00:00:00.000Z") });
    const late = await register(sql, { ...input, now: new Date("2026-12-11T00:00:00.000Z") });
    expect(early).toMatchObject({ ok: false, code: "OUTSIDE_WINDOW", state: "NOT_YET_OPEN" });
    expect(late).toMatchObject({ ok: false, code: "OUTSIDE_WINDOW", state: "CLOSED" });
    expect(begin).not.toHaveBeenCalled();
  });

  it("refuses a duplicate with the registration already held, and claims no seat", async () => {
    const held = aRegistration({ reference: "REG-000009" });
    repo.findActiveRegistration.mockResolvedValue(held);
    const { sql } = fakeSql();
    expect(await register(sql, input)).toMatchObject({ ok: false, code: "DUPLICATE", existing: held });
    expect(repo.claimSeat).not.toHaveBeenCalled();
    expect(repo.writeRegistrationOutbox).not.toHaveBeenCalled();
  });

  it("refuses FULL when no seat can be claimed, and writes nothing", async () => {
    repo.claimSeat.mockResolvedValue(null);
    const { sql } = fakeSql();
    expect(await register(sql, input)).toMatchObject({ ok: false, code: "FULL" });
    expect(repo.insertRegistration).not.toHaveBeenCalled();
    expect(repo.writeRegistrationOutbox).not.toHaveBeenCalled();
  });

  it("turns a unique-index refusal into DUPLICATE with the registration found afterwards", async () => {
    const held = aRegistration({ reference: "REG-000010" });
    repo.insertRegistration.mockRejectedValue(new DuplicateRegistrationError());
    repo.findActiveRegistration.mockResolvedValueOnce(null).mockResolvedValueOnce(held);
    const { sql } = fakeSql();
    expect(await register(sql, input)).toMatchObject({ ok: false, code: "DUPLICATE", existing: held });
  });

  it("rethrows the index refusal when the registration it names cannot be found", async () => {
    const error = new DuplicateRegistrationError();
    repo.insertRegistration.mockRejectedValue(error);
    const { sql } = fakeSql();
    await expect(register(sql, input)).rejects.toBe(error);
  });

  it("rethrows any other failure so the caller answers 500", async () => {
    const error = new Error("connection reset");
    repo.insertRegistration.mockRejectedValue(error);
    const { sql } = fakeSql();
    await expect(register(sql, input)).rejects.toBe(error);
  });

  describe("a high-demand event (EN-19)", () => {
    beforeEach(() => repo.findListing.mockResolvedValue(aListing({ highDemand: true })));
    const token = (over: Partial<{ attendeeId: string; expiresAtMs: number }> = {}) =>
      signAdmission({ entryId: ENTRY, eventId: EVENT, attendeeId: ATTENDEE, expiresAtMs: NOW.getTime() + 60_000, ...over }, KEY);

    it("is unavailable when the service holds no signing key", async () => {
      const { sql } = fakeSql();
      expect(await register(sql, { ...input, admission: { token: "x", signingKey: "" } })).toMatchObject({ ok: false, code: "WAITING_ROOM_UNAVAILABLE" });
      expect(await register(sql, input)).toMatchObject({ ok: false, code: "WAITING_ROOM_UNAVAILABLE" });
    });

    it("requires an admission token", async () => {
      const { sql } = fakeSql();
      expect(await register(sql, { ...input, admission: { token: null, signingKey: KEY } })).toMatchObject({ ok: false, code: "ADMISSION_REQUIRED" });
    });

    it("refuses a token signed for someone else", async () => {
      const { sql } = fakeSql();
      const other = token({ attendeeId: "99999999-9999-4999-8999-999999999999" });
      expect(await register(sql, { ...input, admission: { token: other, signingKey: KEY } })).toMatchObject({ ok: false, code: "ADMISSION_REQUIRED" });
    });

    it("refuses an expired token as ADMISSION_EXPIRED", async () => {
      const { sql } = fakeSql();
      const expired = token({ expiresAtMs: NOW.getTime() });
      expect(await register(sql, { ...input, admission: { token: expired, signingKey: KEY } })).toMatchObject({ ok: false, code: "ADMISSION_EXPIRED" });
    });

    it("spends the token's entry in the registration's transaction", async () => {
      const { sql } = fakeSql();
      const outcome = await register(sql, { ...input, admission: { token: token(), signingKey: KEY } });
      expect(outcome.ok).toBe(true);
      expect(repo.spendEntry).toHaveBeenCalledWith(expect.anything(), { entryId: ENTRY, eventId: EVENT, attendeeId: ATTENDEE, now: NOW });
    });

    it("rolls back and refuses when the token was already spent", async () => {
      repo.spendEntry.mockResolvedValue(false);
      const { sql } = fakeSql();
      expect(await register(sql, { ...input, admission: { token: token(), signingKey: KEY } })).toMatchObject({ ok: false, code: "ADMISSION_REQUIRED" });
      expect(repo.insertRegistration).not.toHaveBeenCalled();
      expect(repo.writeRegistrationOutbox).not.toHaveBeenCalled();
    });
  });
});
