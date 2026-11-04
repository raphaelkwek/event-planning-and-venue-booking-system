import type { Locator, Page } from "@playwright/test";
import { ACCOUNTS } from "./support/accounts.js";
import { expect, signIn, signOut, test, uniqueName } from "./support/fixtures.js";
import { must } from "./support/api.js";
import { deliverOutbox } from "./support/deliver.js";
import { messageOf, openNotifications } from "./support/notifications.js";
import { approvedRequest, createVenue, type VenueRow } from "./support/seed.js";
import { query } from "./support/seed-events.js";
import {
  PERIOD,
  PERIOD_TEXT,
  approveBooking,
  eventBookings,
  eventHolds,
  isRecent,
  requestBooking,
  venueBlocks,
  type HoldRow,
} from "./support/seed-venues.js";
import { holdsOf, openNav, openVenueRequests, placedHold, runHoldExpirySweep, singaporeMoment, storedNotices } from "./support/seed-venue-notices.js";

/**
 * Venue bookings through the real screens: a coordinator's booking request (L1) and hold (L3),
 * Venue Staff's decisions on them (M1, M2, L3), a hold's expiry (L6), unavailability blocks (I2)
 * and the availability calendar that shows them all (I1). The cards' SQL-editor reads are done
 * through the same API the screens read. The cards' 2 December 2026 period is moved to Tuesday
 * 2 March 2027, so the journeys never fall into the past.
 */

const VENUE_STAFF = ACCOUNTS.venuestaff.id;
const COORDINATOR = ACCOUNTS.coordinator.id;

/** FX-BOOKING's essentials: an Approved event assigned to Coordinator One, and a venue Venue Staff look after. */
async function bookingFixture(venueOverrides: Record<string, unknown> = {}) {
  const event = await approvedRequest();
  const venue = await createVenue(venueOverrides);
  return { event, venue };
}

/** A venue's availability calendar for one day, through "Venues" → "View" → "Availability". */
async function openCalendarDay(page: Page, venue: VenueRow, date: string) {
  await openNav(page, "Venues");
  await page.getByRole("row").filter({ hasText: venue.name }).getByRole("link", { name: "View" }).click();
  await page.getByRole("button", { name: "Availability" }).click();
  await expect(page.getByText("Availability. Times are Singapore time.")).toBeVisible();
  await page.getByLabel("From", { exact: true }).fill(date);
  await page.getByLabel("To", { exact: true }).fill(date);
  await page.getByRole("button", { name: "Show" }).click();
}

/**
 * Waits until no CSS animation is running, so axe reads an opened dialog's final colours rather
 * than a frame of its fade-in (which it would report as low contrast).
 */
async function settled(page: Page) {
  await page.waitForFunction(() => document.getAnimations().every((animation) => animation.playState !== "running"));
}

const day = (page: Page, name: string) => page.getByRole("region", { name });
const committed = (dayRegion: Locator) => dayRegion.getByRole("list", { name: "Committed" }).getByRole("listitem");
const free = (dayRegion: Locator) => dayRegion.getByRole("list", { name: "Free" }).getByRole("listitem");

test.describe("L1 submit a venue booking request", () => {
  test("L1-T1 the assigned coordinator requests a venue for an Approved event; it is stored Pending with a booking reference", { tag: ["@L1", "@L1-T1"] }, async ({ page, a11y }) => {
    const { event, venue } = await bookingFixture();
    await signIn(page, "coordinator");
    await openVenueRequests(page, event);
    await a11y("venue requests");

    await page.getByRole("button", { name: "Request a venue" }).click();
    await expect(page.getByRole("heading", { name: "Request a venue" })).toBeVisible();
    await page.getByLabel("Venue", { exact: true }).selectOption({ label: venue.name });
    await page.getByLabel("Room layout").selectOption("Theatre");
    await expect(page.getByLabel("Date")).toHaveValue("2027-03-02");
    await expect(page.getByLabel("Start time")).toHaveValue("14:00");
    await expect(page.getByLabel("End time")).toHaveValue("18:00");
    await expect(page.getByLabel("Expected attendance")).toHaveValue("150");
    await a11y("request a venue");
    await page.getByRole("button", { name: "Submit request" }).click();

    await expect(page.getByText(/^Booking request BKR-\d{6} submitted\.$/)).toBeVisible();
    const { items } = await eventBookings(event.id);
    expect(items).toHaveLength(1);
    const stored = items[0]!;
    await expect(page.getByText(`Booking request ${stored.reference} submitted.`)).toBeVisible();
    const row = page.getByRole("row", { name: stored.reference });
    await expect(page.getByRole("row").filter({ hasText: /BKR-\d{6}/ })).toHaveCount(1);
    await expect(row.getByRole("cell")).toHaveText([stored.reference, venue.name, PERIOD_TEXT, "Theatre", "150", /^Pending/, /.*/]);
    expect(stored.reference).toMatch(/^BKR-\d{6}$/);
    expect(stored.status).toBe("PENDING");
    expect(stored.requestedBy).toBe(COORDINATOR);
    expect(isRecent(stored.requestedAt)).toBe(true);
    await a11y("venue requests after submitting");
  });
});

test.describe("M1 and M2 decide a booking request", () => {
  test("M1-T1 the queue shows a pending request for the approver's venue with every triage detail", { tag: ["@M1", "@M1-T1"] }, async ({ page, a11y }) => {
    const { event, venue } = await bookingFixture();
    const request = await requestBooking(event.id, venue.id);
    await signIn(page, "venuestaff");
    await openNav(page, "Booking requests");

    const row = page.getByRole("row", { name: request.reference });
    await expect(row.getByRole("cell").nth(0)).toHaveText(request.reference);
    await expect(row.getByRole("cell").nth(1)).toContainText(event.reference);
    await expect(row.getByRole("cell").nth(2)).toHaveText(venue.name);
    await expect(row.getByRole("cell").nth(3)).toHaveText(PERIOD_TEXT);
    await expect(row.getByRole("cell").nth(4)).toHaveText("Theatre");
    await expect(row.getByRole("cell").nth(5)).toHaveText("150 attending");
    await expect(row.getByRole("cell").nth(9)).toContainText(ACCOUNTS.coordinator.displayName);
    await expect(row.getByRole("button", { name: "Approve" })).toBeVisible();
    await expect(row.getByRole("button", { name: "Reject" })).toBeVisible();
    await a11y("booking requests queue");
  });

  test("M1-T3 approval sets the request Approved and confirms the booking, recording who approved it and when", { tag: ["@M1", "@M1-T3"] }, async ({ page, a11y }) => {
    const { event, venue } = await bookingFixture();
    const request = await requestBooking(event.id, venue.id);
    await signIn(page, "venuestaff");
    await openNav(page, "Booking requests");

    await page.getByRole("row", { name: request.reference }).getByRole("button", { name: "Approve" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: `Approve ${request.reference}?` })).toBeVisible();
    await expect(dialog).toContainText(`The booking for ${venue.name}, ${PERIOD_TEXT}, will be confirmed`);
    await settled(page);
    await a11y("approve booking dialog");
    await dialog.getByRole("button", { name: "Approve request" }).click();

    await expect(page.getByText(`${request.reference} approved. The booking is confirmed.`)).toBeVisible();
    await expect(page.getByRole("row", { name: request.reference })).toHaveCount(0);

    const { items, bookings } = await eventBookings(event.id);
    const decided = items.find((item) => item.id === request.id)!;
    expect(decided.status).toBe("APPROVED");
    expect(decided.decidedBy).toBe(VENUE_STAFF);
    expect(isRecent(decided.decidedAt)).toBe(true);
    const booking = bookings.find((b) => b.id === decided.bookingId)!;
    expect(booking.status).toBe("CONFIRMED");
    expect(booking.venueId).toBe(venue.id);
    expect(booking.venueName).toBe(venue.name);
    expect(Date.parse(booking.startsAt)).toBe(Date.parse(PERIOD.startsAt));
    expect(Date.parse(booking.endsAt)).toBe(Date.parse(PERIOD.endsAt));
  });

  test("M2-T1 rejection needs a reason with at least one non-whitespace character", { tag: ["@M2", "@M2-T1"] }, async ({ page, a11y }) => {
    const { event, venue } = await bookingFixture();
    const request = await requestBooking(event.id, venue.id);
    await signIn(page, "venuestaff");
    await openNav(page, "Booking requests");
    await page.getByRole("row", { name: request.reference }).getByRole("button", { name: "Reject" }).click();
    const dialog = page.getByRole("dialog");
    const required = dialog.getByText("Enter the reason for rejecting the request.");

    for (const reason of ["", "   "]) {
      await dialog.getByLabel("Reason").fill(reason);
      await dialog.getByRole("button", { name: "Reject request" }).click();
      await expect(required).toBeVisible();
      const stored = (await eventBookings(event.id)).items.find((item) => item.id === request.id)!;
      expect(stored.status).toBe("PENDING");
      expect(stored.decidedAt).toBeNull();
    }
    await settled(page);
    await a11y("reject booking dialog with no reason");

    await dialog.getByLabel("Reason").fill("X");
    await dialog.getByRole("button", { name: "Reject request" }).click();
    await expect(page.getByText(`${request.reference} rejected.`)).toBeVisible();
    const rejected = (await eventBookings(event.id)).items.find((item) => item.id === request.id)!;
    expect(rejected.status).toBe("REJECTED");
    expect(rejected.rejectionReason).toBe("X");
  });

  test("M2-T2 a rejection records the reason, who and when, and the coordinator sees it", { tag: ["@M2", "@M2-T2"] }, async ({ page, a11y }) => {
    const reason = "The auditorium is closed for exams that week";
    const { event, venue } = await bookingFixture();
    const request = await requestBooking(event.id, venue.id);
    await signIn(page, "venuestaff");
    await openNav(page, "Booking requests");
    await page.getByRole("row", { name: request.reference }).getByRole("button", { name: "Reject" }).click();
    await page.getByRole("dialog").getByLabel("Reason").fill(reason);
    await page.getByRole("dialog").getByRole("button", { name: "Reject request" }).click();

    await expect(page.getByText(`${request.reference} rejected.`)).toBeVisible();
    await expect(page.getByRole("row", { name: request.reference })).toHaveCount(0);
    const rejected = (await eventBookings(event.id)).items.find((item) => item.id === request.id)!;
    expect(rejected.status).toBe("REJECTED");
    expect(rejected.rejectionReason).toBe(reason);
    expect(rejected.decidedBy).toBe(VENUE_STAFF);
    expect(isRecent(rejected.decidedAt)).toBe(true);

    await page.getByRole("button", { name: "Sign out" }).click();
    await signIn(page, "coordinator");
    await openVenueRequests(page, event);
    const row = page.getByRole("row", { name: request.reference });
    await expect(row).toContainText("Rejected");
    await expect(row).toContainText(`Reason: ${reason}`);
    await a11y("venue requests with a rejection");
  });
});

test.describe("L3 tentative holds", () => {
  test("L3-T1 the assigned coordinator requests a hold; it is stored Requested and reserves nothing", { tag: ["@L3", "@L3-T1"] }, async ({ page, a11y }) => {
    const { event, venue } = await bookingFixture();
    await signIn(page, "coordinator");
    await openVenueRequests(page, event);
    await page.getByRole("button", { name: "Request a hold" }).click();
    await page.getByLabel("Venue", { exact: true }).selectOption({ label: venue.name });
    await page.getByLabel("Date").fill("2027-03-02");
    await page.getByLabel("Start time").fill("14:00");
    await page.getByLabel("End time").fill("18:00");
    await page.getByLabel("Remind me this many minutes before it expires").fill("1440");
    await a11y("request a hold");
    await page.getByRole("button", { name: "Request hold" }).click();

    await expect(page.getByText(/^Hold HLD-\d{6} requested\.$/)).toBeVisible();
    const hold = (await eventHolds(event.id)).items[0]!;
    await expect(page.getByText(`Hold ${hold.reference} requested.`)).toBeVisible();
    await expect(page.getByRole("table", { name: "Holds" }).getByRole("row", { name: hold.reference }).getByRole("cell")).toHaveText([
      hold.reference,
      venue.name,
      PERIOD_TEXT,
      "Requested",
      "Set when Venue Staff place it",
      "1 day before",
      /.*/,
    ]);
    expect(hold.reference).toMatch(/^HLD-\d{6}$/);

    // A requested hold reserves nothing: the whole opening day is still free.
    await openCalendarDay(page, venue, "2027-03-02");
    const tuesday = day(page, "Tuesday 2 March 2027");
    await expect(free(tuesday)).toHaveText(["08:00–22:00"]);
    await expect(committed(tuesday).filter({ hasText: event.reference })).toHaveCount(0);
    await a11y("availability calendar");

    expect(hold.status).toBe("REQUESTED");
    expect(hold.requestedBy).toBe(COORDINATOR);
    expect(isRecent(hold.requestedAt)).toBe(true);
    expect(hold.reminderLeadMinutes).toBe(1440);
    expect(hold.slotId).toBeNull();
  });

  test("L3-T5 Venue Staff place a requested hold with an expiry; it becomes Held, recording who placed it and when", { tag: ["@L3", "@L3-T5"] }, async ({ page, a11y }) => {
    const { event, venue } = await bookingFixture();
    const requested = await must<HoldRow>("coordinator", "POST", "/api/v1/holds", {
      eventId: event.id,
      venueId: venue.id,
      ...PERIOD,
      reminderLeadMinutes: 1440,
    });
    await signIn(page, "venuestaff");
    await openNav(page, "Hold requests");

    const row = page.getByRole("row", { name: requested.reference }).filter({ has: page.getByRole("button", { name: "Place hold" }) });
    await expect(row.getByRole("cell").nth(1)).toHaveText(event.reference);
    await expect(row.getByRole("cell").nth(2)).toHaveText(venue.name);
    await expect(row.getByRole("cell").nth(3)).toHaveText(PERIOD_TEXT);
    await expect(row.getByRole("cell").nth(4)).toHaveText(ACCOUNTS.coordinator.displayName);
    await expect(row.getByRole("cell").nth(5)).toHaveText("1 day before");
    await a11y("hold requests");

    await row.getByLabel(`Expiry date for ${requested.reference}`).fill("2027-03-01");
    await row.getByLabel(`Expiry time for ${requested.reference}`).fill("18:00");
    await row.getByRole("button", { name: "Place hold" }).click();
    await expect(page.getByText(`${requested.reference} placed. It expires on Monday 1 March 2027, 18:00.`)).toBeVisible();
    await expect(row).toHaveCount(0);

    await page.getByRole("button", { name: "Sign out" }).click();
    await signIn(page, "coordinator");
    await openVenueRequests(page, event);
    const held = page.getByRole("table", { name: "Holds" }).getByRole("row", { name: requested.reference });
    await expect(held.getByRole("cell").nth(3)).toHaveText("Held");
    await expect(held.getByRole("cell").nth(4)).toHaveText("Monday 1 March 2027, 18:00");

    const stored = (await eventHolds(event.id)).items.find((h) => h.id === requested.id)!;
    expect(stored.status).toBe("HELD");
    expect(stored.placedBy).toBe(VENUE_STAFF);
    expect(isRecent(stored.placedAt)).toBe(true);
    expect(stored.slotId).not.toBeNull();

    // The hold's slot: the calendar shows the period Held, labelled with the event.
    await openCalendarDay(page, venue, "2027-03-02");
    await expect(committed(day(page, "Tuesday 2 March 2027")).filter({ hasText: "14:00–18:00" })).toHaveText(`14:00–18:00 Held ${event.reference}`);
  });
});

test.describe("L6 holds expire", () => {
  test("L6-T12 Venue Staff change a hold's expiry on screen, an expired hold shows no actions, and the coordinator's notices name the hold", { tag: ["@L6", "@L6-T12"] }, async ({ page, a11y }) => {
    // Step 5 waits, as the card does, for a real expiry to pass.
    test.setTimeout(180_000);
    const { event, venue } = await bookingFixture();
    // HLD-A as L3-T5 leaves it: Held, expiring the day before at 18:00, its reminder 60 minutes before that.
    const holdA = await placedHold(event.id, venue.id, "2027-03-01T18:00:00+08:00");
    // HLD-B expires shortly, to watch an expiry happen. An event holds a venue once (L3, CR-03) and a period
    // is held once, so HLD-B is the event's hold of its other venue, FX-BOOKING's Seminar Room 2-1.
    const seminar = await createVenue({ name: uniqueName("Seminar Room 2-1"), maxCapacity: 60, layouts: [{ name: "Classroom", capacity: 60 }] });
    const holdB = await placedHold(event.id, seminar.id, new Date(Date.now() + 40_000).toISOString());
    const expiresB = holdB.expiresAt!;
    const named = `${event.reference} “${event.name}”`;

    // Step 1: Venue Staff find HLD-A among the placed holds and change its expiry.
    await signIn(page, "venuestaff");
    await openNav(page, "Hold requests");
    await expect(page.getByRole("heading", { name: "Placed holds" })).toBeVisible();
    const rowA = page.getByRole("row", { name: holdA.reference });
    const expiresCell = rowA.getByRole("cell").nth(6);
    await expect(expiresCell).toHaveText("Monday 1 March 2027, 18:00");
    await rowA.getByRole("button", { name: "Change expiry" }).click();
    const date = page.getByLabel(`New expiry date for ${holdA.reference}`);
    const time = page.getByLabel(`New expiry time for ${holdA.reference}`);
    const save = rowA.getByRole("button", { name: "Save", exact: true });

    // Step 2: an expiry in the past is refused inline, and the old expiry is kept.
    await date.fill("2026-01-05");
    await time.fill("09:00");
    await save.click();
    await expect(rowA.getByRole("alert")).toHaveText("The expiry must be later than now.");
    await expect(expiresCell).toContainText("Monday 1 March 2027, 18:00");
    const kept = (await holdsOf(event.id)).find((h) => h.id === holdA.id)!;
    expect(Date.parse(kept.expiresAt!)).toBe(Date.parse("2027-03-01T18:00:00+08:00"));
    await a11y("placed holds, expiry in the past refused");

    // Step 3: no expiry at all is refused inline.
    await date.fill("");
    await time.fill("");
    await save.click();
    await expect(rowA.getByRole("alert")).toHaveText("Enter the expiry date and time.");

    // Step 4: 1 March 2027 at 20:00 saves, and HLD-A is still Held (only a Held hold offers "Change expiry").
    await date.fill("2027-03-01");
    await time.fill("20:00");
    await save.click();
    await expect(page.getByText(`${holdA.reference} now expires on Monday 1 March 2027, 20:00.`)).toBeVisible();
    await expect(expiresCell).toHaveText("Monday 1 March 2027, 20:00");
    await expect(rowA.getByRole("button", { name: "Change expiry" })).toBeVisible();
    const moved = (await holdsOf(event.id)).find((h) => h.id === holdA.id)!;
    expect(moved.status).toBe("HELD");
    expect(Date.parse(moved.expiresAt!)).toBe(Date.parse("2027-03-01T20:00:00+08:00"));

    // Step 5: once HLD-B's expiry has passed, it expires. CI's stack has no Temporal worker, so the test runs
    // `npm run jobs:expire-holds`'s sweep, the fallback that expires a hold the workflow has not.
    const wait = Date.parse(expiresB) + 2_000 - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    await runHoldExpirySweep();
    const expired = (await holdsOf(event.id)).find((h) => h.id === holdB.id)!;
    expect(expired.status).toBe("EXPIRED");
    const expiredText = `Expired on ${singaporeMoment(expired.expiredAt ?? expired.expiresAt!)}`;
    await page.reload();
    await expect(page.getByRole("heading", { name: "Placed holds" })).toBeVisible();
    const rowB = page.getByRole("row", { name: holdB.reference });
    await expect(rowB.getByRole("cell").nth(6)).toHaveText(expiredText);
    await expect(rowB.getByRole("button")).toHaveCount(0);
    await a11y("placed holds with an expired hold");
    await signOut(page);

    // Step 6: the expiry's message reaches the notification service (the test harness delivers it, as this
    // stack has no Kafka). Nothing reminded anyone of HLD-A: its new expiry is far more than 60 minutes away.
    const deliveries = await deliverOutbox(event.id, {
      types: ["venue-booking.hold-expired", "venue-booking.hold-expiring", "venue-booking.hold-expiry-changed"],
    });
    expect(storedNotices(deliveries, "venue-booking.hold-expired")).toBe(1);
    expect(deliveries.filter((d) => d.type === "venue-booking.hold-expiring")).toEqual([]);
    const [reminded] = await query<{ reminded_at: Date | null }>("select reminded_at from venue.holds where id = $1", [holdA.id]);
    expect(reminded!.reminded_at).toBeNull();

    const notices = await openNotifications(page, "coordinator");
    await expect(messageOf(notices.filter({ hasText: `Hold ${holdB.reference} ` }))).toHaveText([
      `Hold ${holdB.reference} on ${seminar.name} for ${named}, ${PERIOD_TEXT}, expired on ${singaporeMoment(expiresB)}. The period is free for others.`,
    ]);
    await expect(
      notices.filter({ hasText: `Hold ${holdA.reference} ` }).filter({ hasText: "Convert it to a booking request or ask Venue Staff to extend it." }),
    ).toHaveCount(0);
    await a11y("notifications, hold expired");

    await openVenueRequests(page, event);
    const holds = page.getByRole("table", { name: "Holds" });
    const heldB = holds.getByRole("row", { name: holdB.reference });
    await expect(heldB.getByRole("cell").nth(3)).toHaveText("Expired");
    await expect(heldB.getByRole("cell").nth(4)).toHaveText(expiredText);
    await expect(heldB.getByRole("button")).toHaveCount(0);
    const heldA = holds.getByRole("row", { name: holdA.reference });
    await expect(heldA.getByRole("cell").nth(3)).toHaveText("Held");
    await expect(heldA.getByRole("cell").nth(4)).toHaveText("Monday 1 March 2027, 20:00");
  });
});

test.describe("I1 the availability calendar", () => {
  test("I1-T2 I1-T3 I1-T8 confirmed and pending bookings are labelled and told apart, and an approval shows when next loaded", { tag: ["@I1", "@I1-T2", "@I1-T3", "@I1-T8"] }, async ({ page, a11y }) => {
    const venue = await createVenue({ setupMinutes: 15, turnaroundMinutes: 45 });
    const symposium = await approvedRequest({ proposedStartAt: "2027-03-02T02:00:00.000Z", proposedEndAt: "2027-03-02T04:00:00.000Z" });
    const alumni = await approvedRequest({ proposedStartAt: "2027-03-02T06:00:00.000Z", proposedEndAt: "2027-03-02T08:00:00.000Z" });
    const confirmed = await requestBooking(symposium.id, venue.id, { startsAt: "2027-03-02T02:00:00.000Z", endsAt: "2027-03-02T04:00:00.000Z" });
    await approveBooking(confirmed.id);
    const pending = await requestBooking(alumni.id, venue.id, { startsAt: "2027-03-02T06:00:00.000Z", endsAt: "2027-03-02T08:00:00.000Z" });

    await signIn(page, "coordinator");
    await openCalendarDay(page, venue, "2027-03-02");
    const tuesday = day(page, "Tuesday 2 March 2027");
    const symposiumRow = committed(tuesday).filter({ hasText: /^10:00–12:00/ });
    const alumniRow = committed(tuesday).filter({ hasText: /^14:00–16:00/ });
    await expect(symposiumRow).toHaveText(`10:00–12:00 Confirmed ${symposium.reference}`);
    await expect(alumniRow).toHaveText(`14:00–16:00 Pending ${alumni.reference}`);
    const lozengeColour = async (row: Locator, label: string) =>
      row.getByText(label, { exact: true }).evaluate((el) => {
        let node: Element | null = el;
        while (node && getComputedStyle(node).backgroundColor === "rgba(0, 0, 0, 0)") node = node.parentElement;
        return node ? getComputedStyle(node).backgroundColor : "";
      });
    const confirmedColour = await lozengeColour(symposiumRow, "Confirmed");
    const pendingColour = await lozengeColour(alumniRow, "Pending");
    expect(confirmedColour).not.toBe("");
    expect(pendingColour).not.toBe(confirmedColour);
    // No free period overlaps either. The confirmed booking also occupies its setup and turnaround;
    // a pending request occupies only its own period until it is approved.
    await expect(free(tuesday)).toHaveText(["08:00–09:45", "12:45–14:00", "16:00–22:00"]);

    // M1 approves the pending request; the calendar shows it Confirmed when next loaded.
    await approveBooking(pending.id);
    await page.getByRole("button", { name: "Show" }).click();
    await expect(alumniRow).toHaveText(`14:00–16:00 Confirmed ${alumni.reference}`);
    await expect(committed(tuesday).filter({ hasText: /^13:45–14:00/ })).toHaveText(`13:45–14:00 Setup ${alumni.reference} · occupied`);
    await expect(committed(tuesday).filter({ hasText: /^16:00–16:45/ })).toHaveText(`16:00–16:45 Turnaround ${alumni.reference} · occupied`);
    await expect(committed(tuesday).filter({ hasText: "Pending" })).toHaveCount(0);
    await expect(free(tuesday)).toHaveText(["08:00–09:45", "12:45–13:45", "16:45–22:00"]);
    await a11y("availability calendar with bookings");
  });
});

test.describe("I2 record venue unavailability", () => {
  async function openUnavailability(page: Page, venue: VenueRow) {
    await openNav(page, "Venues");
    await page.getByRole("row").filter({ hasText: venue.name }).getByRole("link", { name: "View" }).click();
    await page.getByRole("button", { name: "Unavailability" }).click();
    await expect(page.getByRole("heading", { name: "Unavailability", level: 2 })).toBeVisible();
  }

  async function enterBlock(page: Page, block: { date: string; start: string; end: string; description: string }) {
    const form = page.getByRole("region", { name: "Record unavailability" });
    await form.getByLabel("Start date").fill(block.date);
    await form.getByLabel("Start time").fill(block.start);
    await form.getByLabel("End date").fill(block.date);
    await form.getByLabel("End time").fill(block.end);
    await form.getByLabel("Reason type").selectOption({ label: "Maintenance" });
    await form.getByLabel("Description").fill(block.description);
    await form.getByRole("button", { name: "Review" }).click();
  }

  test("I2-T1 Venue Staff record a period of unavailability, recording who created it and when", { tag: ["@I2", "@I2-T1"] }, async ({ page, a11y }) => {
    const venue = await createVenue();
    await signIn(page, "venuestaff");
    await openUnavailability(page, venue);
    await a11y("venue unavailability");

    await enterBlock(page, { date: "2027-03-09", start: "09:00", end: "13:00", description: "Annual rigging inspection" });
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Record this unavailability?" })).toBeVisible();
    await expect(dialog).toContainText("Nothing is booked, held or requested in this period.");
    await settled(page);
    await a11y("record unavailability dialog");
    await dialog.getByRole("button", { name: "Record unavailability" }).click();

    await expect(page.getByText("Unavailability recorded.", { exact: true })).toBeVisible();
    const row = page.getByRole("row", { name: "Tuesday 9 March 2027, 09:00–13:00 Maintenance Annual rigging inspection" });
    await expect(row.getByRole("cell").nth(0)).toHaveText("Tuesday 9 March 2027, 09:00–13:00");
    await expect(row.getByRole("cell").nth(1)).toHaveText("Maintenance");
    await expect(row.getByRole("cell").nth(2)).toHaveText("Annual rigging inspection");

    const blocks = (await venueBlocks(venue.id)).items;
    expect(blocks).toHaveLength(1);
    const block = blocks[0]!;
    expect(block.status).toBe("ACTIVE");
    expect(block.venueId).toBe(venue.id);
    expect(block.reasonType).toBe("MAINTENANCE");
    expect(block.description).toBe("Annual rigging inspection");
    expect(Date.parse(block.startsAt)).toBe(Date.parse("2027-03-09T01:00:00.000Z"));
    expect(Date.parse(block.endsAt!)).toBe(Date.parse("2027-03-09T05:00:00.000Z"));
    expect(block.createdBy).toBe(VENUE_STAFF);
    expect(isRecent(block.createdAt)).toBe(true);
  });

  test("I2-T4 before confirming, Venue Staff see each confirmed booking a block would disrupt; one it only touches is not listed", { tag: ["@I2", "@I2-T4"] }, async ({ page }) => {
    const { event, venue } = await bookingFixture();
    const request = await requestBooking(event.id, venue.id);
    await approveBooking(request.id);
    const booking = (await eventBookings(event.id)).bookings[0]!;

    await signIn(page, "venuestaff");
    await openUnavailability(page, venue);
    await enterBlock(page, { date: "2027-03-02", start: "16:00", end: "19:00", description: "Stage rigging inspection" });
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("list", { name: "Disrupted" }).getByRole("listitem")).toHaveText([
      `Booking ${booking.reference} for ${event.reference}, Tuesday 2 March 2027, 16:00–18:00`,
    ]);
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toHaveCount(0);

    await page.getByRole("region", { name: "Record unavailability" }).getByLabel("Start time").fill("18:00");
    await page.getByRole("region", { name: "Record unavailability" }).getByRole("button", { name: "Review" }).click();
    await expect(dialog).toContainText("Nothing is booked, held or requested in this period.");
    await dialog.getByRole("button", { name: "Cancel" }).click();

    expect((await venueBlocks(venue.id)).items).toHaveLength(0);
  });

  test("I2-T6 a block over a confirmed booking is created and the booking requires reconfirmation, linked to the block's reason", { tag: ["@I2", "@I2-T6"] }, async ({ page }) => {
    const { event, venue } = await bookingFixture();
    const request = await requestBooking(event.id, venue.id);
    await approveBooking(request.id);

    await signIn(page, "venuestaff");
    await openUnavailability(page, venue);
    await enterBlock(page, { date: "2027-03-02", start: "16:00", end: "19:00", description: "Stage rigging inspection" });
    await page.getByRole("dialog").getByRole("button", { name: "Record unavailability" }).click();
    await expect(page.getByText("Unavailability recorded. 1 booking now requires reconfirmation.")).toBeVisible();

    const booking = (await eventBookings(event.id)).bookings[0]!;
    expect(booking.status).toBe("CONFIRMED");
    expect(booking.requiresReconfirmation).toBe(true);
    expect(booking.disruptions).toEqual([
      expect.objectContaining({ reasonType: "MAINTENANCE", description: "Stage rigging inspection" }),
    ]);
  });
});
