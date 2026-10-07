import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { testDb } from "../../support/testDb.js";

/**
 * I1 — a venue's availability calendar, against the venue and event schemas.
 * The week is the one FX-CALENDAR gives the functional cases (tests/I1), so a
 * failure here and a failing card describe the same thing.
 */

vi.mock("../../../src/shared/auth/verifyJwt.js", () => ({
  verifyJwt: (req: { auth?: { supabaseUserId?: string } }, _res: unknown, next: () => void) => {
    req.auth = { supabaseUserId: "test-subject" };
    next();
  },
}));

vi.mock("../../../src/modules/venue/auth/identity.js", async () => {
  const actual = await vi.importActual<typeof import("../../../src/modules/venue/auth/identity.js")>(
    "../../../src/modules/venue/auth/identity.js",
  );
  return { ...actual, resolveCurrentUser: vi.fn() };
});

const { resolveCurrentUser } = await import("../../../src/modules/venue/auth/identity.js");
const { app } = await import("../../../src/app.js");

const sql = testDb();
const STAFF = "a9999999-0000-0000-0000-000000000023";
const OWNER = "a9999999-0000-0000-0000-000000000021";
const COORDINATOR = "a9999999-0000-0000-0000-000000000022";
const bearer = { Authorization: "Bearer test-token" };

function signedInAs(role: string, userId = COORDINATOR) {
  vi.mocked(resolveCurrentUser).mockResolvedValue({ id: userId, email: "user@connectsphere.test", role: role as never });
}

const open = (opensAt: string, closesAt: string) => ({ opensAt, closesAt });
const HOURS = {
  monday: open("08:00", "22:00"),
  tuesday: open("08:00", "22:00"),
  wednesday: open("08:00", "22:00"),
  thursday: open("08:00", "22:00"),
  friday: open("08:00", "22:00"),
  saturday: open("09:00", "18:00"),
  sunday: null,
};

async function cleanUp() {
  const ours = sql`select id from venue.venues where created_by = ${STAFF}`;
  await sql`delete from venue.venue_slots where venue_id in (${ours})`;
  await sql`delete from venue.unavailability_blocks where venue_id in (${ours})`;
  await sql`delete from venue.venues where created_by = ${STAFF}`;
  await sql`delete from event.events where owner_id = ${OWNER}`;
}

beforeEach(cleanUp);
afterAll(async () => {
  await cleanUp();
  await sql.end();
});

async function newVenue(name = "I1 Test Auditorium"): Promise<string> {
  const [row] = await sql<{ id: string }[]>`
    insert into venue.venues (name, building, max_capacity, layouts, operating_hours, created_by, updated_by)
    values (${name}, 'I1 Test Building', 300, ${sql.json([{ name: "Theatre", capacity: 300 }])}, ${sql.json(HOURS)},
            ${STAFF}, ${STAFF})
    returning id
  `;
  return row!.id;
}

/** A Singapore time on a December 2026 day. */
const at = (day: number, hhmm: string) => `2026-12-${String(day).padStart(2, "0")}T${hhmm}:00+08:00`;

async function newEvent(name: string): Promise<{ id: string; reference: string }> {
  const [row] = await sql<{ id: string; reference: string }[]>`
    insert into event.events (
      reference, owner_id, name, purpose, description, proposed_start_at, proposed_end_at,
      expected_attendance, equipment_required, registration_required, status, submitted_at,
      last_saved_at, created_by, updated_by
    ) values (
      'EVT-' || lpad(nextval('event.event_reference_seq')::text, 6, '0'), ${OWNER}, ${name}, 'I1 test',
      'I1 test', ${at(7, "10:00")}, ${at(7, "12:00")}, 100, false, false, 'PLANNING', now(), now(), ${OWNER}, ${OWNER}
    )
    returning id, reference
  `;
  return row!;
}

async function slot(
  venueId: string,
  eventId: string,
  reference: string,
  from: string,
  until: string,
  setup: number,
  turnaround: number,
  status: string,
) {
  await sql`
    insert into venue.venue_slots
      (venue_id, event_id, reference, starts_at, ends_at, setup_minutes, turnaround_minutes, status, created_by, updated_by)
    values (${venueId}, ${eventId}, ${reference}, ${from}, ${until}, ${setup}, ${turnaround}, ${status}, ${COORDINATOR}, ${COORDINATOR})
  `;
}

async function block(venueId: string, from: string, until: string, reasonType: string, description: string, status = "ACTIVE") {
  await sql`
    insert into venue.unavailability_blocks (venue_id, starts_at, ends_at, reason_type, description, status, created_by, updated_by)
    values (${venueId}, ${from}, ${until}, ${reasonType}, ${description}, ${status}, ${STAFF}, ${STAFF})
  `;
}

/** FX-CALENDAR's week (tests/I1/README.md), at a venue of this test's own. */
async function fxCalendar() {
  const venueId = await newVenue();
  const symposium = await newEvent("Annual Research Symposium");
  const alumni = await newEvent("Alumni Networking Night");
  const workshop = await newEvent("Saturday Coding Workshop");
  const lecture = await newEvent("Guest Lecture");
  await slot(venueId, symposium.id, "I1-FX-SYMPOSIUM", at(7, "10:00"), at(7, "12:00"), 30, 30, "CONFIRMED");
  await slot(venueId, alumni.id, "I1-FX-ALUMNI", at(7, "14:00"), at(7, "16:00"), 15, 45, "HELD");
  await slot(venueId, workshop.id, "I1-FX-WORKSHOP", at(12, "15:00"), at(12, "17:00"), 0, 60, "CONFIRMED");
  await slot(venueId, lecture.id, "I1-FX-LECTURE", at(11, "10:00"), at(11, "12:00"), 0, 0, "RELEASED");
  await block(venueId, at(8, "09:00"), at(8, "13:00"), "MAINTENANCE", "Stage lighting rewiring");
  await block(venueId, at(9, "18:00"), at(10, "12:00"), "RENOVATION", "Seat replacement");
  await block(venueId, at(11, "14:00"), at(11, "15:00"), "SAFETY", "Fire drill", "REMOVED");
  return { venueId, symposium, alumni, workshop, lecture };
}

const clock = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Singapore", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
/** HH:MM–HH:MM in Singapore time; a period ending at the next midnight ends at 24:00. */
function span(period: { startsAt: string; endsAt: string }) {
  const end = clock.format(new Date(period.endsAt));
  return `${clock.format(new Date(period.startsAt))}–${end === "00:00" ? "24:00" : end}`;
}

interface Period {
  kind: string;
  startsAt: string;
  endsAt: string;
  bookingStatus?: string;
  eventReference?: string | null;
  reasonType?: string;
  description?: string;
}
interface Day {
  date: string;
  committed: Period[];
  free: { startsAt: string; endsAt: string }[];
}

const committed = (day: Day) =>
  day.committed.map((p) =>
    [span(p), p.kind, p.bookingStatus, p.eventReference, p.reasonType, p.description].filter(Boolean).join(" "),
  );
const free = (day: Day) => day.free.map(span);

function calendar(venueId: string, from: string, to: string) {
  return request(app).get(`/api/v1/venues/${venueId}/availability`).query({ from, to }).set(bearer);
}

describe("GET /api/v1/venues/:id/availability", () => {
  it("gives each day of the week its committed and free periods (I1 AC1 to AC6, I1-T1)", async () => {
    const fx = await fxCalendar();
    signedInAs("EVENT_COORDINATOR");

    const res = await calendar(fx.venueId, "2026-12-07", "2026-12-13");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ venueId: fx.venueId, timeZone: "Asia/Singapore", from: "2026-12-07", to: "2026-12-13" });
    const days: Day[] = res.body.days;
    expect(days.map((day) => day.date)).toEqual([
      "2026-12-07", "2026-12-08", "2026-12-09", "2026-12-10", "2026-12-11", "2026-12-12", "2026-12-13",
    ]);
    const [mon, tue, wed, thu, fri, sat, sun] = days as [Day, Day, Day, Day, Day, Day, Day];
    const S = fx.symposium.reference;
    const A = fx.alumni.reference;
    const W = fx.workshop.reference;

    expect(committed(mon)).toEqual([
      "00:00–08:00 OUTSIDE_HOURS",
      `09:30–10:00 SETUP CONFIRMED ${S}`,
      `10:00–12:00 BOOKING CONFIRMED ${S}`,
      `12:00–12:30 TURNAROUND CONFIRMED ${S}`,
      `13:45–14:00 SETUP PENDING ${A}`,
      `14:00–16:00 BOOKING PENDING ${A}`,
      `16:00–16:45 TURNAROUND PENDING ${A}`,
      "22:00–24:00 OUTSIDE_HOURS",
    ]);
    expect(free(mon)).toEqual(["08:00–09:30", "12:30–13:45", "16:45–22:00"]);

    expect(committed(tue)).toEqual([
      "00:00–08:00 OUTSIDE_HOURS",
      "09:00–13:00 UNAVAILABLE MAINTENANCE Stage lighting rewiring",
      "22:00–24:00 OUTSIDE_HOURS",
    ]);
    expect(free(tue)).toEqual(["08:00–09:00", "13:00–22:00"]);

    expect(committed(wed)).toEqual([
      "00:00–08:00 OUTSIDE_HOURS",
      "18:00–24:00 UNAVAILABLE RENOVATION Seat replacement",
      "22:00–24:00 OUTSIDE_HOURS",
    ]);
    expect(free(wed)).toEqual(["08:00–18:00"]);

    expect(committed(thu)).toEqual([
      "00:00–08:00 OUTSIDE_HOURS",
      "00:00–12:00 UNAVAILABLE RENOVATION Seat replacement",
      "22:00–24:00 OUTSIDE_HOURS",
    ]);
    expect(free(thu)).toEqual(["12:00–22:00"]);

    expect(committed(fri)).toEqual(["00:00–08:00 OUTSIDE_HOURS", "22:00–24:00 OUTSIDE_HOURS"]);
    expect(free(fri)).toEqual(["08:00–22:00"]);

    expect(committed(sat)).toEqual([
      "00:00–09:00 OUTSIDE_HOURS",
      `15:00–17:00 BOOKING CONFIRMED ${W}`,
      `17:00–18:00 TURNAROUND CONFIRMED ${W}`,
      "18:00–24:00 OUTSIDE_HOURS",
    ]);
    expect(free(sat)).toEqual(["09:00–15:00"]);

    expect(committed(sun)).toEqual(["00:00–24:00 OUTSIDE_HOURS"]);
    expect(free(sun)).toEqual([]);
  });

  it("leaves out released and expired slots, removed blocks and other venues' bookings (I1-T7)", async () => {
    const fx = await fxCalendar();
    const elsewhere = await newVenue("I1 Other Room");
    await slot(elsewhere, fx.lecture.id, "I1-ELSEWHERE", at(11, "14:00"), at(11, "16:00"), 0, 0, "CONFIRMED");
    await slot(fx.venueId, fx.lecture.id, "I1-EXPIRED", at(11, "16:00"), at(11, "17:00"), 0, 0, "EXPIRED");
    signedInAs("EVENT_COORDINATOR");

    const res = await calendar(fx.venueId, "2026-12-11", "2026-12-11");

    const [fri] = res.body.days as Day[];
    expect(committed(fri!)).toEqual(["00:00–08:00 OUTSIDE_HOURS", "22:00–24:00 OUTSIDE_HOURS"]);
    expect(free(fri!)).toEqual(["08:00–22:00"]);
  });

  it("clips a block that began the day before to the range's first midnight (I1-T12)", async () => {
    const fx = await fxCalendar();
    signedInAs("EVENT_COORDINATOR");

    const res = await calendar(fx.venueId, "2026-12-10", "2026-12-10");

    expect((res.body.days as Day[]).map((day) => day.date)).toEqual(["2026-12-10"]);
    expect(committed(res.body.days[0])).toContain("00:00–12:00 UNAVAILABLE RENOVATION Seat replacement");
    expect(free(res.body.days[0])).toEqual(["12:00–22:00"]);
  });

  it("shows an approval, and a release, the next time it is read (I1 AC7, I1-T8, I1-T9)", async () => {
    const fx = await fxCalendar();
    signedInAs("EVENT_COORDINATOR");

    await sql`update venue.venue_slots set status = 'CONFIRMED' where reference = 'I1-FX-ALUMNI' and venue_id = ${fx.venueId}`;
    const approved = (await calendar(fx.venueId, "2026-12-07", "2026-12-07")).body.days[0] as Day;
    expect(committed(approved)).toContain(`14:00–16:00 BOOKING CONFIRMED ${fx.alumni.reference}`);
    expect(committed(approved).some((row) => row.includes("PENDING"))).toBe(false);

    await sql`update venue.venue_slots set status = 'RELEASED' where reference = 'I1-FX-SYMPOSIUM' and venue_id = ${fx.venueId}`;
    const released = (await calendar(fx.venueId, "2026-12-07", "2026-12-07")).body.days[0] as Day;
    expect(committed(released).some((row) => row.includes(fx.symposium.reference))).toBe(false);
    expect(free(released)).toEqual(["08:00–13:45", "16:45–22:00"]);
  });

  it("is open to every internal role", async () => {
    const venueId = await newVenue();
    for (const role of ["EVENT_ORGANISER", "EVENT_COORDINATOR", "VENUE_STAFF", "TECH_SUPPORT_STAFF"]) {
      signedInAs(role);
      const res = await calendar(venueId, "2026-12-07", "2026-12-07");
      expect(res.status, role).toBe(200);
    }
  });

  it("refuses an attendee and returns no availability (I1 AC8, I1-T10)", async () => {
    const venueId = await newVenue();
    signedInAs("ATTENDEE");

    const res = await calendar(venueId, "2026-12-07", "2026-12-13");

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("ROLE_NOT_AUTHORISED");
    expect(res.body.days).toBeUndefined();
  });

  it("refuses a venue that doesn't exist, and an id that isn't one (I1-T15)", async () => {
    signedInAs("EVENT_COORDINATOR");
    for (const id of ["00000000-0000-0000-0000-00000000dead", "not-a-venue"]) {
      const res = await calendar(id, "2026-12-07", "2026-12-13");
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("VENUE_NOT_FOUND");
    }
  });

  it("refuses a range longer than 31 days or ending before it starts, naming the field (I1-T13)", async () => {
    const venueId = await newVenue();
    signedInAs("EVENT_COORDINATOR");

    const longest = await calendar(venueId, "2026-12-01", "2026-12-31");
    expect(longest.status).toBe(200);
    expect(longest.body.days).toHaveLength(31);

    const tooLong = await calendar(venueId, "2026-12-01", "2027-01-01");
    expect(tooLong.status).toBe(400);
    expect(tooLong.body.error).toMatchObject({
      code: "VALIDATION_FAILED",
      fields: [{ field: "to", message: "A range can be at most 31 days; this one is 32." }],
    });

    const reversed = await calendar(venueId, "2026-12-13", "2026-12-07");
    expect(reversed.status).toBe(400);
    expect(reversed.body.error.fields).toEqual([{ field: "to", message: "The end date must not be before the start date." }]);

    const missing = await request(app).get(`/api/v1/venues/${venueId}/availability`).set(bearer);
    expect(missing.status).toBe(400);
    expect(missing.body.error.fields.map((field: { field: string }) => field.field)).toEqual(["from", "to"]);
  });
});
