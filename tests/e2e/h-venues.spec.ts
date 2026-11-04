import type { Page } from "@playwright/test";
import { expect, signIn, signOut, test, uniqueName } from "./support/fixtures.js";
import { call } from "./support/api.js";
import { deliverOutbox } from "./support/deliver.js";
import { messageOf, openNotifications } from "./support/notifications.js";
import { approvedRequest, createVenue, type EventRow, type VenueRow } from "./support/seed.js";
import { approveBooking, eventBookings, makeInactive, requestBooking } from "./support/seed-venues.js";
import {
  DAY_TEXT,
  at,
  flaggedList,
  openNav,
  openVenueEditor,
  openVenueRequests,
  recordBlock,
  saveVenueTimes,
  setVenueTimes,
  storedNotices,
} from "./support/seed-venue-notices.js";

/**
 * The venue catalogue (H1, H2), a venue's setup and turnaround time (H3), venue search (J1, J2)
 * and the suitability check's access rule (K1), through the real screens. Each journey creates its
 * own venues, with names no other run has used, and judges only those rows.
 */

const HOURS = [
  ["Monday", "08:00–22:00"],
  ["Tuesday", "08:00–22:00"],
  ["Wednesday", "08:00–22:00"],
  ["Thursday", "08:00–22:00"],
  ["Friday", "08:00–22:00"],
  ["Saturday", "09:00–18:00"],
  ["Sunday", "Closed"],
] as const;

const venueRow = (page: Page, name: string) => page.getByRole("row").filter({ hasText: name });

async function openVenues(page: Page) {
  await page.getByRole("navigation").getByRole("link", { name: "Venues", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Venues", exact: true })).toBeVisible();
}

test.describe("H1 maintain the venue catalogue", () => {
  test("H1-T1 Venue Staff create a venue with every catalogue attribute", { tag: ["@H1", "@H1-T1"] }, async ({ page, a11y }) => {
    const name = uniqueName("Lee Kong Chian Auditorium");
    await signIn(page, "venuestaff");
    await openVenues(page);
    await a11y("venues");

    await page.getByRole("button", { name: "New venue" }).click();
    await expect(page.getByRole("heading", { name: "New venue" })).toBeVisible();
    await a11y("new venue");

    await page.getByLabel("Name", { exact: true }).fill(name);
    await page.getByLabel("Building / location").fill("School of Computing, Level 1");
    await page.getByLabel("Maximum capacity").fill("300");
    await page.getByRole("button", { name: "Add layout" }).click();
    await page.getByRole("button", { name: "Add layout" }).click();
    const layouts = [
      ["Theatre", "300"],
      ["Classroom", "120"],
      ["Banquet", "180"],
    ] as const;
    for (const [index, [layout, capacity]] of layouts.entries()) {
      await page.getByLabel(`Layout ${index + 1}`, { exact: true }).fill(layout);
      await page.getByLabel(`Layout ${index + 1} capacity`, { exact: true }).fill(capacity);
    }
    await page.getByLabel("Facilities (one per line)").fill("Projector\nWireless microphones\nStage lighting");
    await page.getByLabel("Accessibility features (one per line)").fill("Step-free access\nHearing loop\nAccessible toilet");
    await page.getByLabel("Saturday opens").fill("09:00");
    await page.getByLabel("Saturday closes").fill("18:00");
    await page.getByLabel("Sunday closed").check({ force: true });
    await page.getByRole("button", { name: "Save venue" }).click();

    await expect(page.getByText("Venue saved.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Edit venue" })).toBeVisible();
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue(name);
    await expect(page.getByLabel("Building / location")).toHaveValue("School of Computing, Level 1");
    await expect(page.getByLabel("Maximum capacity")).toHaveValue("300");
    for (const [index, [layout, capacity]] of layouts.entries()) {
      await expect(page.getByLabel(`Layout ${index + 1}`, { exact: true })).toHaveValue(layout);
      await expect(page.getByLabel(`Layout ${index + 1} capacity`, { exact: true })).toHaveValue(capacity);
    }
    await expect(page.getByLabel("Facilities (one per line)")).toHaveValue("Projector\nWireless microphones\nStage lighting");
    await expect(page.getByLabel("Accessibility features (one per line)")).toHaveValue("Step-free access\nHearing loop\nAccessible toilet");
    for (const day of ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]) {
      await expect(page.getByLabel(`${day} opens`)).toHaveValue("08:00");
      await expect(page.getByLabel(`${day} closes`)).toHaveValue("22:00");
      await expect(page.getByLabel(`${day} closed`)).not.toBeChecked();
    }
    await expect(page.getByLabel("Saturday opens")).toHaveValue("09:00");
    await expect(page.getByLabel("Saturday closes")).toHaveValue("18:00");
    await expect(page.getByLabel("Sunday closed")).toBeChecked();
    await a11y("edit venue after saving");

    await openVenues(page);
    await expect(venueRow(page, name)).toHaveCount(1);
    await expect(venueRow(page, name)).toContainText("Active");
  });
});

test.describe("H2 view a venue's details", () => {
  test("H2-T1 an Event Coordinator sees every catalogue attribute of a venue", { tag: ["@H2", "@H2-T1"] }, async ({ page, a11y }) => {
    const venue = await createVenue();
    await signIn(page, "coordinator");
    await openVenues(page);
    await venueRow(page, venue.name).getByRole("link", { name: "View" }).click();

    await expect(page.getByRole("heading", { name: venue.name, level: 2 })).toBeVisible();
    const summary = page.getByRole("region", { name: "Summary" });
    await expect(summary).toContainText("Building / location");
    await expect(summary).toContainText("School of Computing, Level 1");
    await expect(summary).toContainText("Maximum capacity300");
    await expect(summary).toContainText("Active");

    const layouts = page.getByRole("region", { name: "Layouts" });
    for (const [layout, capacity] of [
      ["Theatre", "300"],
      ["Classroom", "120"],
      ["Banquet", "180"],
    ]) {
      await expect(layouts.getByRole("row", { name: `${layout} ${capacity}` })).toBeVisible();
    }
    await expect(page.getByRole("region", { name: "Facilities" }).getByRole("listitem")).toHaveText([
      "Projector",
      "Wireless microphones",
      "Stage lighting",
    ]);
    await expect(page.getByRole("region", { name: "Accessibility features" }).getByRole("listitem")).toHaveText([
      "Step-free access",
      "Hearing loop",
      "Accessible toilet",
    ]);
    const hours = page.getByRole("region", { name: "Operating hours" });
    for (const [day, text] of HOURS) {
      await expect(hours.getByRole("row", { name: `${day} ${text}` })).toBeVisible();
    }
    await a11y("venue detail");
  });
});

/**
 * H3-T11 to H3-T14: a change of a venue's setup or turnaround time flags the bookings and pending
 * requests it makes overlap, and their coordinators are told. The cards' Wednesday 2 December 2026
 * is Tuesday 2 March 2027 here (seed-venue-notices.ts). CI's stack has no Kafka, so each journey
 * hands the change's messages to the notification service with deliverOutbox before a coordinator
 * opens Notifications.
 */
const FLAGGED = "venue-booking.buffer-conflict-flagged";
const named = (event: EventRow) => `${event.reference} “${event.name}”`;

/** What the notification service tells a coordinator whose booking or request the venue's new times made overlap. */
function flaggedNotice(venue: VenueRow, times: { setup: number; turnaround: number }, thing: "booking" | "booking request", reference: string, event: EventRow, overlaps: string) {
  return (
    `${venue.name} now needs ${times.setup} minutes of setup and ${times.turnaround} minutes of turnaround, so ${thing} ${reference} ` +
    `for ${named(event)} now overlaps ${overlaps}. The ${thing === "booking" ? "booking" : "request"} requires reconfirmation. ` +
    "It has not been removed, released or moved."
  );
}

/** How every such notice about the venue starts, to pick them out from the coordinator's others (an approval names the venue too). */
const timesNotice = (venue: VenueRow) => `${venue.name} now needs `;

/** A row of the "Bookings" table on an event's Venue requests screen (its requests table has a row with the same reference). */
const bookingRow = (page: Page, reference: string) => page.getByRole("table", { name: "Bookings" }).getByRole("row", { name: reference });
/** A row of the requests table, for a request the event has no booking for. */
const requestRow = (page: Page, reference: string) => page.getByRole("row", { name: reference });

/**
 * H3-T11's pre-conditions: the standard venue with no setup or turnaround time; FX-BOOKING's event
 * with a confirmed booking 10:00–12:00 (Coordinator One, L1 and M1); and the N1 second event
 * (16:00–20:00), assigned to Coordinator Two, with a pending request for 12:15–14:00.
 */
async function bookingAndPendingRequest() {
  const venue = await createVenue();
  const first = await approvedRequest({ proposedStartAt: at("10:00"), proposedEndAt: at("12:00") });
  await approveBooking((await requestBooking(first.id, venue.id, { startsAt: at("10:00"), endsAt: at("12:00") })).id);
  const second = await approvedRequest(
    { name: uniqueName("Faculty Awards Night"), proposedStartAt: at("16:00"), proposedEndAt: at("20:00") },
    "coordinator2",
  );
  const pending = await requestBooking(second.id, venue.id, { startsAt: at("12:15"), endsAt: at("14:00") }, "coordinator2");
  const booking = (await eventBookings(first.id)).bookings[0]!;
  return { venue, first, second, booking, pending };
}

type BookingAndRequest = Awaited<ReturnType<typeof bookingAndPendingRequest>>;

/** The editor's list once a change of times has flagged the booking and the request, each naming the other. */
async function expectBothFlagged(page: Page, fx: BookingAndRequest) {
  const flagged = flaggedList(page);
  await expect(flagged).toContainText("Venue saved. With the new setup and turnaround time, these now overlap and require reconfirmation:");
  await expect(flagged.getByRole("listitem")).toHaveText([
    `Booking ${fx.booking.reference} (${fx.first.reference}) overlaps ${fx.pending.reference}`,
    `Request ${fx.pending.reference} (${fx.second.reference}) overlaps ${fx.booking.reference}`,
  ]);
  await expect(flagged).toContainText("Their coordinators have been told. Nothing was removed, released or moved.");
}

/** The editor's answer to a save that flagged nothing. */
async function expectNothingFlagged(page: Page) {
  await expect(page.getByText("Venue saved.", { exact: true })).toBeVisible();
  await expect(flaggedList(page)).toHaveCount(0);
}

test.describe("H3 a change of setup or turnaround time flags what now overlaps", () => {
  test("H3-T11 a longer turnaround flags a pending request and the booking it now overlaps, keeps both, and tells both coordinators", { tag: ["@H3", "@H3-T11"] }, async ({ page, a11y }) => {
    test.setTimeout(150_000);
    const fx = await bookingAndPendingRequest();

    // Step 1: Venue Staff set the turnaround time to 30 minutes.
    await signIn(page, "venuestaff");
    await openVenueEditor(page, fx.venue);
    await expect(page.getByLabel("Turnaround time (minutes)")).toHaveValue("0");
    await saveVenueTimes(page, fx.venue, { turnaround: 30 });
    await expectBothFlagged(page, fx);
    await a11y("venue editor, bookings now overlapping");
    await signOut(page);

    // The change's messages reach the notification service: one notice for each coordinator.
    for (const event of [fx.first, fx.second]) {
      expect(storedNotices(await deliverOutbox(event.id, { types: [FLAGGED] }), FLAGGED)).toBe(1);
    }

    // Step 2: the request is still Pending, still 12:15–14:00, flagged, naming the booking.
    await signIn(page, "coordinator2");
    await openVenueRequests(page, fx.second);
    const request = requestRow(page, fx.pending.reference);
    await expect(request.getByRole("cell").nth(2)).toHaveText(`${DAY_TEXT}, 12:15–14:00`);
    const requestStatus = request.getByRole("cell").nth(5);
    await expect(requestStatus).toContainText("Pending");
    await expect(requestStatus).toContainText("Requires reconfirmation");
    await expect(requestStatus).toContainText(`Overlaps ${fx.booking.reference} with the venue's new setup and turnaround time`);
    await a11y("venue requests, request flagged by the venue's times");

    // Step 3: its coordinator is told, as a request.
    const theirs = await openNotifications(page);
    await expect(messageOf(theirs.filter({ hasText: timesNotice(fx.venue) }))).toHaveText([
      flaggedNotice(fx.venue, { setup: 0, turnaround: 30 }, "booking request", fx.pending.reference, fx.second, fx.booking.reference),
    ]);
    await a11y("notifications, request flagged by the venue's times");
    await signOut(page);

    // Step 4: the booking is still Confirmed, still 10:00–12:00, flagged, naming the request; its coordinator is told the same way.
    await signIn(page, "coordinator");
    await openVenueRequests(page, fx.first);
    const booking = bookingRow(page, fx.booking.reference);
    await expect(booking.getByRole("cell").nth(2)).toHaveText(`${DAY_TEXT}, 10:00–12:00`);
    const bookingStatus = booking.getByRole("cell").nth(3);
    await expect(bookingStatus).toContainText("Confirmed");
    await expect(bookingStatus).toContainText("Requires reconfirmation");
    await expect(bookingStatus).toContainText(`Overlaps ${fx.pending.reference} with the venue's new setup and turnaround time`);
    const mine = await openNotifications(page);
    await expect(messageOf(mine.filter({ hasText: timesNotice(fx.venue) }))).toHaveText([
      flaggedNotice(fx.venue, { setup: 0, turnaround: 30 }, "booking", fx.booking.reference, fx.first, fx.pending.reference),
    ]);

    // Nothing was removed, released or moved: what the screens showed is what is stored.
    const asked = (await eventBookings(fx.second.id, "coordinator2")).items;
    expect(asked).toEqual([expect.objectContaining({ id: fx.pending.id, status: "PENDING", requiresReconfirmation: true })]);
    expect([Date.parse(asked[0]!.startsAt), Date.parse(asked[0]!.endsAt)]).toEqual([Date.parse(at("12:15")), Date.parse(at("14:00"))]);
    const booked = (await eventBookings(fx.first.id)).bookings;
    expect(booked).toEqual([expect.objectContaining({ id: fx.booking.id, status: "CONFIRMED", requiresReconfirmation: true })]);
    expect([Date.parse(booked[0]!.startsAt), Date.parse(booked[0]!.endsAt)]).toEqual([Date.parse(at("10:00")), Date.parse(at("12:00"))]);
  });

  test("H3-T12 requests that already clashed are not flagged by a change of setup time, and nobody is told", { tag: ["@H3", "@H3-T12"] }, async ({ page, a11y }) => {
    test.setTimeout(150_000);
    // FX-BOOKING's event and the N1 second event each have a pending request for 10:00–12:00, which clash (N2).
    const venue = await createVenue();
    const first = await approvedRequest({ proposedStartAt: at("10:00"), proposedEndAt: at("12:00") });
    const second = await approvedRequest(
      { name: uniqueName("Faculty Awards Night"), proposedStartAt: at("16:00"), proposedEndAt: at("20:00") },
      "coordinator2",
    );
    const firstRequest = await requestBooking(first.id, venue.id, { startsAt: at("10:00"), endsAt: at("12:00") });
    const secondRequest = await requestBooking(second.id, venue.id, { startsAt: at("10:00"), endsAt: at("12:00") }, "coordinator2");
    // What the set-up wrote reaches the notification service first, so that anything stored later is the change's.
    for (const event of [first, second]) await deliverOutbox(event.id);
    const pairs = [
      [firstRequest, secondRequest],
      [secondRequest, firstRequest],
    ] as const;

    await signIn(page, "venuestaff");
    await openNav(page, "Booking requests");
    for (const [mine, other] of pairs) {
      await expect(requestRow(page, mine.reference)).toContainText(`Conflicts with ${other.reference} (pending request), ${DAY_TEXT}, 10:00–12:00`);
    }

    // Step 1: setup time 15 minutes. Their periods already overlapped, so the change makes no new overlap.
    await openVenueEditor(page, venue);
    await saveVenueTimes(page, venue, { setup: 15 });
    await expectNothingFlagged(page);

    // Step 2: both are still Pending and still in Conflict, naming each other, and neither requires reconfirmation.
    await openNav(page, "Booking requests");
    for (const [mine, other] of pairs) {
      const row = requestRow(page, mine.reference);
      await expect(row).toContainText("Conflict");
      await expect(row).toContainText(`Conflicts with ${other.reference} (pending request), ${DAY_TEXT}, 10:00–12:00`);
      await expect(row).not.toContainText("Requires reconfirmation");
    }
    await a11y("booking requests, clashing requests after a change of times");
    for (const [event, as] of [[first, "coordinator"], [second, "coordinator2"]] as const) {
      expect((await eventBookings(event.id, as)).items).toEqual([
        expect.objectContaining({ status: "PENDING", requiresReconfirmation: false, overlaps: [] }),
      ]);
    }
    await signOut(page);

    // Step 3: the change wrote nothing for anyone, so neither coordinator has a new notification.
    for (const event of [first, second]) {
      const deliveries = await deliverOutbox(event.id);
      expect(deliveries.filter((d) => d.type === FLAGGED)).toEqual([]);
      expect(storedNotices(deliveries)).toBe(0);
    }
    for (const coordinator of ["coordinator", "coordinator2"] as const) {
      const notices = await openNotifications(page, coordinator);
      await expect(notices.filter({ hasText: venue.name })).toHaveCount(0);
      await signOut(page);
    }
  });

  test("H3-T13 times that only touch clear the request's flag without a notice, and one minute more flags both again", { tag: ["@H3", "@H3-T13"] }, async ({ page, a11y }) => {
    test.setTimeout(180_000);
    // H3-T11 completed: turnaround 30 flagged the booking and the request, and both coordinators were told.
    const fx = await bookingAndPendingRequest();
    expect((await setVenueTimes(fx.venue, 0, 30)).flaggedBookings.map((f) => f.reference)).toEqual([fx.booking.reference, fx.pending.reference]);
    for (const event of [fx.first, fx.second]) expect(storedNotices(await deliverOutbox(event.id), FLAGGED)).toBe(1);
    const at30 = {
      request: flaggedNotice(fx.venue, { setup: 0, turnaround: 30 }, "booking request", fx.pending.reference, fx.second, fx.booking.reference),
      booking: flaggedNotice(fx.venue, { setup: 0, turnaround: 30 }, "booking", fx.booking.reference, fx.first, fx.pending.reference),
    };

    // Step 1: turnaround 15. The booking is then occupied until 12:15, exactly when the request starts.
    await signIn(page, "venuestaff");
    await openVenueEditor(page, fx.venue);
    await expect(page.getByLabel("Turnaround time (minutes)")).toHaveValue("30");
    await saveVenueTimes(page, fx.venue, { turnaround: 15 });
    await expectNothingFlagged(page);
    await signOut(page);
    // No new notification: the change wrote nothing for the notification service to store.
    for (const event of [fx.first, fx.second]) expect(storedNotices(await deliverOutbox(event.id))).toBe(0);

    // Step 2: the request is still Pending at 12:15–14:00, no longer flagged; its coordinator has only H3-T11's notice.
    await signIn(page, "coordinator2");
    await openVenueRequests(page, fx.second);
    const request = requestRow(page, fx.pending.reference);
    await expect(request.getByRole("cell").nth(2)).toHaveText(`${DAY_TEXT}, 12:15–14:00`);
    await expect(request.getByRole("cell").nth(5)).toContainText("Pending");
    await expect(request).not.toContainText("Requires reconfirmation");
    await expect(request).not.toContainText("Overlaps");
    let notices = await openNotifications(page);
    await expect(messageOf(notices.filter({ hasText: timesNotice(fx.venue) }))).toHaveText([at30.request]);
    await signOut(page);
    // The booking no longer shows either.
    await signIn(page, "coordinator");
    await openVenueRequests(page, fx.first);
    const booking = bookingRow(page, fx.booking.reference);
    await expect(booking.getByRole("cell").nth(3)).toContainText("Confirmed");
    await expect(booking).not.toContainText("Requires reconfirmation");
    await expect(booking).not.toContainText("Overlaps");
    await signOut(page);

    // Step 3: turnaround 16, one minute over: both are flagged again, each naming the other.
    await signIn(page, "venuestaff");
    await openVenueEditor(page, fx.venue);
    await saveVenueTimes(page, fx.venue, { turnaround: 16 });
    await expectBothFlagged(page, fx);
    await signOut(page);
    for (const event of [fx.first, fx.second]) {
      expect(storedNotices(await deliverOutbox(event.id, { types: [FLAGGED] }), FLAGGED)).toBe(1);
    }

    // Each coordinator receives a new notification, above H3-T11's.
    await signIn(page, "coordinator2");
    await openVenueRequests(page, fx.second);
    await expect(request.getByRole("cell").nth(5)).toContainText("Requires reconfirmation");
    await expect(request.getByRole("cell").nth(5)).toContainText(`Overlaps ${fx.booking.reference} with the venue's new setup and turnaround time`);
    notices = await openNotifications(page);
    await expect(messageOf(notices.filter({ hasText: timesNotice(fx.venue) }))).toHaveText([
      flaggedNotice(fx.venue, { setup: 0, turnaround: 16 }, "booking request", fx.pending.reference, fx.second, fx.booking.reference),
      at30.request,
    ]);
    await a11y("notifications, request flagged again");
    await signOut(page);
    await signIn(page, "coordinator");
    await openVenueRequests(page, fx.first);
    await expect(booking.getByRole("cell").nth(3)).toContainText("Requires reconfirmation");
    await expect(booking.getByRole("cell").nth(3)).toContainText(`Overlaps ${fx.pending.reference} with the venue's new setup and turnaround time`);
    notices = await openNotifications(page);
    await expect(messageOf(notices.filter({ hasText: timesNotice(fx.venue) }))).toHaveText([
      flaggedNotice(fx.venue, { setup: 0, turnaround: 16 }, "booking", fx.booking.reference, fx.first, fx.pending.reference),
      at30.booking,
    ]);
  });

  test("H3-T14 removing a block keeps the flag the venue's times still cause, and tells the coordinator why", { tag: ["@H3", "@H3-T14"] }, async ({ page, a11y }) => {
    test.setTimeout(150_000);
    // Two confirmed bookings, 10:00–12:00 (Coordinator One) and 12:15–14:00 (Coordinator Two).
    const venue = await createVenue();
    const first = await approvedRequest({ proposedStartAt: at("10:00"), proposedEndAt: at("12:00") });
    const second = await approvedRequest(
      { name: uniqueName("Faculty Awards Night"), proposedStartAt: at("12:15"), proposedEndAt: at("14:00") },
      "coordinator2",
    );
    await approveBooking((await requestBooking(first.id, venue.id, { startsAt: at("10:00"), endsAt: at("12:00") })).id);
    await approveBooking((await requestBooking(second.id, venue.id, { startsAt: at("12:15"), endsAt: at("14:00") }, "coordinator2")).id);
    const morning = (await eventBookings(first.id)).bookings[0]!;
    const midday = (await eventBookings(second.id, "coordinator2")).bookings[0]!;
    // I2: a block over 10:30–11:00 flags the 10:00 booking. H3-T10: turnaround 30 then flags both.
    await recordBlock(venue.id, at("10:30"), at("11:00"), "Projector replacement");
    expect((await setVenueTimes(venue, 0, 30)).flaggedBookings.map((f) => f.reference)).toEqual([morning.reference, midday.reference]);
    expect((await eventBookings(first.id)).bookings[0]).toMatchObject({ requiresReconfirmation: true, overlaps: [midday.reference] });

    // Step 1: Venue Staff remove the block.
    await signIn(page, "venuestaff");
    await openNav(page, "Venues");
    await page.getByRole("row").filter({ hasText: venue.name }).getByRole("link", { name: "View" }).click();
    await page.getByRole("button", { name: "Unavailability" }).click();
    await expect(page.getByRole("heading", { name: "Unavailability", level: 2 })).toBeVisible();
    await page.getByRole("row", { name: `${DAY_TEXT}, 10:30–11:00 Maintenance Projector replacement` }).getByRole("button", { name: "Remove" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Remove this unavailability?" })).toBeVisible();
    await dialog.getByRole("button", { name: "Remove unavailability" }).click();
    await expect(page.getByText("Unavailability removed.", { exact: true })).toBeVisible();
    await signOut(page);
    const deliveries = await deliverOutbox(first.id, { types: ["venue-booking.disruption-cleared"] });
    expect(storedNotices(deliveries, "venue-booking.disruption-cleared")).toBe(1);

    // Step 2: the 10:00 booking's coordinator is told the flag stays because of the venue's times, not other unavailability.
    const notices = await openNotifications(page, "coordinator");
    const cleared = notices.filter({ hasText: venue.name }).filter({ hasText: "was removed" });
    await expect(messageOf(cleared)).toHaveText([
      `The unavailability of ${venue.name} on ${DAY_TEXT}, 10:30–11:00 (Maintenance: Projector replacement) was removed. ` +
        `Booking ${morning.reference} for ${named(first)} still requires reconfirmation: ` +
        "with the venue's setup and turnaround time it still overlaps another booking, hold or request.",
    ]);
    await expect(cleared).not.toContainText("other unavailability still overlaps it");
    await a11y("notifications, block removed and the flag kept");
    await openVenueRequests(page, first);
    const status = bookingRow(page, morning.reference).getByRole("cell").nth(3);
    await expect(status).toContainText("Requires reconfirmation");
    await expect(status).toContainText(`Overlaps ${midday.reference} with the venue's new setup and turnaround time`);
    // The block itself no longer disrupts it.
    await expect(status).not.toContainText("Unavailable:");
  });
});

/**
 * J1 and J2 run against their own copy of FX-SEARCH's venues (tests/J1/README.md): the same
 * attributes, with a suffix on each name and building so a run judges only its own rows.
 */
async function fxSearchVenues() {
  const suffix = uniqueName("").trim();
  const science = `FX Science Block ${suffix}`;
  const arts = `FX Arts Building ${suffix}`;
  const weekday = { opensAt: "08:00", closesAt: "22:00" };
  const hours = {
    monday: weekday,
    tuesday: weekday,
    wednesday: weekday,
    thursday: weekday,
    friday: weekday,
    saturday: { opensAt: "09:00", closesAt: "18:00" },
    sunday: null,
  };
  const make = (name: string, overrides: Record<string, unknown>) =>
    createVenue({ name: `${name} ${suffix}`, operatingHours: hours, ...overrides });
  const auditorium = await make("FX Auditorium", {
    building: science,
    maxCapacity: 300,
    layouts: [
      { name: "Theatre", capacity: 300 },
      { name: "Classroom", capacity: 120 },
    ],
    facilities: ["Projector", "Wireless microphones"],
    accessibilityFeatures: ["Step-free access", "Hearing loop"],
  });
  const seminar = await make("FX Seminar Room", {
    building: science,
    maxCapacity: 60,
    layouts: [
      { name: "Classroom", capacity: 40 },
      { name: "Boardroom", capacity: 20 },
    ],
    facilities: ["Projector"],
    accessibilityFeatures: ["Step-free access"],
  });
  const lectureHall = await make("FX Lecture Hall", {
    building: arts,
    maxCapacity: 200,
    layouts: [
      { name: "Theatre", capacity: 200 },
      { name: "Classroom", capacity: 80 },
    ],
    facilities: ["Projector", "Wireless microphones", "Stage lighting"],
    accessibilityFeatures: ["Step-free access", "Hearing loop", "Accessible toilet"],
  });
  const lateStudio = await make("FX Late Studio", {
    building: arts,
    maxCapacity: 40,
    layouts: [{ name: "Classroom", capacity: 40 }],
    facilities: ["Projector"],
    accessibilityFeatures: ["Step-free access"],
  });
  const oldGymBody = {
    building: arts,
    maxCapacity: 500,
    layouts: [{ name: "Theatre", capacity: 500 }],
    facilities: ["Projector", "Wireless microphones", "Stage lighting"],
    accessibilityFeatures: ["Step-free access", "Hearing loop", "Accessible toilet"],
    operatingHours: hours,
  };
  const oldGym = await make("FX Old Gym", oldGymBody);
  await makeInactive(oldGym, oldGymBody);
  return { suffix, science, arts, active: [auditorium, seminar, lectureHall, lateStudio] as VenueRow[], oldGym };
}

async function openSearch(page: Page) {
  await page.getByRole("navigation").getByRole("link", { name: "Find a venue" }).click();
  await expect(page.getByRole("heading", { name: "Find a venue" })).toBeVisible();
}

const results = (page: Page) => page.getByRole("region", { name: "Results" });

test.describe("J1 and J2 find a venue", () => {
  test("J1-T1 the search offers every filter, and with none chosen lists the active venues", { tag: ["@J1", "@J1-T1"] }, async ({ page, a11y }) => {
    const fx = await fxSearchVenues();
    await signIn(page, "coordinator");
    await openSearch(page);

    const form = page.getByRole("form", { name: "Venue search" });
    for (const label of ["Search by name or building", "Building / location", "Minimum capacity", "Layout", "From", "To"]) {
      await expect(form.getByLabel(label, { exact: true })).toBeVisible();
    }
    await expect(form.getByRole("group", { name: "Facilities" })).toBeVisible();
    await expect(form.getByRole("group", { name: "Accessibility features" })).toBeVisible();
    await a11y("find a venue");

    await page.getByRole("button", { name: "Search", exact: true }).click();
    for (const venue of fx.active) {
      await expect(results(page).getByRole("link", { name: venue.name, exact: true })).toHaveCount(1);
    }
    await expect(results(page).getByRole("link", { name: fx.oldGym.name })).toHaveCount(0);
    await a11y("search results");
  });

  test("J1-T20 when nothing matches, the list is empty and a message restates every filter", { tag: ["@J1", "@J1-T20"] }, async ({ page, a11y }) => {
    const fx = await fxSearchVenues();
    await signIn(page, "coordinator");
    await openSearch(page);

    await page.getByLabel("Building / location").fill(fx.science);
    await page.getByLabel("Minimum capacity").fill("500");
    await page.getByLabel("Layout", { exact: true }).selectOption("Theatre");
    await page.getByRole("group", { name: "Facilities" }).getByLabel("Projector").check({ force: true });
    await page.getByLabel("From", { exact: true }).fill("2027-03-08T12:00");
    await page.getByLabel("To", { exact: true }).fill("2027-03-08T14:00");
    await page.getByRole("button", { name: "Search", exact: true }).click();

    await expect(results(page).getByText("No venues match")).toBeVisible();
    await expect(results(page)).toContainText(
      `No active venue matches all of these filters: available from 2027-03-08 12:00 to 2027-03-08 14:00 (Singapore time); minimum capacity 500 (Theatre layout); building or location containing "${fx.science}"; layout Theatre; facilities Projector.`,
    );
    await expect(results(page).getByRole("table")).toHaveCount(0);
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(page.getByText("The venues could not be searched")).toHaveCount(0);
    await expect(results(page)).not.toContainText("VALIDATION");
    await a11y("search with no match");

    await page.getByLabel("Minimum capacity").fill("300");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(results(page).getByRole("link", { name: fx.active[0]!.name, exact: true })).toBeVisible();
    await expect(results(page).getByText("No venues match")).toHaveCount(0);
  });

  test("J2-T8 a search that matches nothing gives an empty list and a message naming the search", { tag: ["@J2", "@J2-T8"] }, async ({ page, a11y }) => {
    await signIn(page, "coordinator");
    await openSearch(page);
    await page.getByLabel("Search by name or building").fill("zzzz-no-such-venue");
    await page.getByRole("button", { name: "Search", exact: true }).click();

    await expect(results(page).getByText("No venues match")).toBeVisible();
    await expect(results(page)).toContainText('No active venue matches all of these filters: name or building containing "zzzz-no-such-venue".');
    await expect(results(page).getByRole("table")).toHaveCount(0);
    await expect(page.getByText("The venues could not be searched")).toHaveCount(0);
    await a11y("search by name with no match");
  });

  test("J2-T3 a search never returns an inactive venue", { tag: ["@J2", "@J2-T3"] }, async ({ page }) => {
    const fx = await fxSearchVenues();
    await signIn(page, "coordinator");
    await openSearch(page);
    await page.getByLabel("Search by name or building").fill("old gym");
    await page.getByRole("button", { name: "Search", exact: true }).click();

    await expect(results(page).getByText("No venues match")).toBeVisible();
    await expect(results(page)).toContainText('name or building containing "old gym"');
    await expect(results(page).getByRole("link", { name: fx.oldGym.name })).toHaveCount(0);
  });
});

test.describe("K1 check a venue's suitability", () => {
  test("K1-T12 roles other than Event Coordinator cannot check suitability", { tag: ["@K1", "@K1-T12"] }, async ({ page, a11y }) => {
    const venue = await createVenue({ name: uniqueName("K1 Test Hall") });
    const event = await approvedRequest({ name: uniqueName("K1-E-FIT") });
    const path = `/venue/api/v1/venues/${venue.id}/suitability?eventId=${event.id}`;

    for (const role of ["organiser", "venuestaff", "techsupport"] as const) {
      await signIn(page, role);
      await openVenues(page);
      await venueRow(page, venue.name).getByRole("link", { name: "View" }).click();
      await expect(page.getByRole("heading", { name: venue.name, level: 2 })).toBeVisible();
      await expect(page.getByRole("button", { name: "Check suitability" })).toHaveCount(0);
      await page.goto(`/#/venues/${venue.id}/suitability`);
      await expect(page.getByText("Suitability for an event")).toHaveCount(0);
      await expect(page.getByLabel("Event", { exact: true })).toHaveCount(0);
      await consoleRefuses(page, path);
      await a11y(`direct API console refusal (${role})`);
      await page.getByRole("button", { name: "Sign out" }).click();
    }

    // Attendees have no venue screens at all, so only the API is left to them.
    await signIn(page, "attendee");
    await expect(page.getByRole("navigation").getByRole("link", { name: "Venues" })).toHaveCount(0);
    await consoleRefuses(page, path);

    // Nothing was assessed for anyone: the same call as the coordinator does answer.
    const allowed = await call("coordinator", "GET", path.replace("/venue", ""));
    expect(allowed.status).toBe(200);
  });
});

/** Sends GET <path> from the API console and checks it is refused as not authorised, with no assessment. */
async function consoleRefuses(page: Page, path: string) {
  await page.goto("/#/console");
  await expect(page.getByRole("heading", { name: "Direct API console" })).toBeVisible();
  await page.getByLabel("Method").fill("GET");
  await page.getByLabel("Path").fill(path);
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByRole("heading", { name: /^403/ })).toBeVisible();
  const body = page.locator("pre");
  await expect(body).toContainText('"code": "ROLE_NOT_AUTHORISED"');
  await expect(body).toContainText("Your role is not authorised to use this function.");
  await expect(body).not.toContainText('"status"');
  await expect(body).not.toContainText('"reasons"');
}
