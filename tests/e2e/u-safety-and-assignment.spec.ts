import type { Page } from "@playwright/test";
import { ACCOUNTS, type AccountKey } from "./support/accounts.js";
import { call } from "./support/api.js";
import { deliverOutbox } from "./support/deliver.js";
import { expect, signIn, signOut, test, uniqueName } from "./support/fixtures.js";
import { messageOf, openNotifications } from "./support/notifications.js";
import { approvedRequest, assign, createVenue, submitRequest } from "./support/seed.js";
import { query, rowWith } from "./support/seed-events.js";
import { requestChange } from "./support/seed-arrangements.js";
import { arrangedEvent, safetyReviewEvent } from "./support/seed-lifecycle.js";
import { ensureAttendeeTwo, joinWaitlistThroughApi, waitlistOf } from "./support/seed-management.js";
import {
  ATTENDEE_ID,
  ensureIdentityBudget,
  listPlannedEvent,
  registerThroughApi,
  registrationOutboxOf,
  registrationsOf,
  seatStatusesOf,
  takeSeats,
} from "./support/seed-registration.js";
import { PERIOD_TEXT, approveBooking, requestBooking } from "./support/seed-venues.js";

/**
 * A4 (a coordinator sees only their own events; the Lead assigns and reassigns), U1 (the Safety
 * Officer's queue, review and decision, and Mark Confirmed) and the status-history rows F1 asks
 * for when the arrangements are confirmed and when the Safety Officer asks for changes, through
 * the real screens.
 */

const statusPanel = (page: Page) => page.locator("aside").filter({ has: page.getByRole("heading", { name: "Status" }) });

async function openFromAllEvents(page: Page, name: string) {
  await page.getByRole("link", { name: "All events" }).click();
  await rowWith(page, name).getByRole("link", { name: "Open" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
}

/** The Safety Officer opens an event's review from the queue. */
async function openReview(page: Page, reference: string, name: string) {
  await page.getByRole("link", { name: "Safety queue", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Safety queue" })).toBeVisible();
  await page.getByRole("table", { name: "Events in Safety Review" }).getByRole("link", { name: reference }).click();
  await expect(page.getByRole("heading", { name: `${reference} · ${name}` })).toBeVisible();
}

interface HistoryRow extends Record<string, unknown> {
  previous_status: string;
  new_status: string;
  actor_user_id: string;
  actor_role: string;
  triggering_action: string;
  occurred_at: Date | null;
}

/** The newest status change in the event's history (the cards' "Query 2"). */
async function latestStatusChange(eventId: string) {
  const rows = await query<HistoryRow>(
    `select previous_status, new_status, actor_user_id::text as actor_user_id, actor_role, triggering_action, occurred_at
       from event.event_history
      where event_id = $1 and entry_type = 'STATUS_CHANGE'
      order by occurred_at desc limit 1`,
    [eventId],
  );
  return rows[0];
}

async function statusOf(eventId: string) {
  const rows = await query<{ status: string }>("select status from event.events where id = $1", [eventId]);
  return rows[0]?.status;
}

test.describe("A4 coordinators see only their own events", () => {
  test("A4-T14 signed in, each coordinator sees only their own events, an old link shows not found, and the Lead sees the assignments", { tag: ["@A4", "@A4-T14"] }, async ({ page, a11y }) => {
    // Pre-conditions: three submitted requests; One to Coordinator One, Two to Coordinator Two, Three unassigned.
    const one = await submitRequest({ name: uniqueName("A4 One") });
    const two = await submitRequest({ name: uniqueName("A4 Two") });
    const three = await submitRequest({ name: uniqueName("A4 Three") });
    await assign(one.id, "coordinator");
    await assign(two.id, "coordinator2");

    // Step 1: Coordinator One's "All events" and "Review queue" show A4 One only.
    await signIn(page, "coordinator");
    await page.getByRole("link", { name: "All events" }).click();
    await expect(page.getByRole("heading", { name: "All events" })).toBeVisible();
    await expect(rowWith(page, one.name)).toBeVisible();
    await expect(page.getByText(two.name)).toHaveCount(0);
    await expect(page.getByText(three.name)).toHaveCount(0);
    await a11y("coordinator all events");
    await page.getByRole("link", { name: "Review queue" }).click();
    await expect(page.getByRole("heading", { name: "Review queue" })).toBeVisible();
    await expect(rowWith(page, one.name)).toBeVisible();
    await expect(page.getByText(two.name)).toHaveCount(0);
    await expect(page.getByText(three.name)).toHaveCount(0);

    // Step 2: the old link to A4 Two shows "not found" and none of its detail.
    await page.goto(`/#/review/${two.id}`);
    await expect(page.getByText("No event with that reference is assigned to you.")).toBeVisible();
    await expect(page.getByText(two.name)).toHaveCount(0);
    await expect(page.getByText(two.reference)).toHaveCount(0);
    await expect(page.getByText("Status history")).toHaveCount(0);

    // Step 3: the Lead's navigation offers the Lead's functions only.
    await signOut(page);
    await signIn(page, "lead");
    const nav = page.getByRole("navigation", { name: "Primary" });
    await expect(nav.getByRole("link")).toHaveText([/^Unassigned$/, /^Assignments$/, /^Notifications/, /^API console$/]);
    for (const absent of [
      "Review queue",
      "All events",
      "My requests",
      "New request",
      "Booking requests",
      "Hold requests",
      "Venues",
      "Find a venue",
      "Equipment",
      "Equipment availability",
      "Equipment requests",
    ]) {
      await expect(nav.getByRole("link", { name: absent, exact: true })).toHaveCount(0);
    }
    await nav.getByRole("link", { name: "Unassigned", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Unassigned requests" })).toBeVisible();
    await expect(rowWith(page, three.name)).toBeVisible();
    await a11y("unassigned requests");
    await nav.getByRole("link", { name: "Assignments", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Assignments", exact: true })).toBeVisible();
    await expect(rowWith(page, one.name)).toContainText("Coordinator One");
    await expect(rowWith(page, two.name)).toContainText("Coordinator Two");
    await a11y("assignments overview");

    // Step 4: reassign A4 One to Coordinator Two.
    await rowWith(page, one.name).getByRole("link", { name: one.reference }).click();
    await expect(page.getByRole("heading", { name: one.name })).toBeVisible();
    await page.getByLabel("New coordinator").selectOption(ACCOUNTS.coordinator2.id);
    await page.getByRole("button", { name: "Reassign" }).click();
    await expect(page.getByText("Reassigned to Coordinator Two. They are now the event's coordinator.")).toBeVisible();

    // Coordinator One, signed in again, sees none of the three events on either screen.
    await signOut(page);
    await signIn(page, "coordinator");
    for (const screen of ["All events", "Review queue"]) {
      await page.getByRole("link", { name: screen }).click();
      await expect(page.getByRole("heading", { name: screen })).toBeVisible();
      await page.reload();
      await expect(page.getByRole("heading", { name: screen })).toBeVisible();
      // The list is read from the server after the page loads: wait for that, or "none" would pass too early.
      await page.waitForLoadState("networkidle");
      for (const event of [one, two, three]) await expect(page.getByText(event.name)).toHaveCount(0);
    }
  });
});

test.describe("U1 the Safety Officer's queue, review and decision", () => {
  test("U1-T16 Safety Officer queue, review and decision in the browser", { tag: ["@U1", "@U1-T16"] }, async ({ page, a11y }) => {
    // Two events wait in Safety Review: the first for the "request changes" decision, the second to be approved.
    const first = await safetyReviewEvent();
    const second = await safetyReviewEvent();
    const reason = "Move the chairs away from the east exit.";

    // Step 1: the Safety Officer's navigation offers the Safety queue.
    await signIn(page, "safety");
    await expect(page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Safety queue", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Safety queue" })).toBeVisible();

    // Step 2: the queue lists both; E1's review shows the factors; a decision to request changes needs a reason.
    const queue = page.getByRole("table", { name: "Events in Safety Review" });
    await expect(queue.getByRole("row").filter({ hasText: first.event.name })).toContainText("Awaiting your decision");
    await expect(queue.getByRole("row").filter({ hasText: second.event.name })).toContainText("Awaiting your decision");
    await a11y("safety queue");
    await openReview(page, first.event.reference, first.event.name);

    const factors = page.getByLabel("Safety factors");
    await expect(factors).toContainText("150");
    await expect(factors).toContainText("Step-free access to the stage");
    const venues = page.getByRole("table", { name: "Booked venues" });
    await expect(venues).toContainText(first.venue.name);
    await expect(venues).toContainText("Theatre");
    await expect(venues).toContainText("Theatre (300), Classroom (120), Banquet (180)");
    const equipment = page.getByRole("table", { name: "Equipment and placement" });
    await expect(equipment).toContainText(first.chairs!.name);
    await expect(equipment).toContainText("Rows along the north wall");
    await a11y("safety review");

    const form = page.getByRole("form", { name: "Safety decision" });
    await form.getByRole("radio", { name: /Request changes/ }).check();
    await form.getByRole("button", { name: "Record decision" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Give a reason when you request changes or reject the safety arrangement." })).toBeVisible();
    expect(await statusOf(first.event.id)).toBe("SAFETY_REVIEW");
    await form.getByLabel("Reason (required)").fill(reason);
    await form.getByRole("button", { name: "Record decision" }).click();
    await expect.poll(() => statusOf(first.event.id)).toBe("PLANNING");
    const decision = await query<{ decision: string; reason: string }>(
      "select decision, reason from event.safety_decisions where event_id = $1",
      [first.event.id],
    );
    expect(decision).toEqual([{ decision: "REQUEST_CHANGES", reason }]);

    // The event has left Safety Review, so it has left the queue; the other still waits.
    await page.getByRole("link", { name: "Safety queue", exact: true }).click();
    await expect(page.getByRole("table", { name: "Events in Safety Review" }).getByRole("row").filter({ hasText: second.event.name })).toBeVisible();
    await expect(page.getByText(first.event.name)).toHaveCount(0);

    // Step 3: the assigned coordinator's Mark Confirmed shows the server's refusal until the Safety Officer approves.
    await signOut(page);
    await signIn(page, "coordinator");
    await openFromAllEvents(page, first.event.name);
    await expect(statusPanel(page).getByText("Planning", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Mark Confirmed" })).toHaveCount(0);
    await openFromAllEvents(page, second.event.name);
    await expect(statusPanel(page).getByText("Safety Review", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Mark Confirmed" }).click();
    await expect(
      page.getByText("The Safety Officer has not approved this event's safety arrangements, so it cannot be marked Confirmed."),
    ).toBeVisible();
    await expect(statusPanel(page).getByText("Safety Review", { exact: true })).toBeVisible();
    await a11y("coordinator review detail, Mark Confirmed refused");

    // Another coordinator is not offered the button at all.
    await signOut(page);
    await signIn(page, "coordinator2");
    await page.goto(`/#/review/${second.event.id}`);
    await expect(page.getByText("No event with that reference is assigned to you.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Mark Confirmed" })).toHaveCount(0);

    // The Safety Officer approves the second event; its queue entry then reads "Approved, awaiting Mark Confirmed".
    await signOut(page);
    await signIn(page, "safety");
    await openReview(page, second.event.reference, second.event.name);
    await page.getByRole("form", { name: "Safety decision" }).getByRole("button", { name: "Record decision" }).click();
    await expect(page.getByText("A decision is recorded for this review")).toBeVisible();
    await page.getByRole("link", { name: "Safety queue", exact: true }).click();
    await expect(
      page.getByRole("table", { name: "Events in Safety Review" }).getByRole("row").filter({ hasText: second.event.name }),
    ).toContainText("Approved, awaiting Mark Confirmed");

    // Now Mark Confirmed works, and the event is Confirmed.
    await signOut(page);
    await signIn(page, "coordinator");
    await openFromAllEvents(page, second.event.name);
    await page.getByRole("button", { name: "Mark Confirmed" }).click();
    await expect(statusPanel(page).getByText("Confirmed", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Mark Confirmed" })).toHaveCount(0);
    expect(await statusOf(second.event.id)).toBe("CONFIRMED");
  });
});

test.describe("F1 every status change writes a history entry", () => {
  test("F1-T7 confirming the arrangements writes a history entry from Approved to Safety Review", { tag: ["@F1", "@F1-T7"] }, async ({ page, a11y }) => {
    // An Approved event with its venue booking confirmed and no equipment required.
    const { event } = await arrangedEvent(false);
    expect(await statusOf(event.id)).toBe("APPROVED");

    // Step 1: the assigned coordinator confirms the arrangements through F5's action.
    await signIn(page, "coordinator");
    await openFromAllEvents(page, event.name);
    await page.getByRole("button", { name: "Confirm arrangements" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Confirm the venue and equipment arrangements?")).toBeVisible();
    await dialog.getByRole("button", { name: "Confirm arrangements" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(statusPanel(page).getByText("Safety Review", { exact: true })).toBeVisible();
    await a11y("coordinator review detail, safety review");

    // Step 2: the newest status change reads APPROVED -> SAFETY_REVIEW by the coordinator.
    const row = await latestStatusChange(event.id);
    expect(row).toMatchObject({
      previous_status: "APPROVED",
      new_status: "SAFETY_REVIEW",
      actor_user_id: ACCOUNTS.coordinator.id,
      actor_role: "EVENT_COORDINATOR",
      triggering_action: "CONFIRM_ARRANGEMENTS",
    });
    expect(row?.occurred_at).toBeInstanceOf(Date);
  });

  test("F1-T13 a request for safety changes returns a Safety Review event to Planning", { tag: ["@F1", "@F1-T13"] }, async ({ page }) => {
    const { event } = await safetyReviewEvent(false);
    expect(await statusOf(event.id)).toBe("SAFETY_REVIEW");

    // Step 1: the Safety Officer records the "request changes" decision with the reason.
    await signIn(page, "safety");
    await openReview(page, event.reference, event.name);
    const form = page.getByRole("form", { name: "Safety decision" });
    await form.getByRole("radio", { name: /Request changes/ }).check();
    await form.getByLabel("Reason (required)").fill("Move the stage away from the fire exit.");
    await form.getByRole("button", { name: "Record decision" }).click();
    await expect.poll(() => statusOf(event.id)).toBe("PLANNING");

    // Step 2: the newest status change reads SAFETY_REVIEW -> PLANNING by the Safety Officer.
    const row = await latestStatusChange(event.id);
    expect(row).toMatchObject({
      previous_status: "SAFETY_REVIEW",
      new_status: "PLANNING",
      actor_user_id: ACCOUNTS.safety.id,
      actor_role: "SAFETY_OFFICER",
      triggering_action: "REQUEST_SAFETY_CHANGES",
    });
    expect(row?.occurred_at).toBeInstanceOf(Date);
  });
});

/** How the notices name an event: its reference, then its name in quotes. */
const labelOf = (event: { reference: string; name: string }) => `${event.reference} “${event.name}”`;

/** The reference of the event's confirmed booking, as event.cancelled names it (venue.venue_slots). */
async function confirmedBookingReference(eventId: string): Promise<string> {
  const rows = await query<{ reference: string }>("select reference from venue.venue_slots where event_id = $1 and status = 'CONFIRMED'", [eventId]);
  expect(rows).toHaveLength(1);
  return rows[0]!.reference;
}

/**
 * F3 and F4 through the screens, and the notices they end on. Those are built by the notification
 * service from Kafka messages, which this stack leaves out, so each journey hands the cancellation's
 * event.cancelled to the consumers with deliverOutbox (support/deliver.ts) before anyone opens
 * Notifications. F4-T7 hands it to the registration service as well, which cancels the event's
 * registrations and waitlist entries and tells each attendee.
 */
test.describe("F3 and F4 cancel an event", () => {
  test("F3-T9 the owner cancels their event from its page with a reason; the coordinator sees the same, and all four are told", { tag: ["@F3", "@F3-T9"] }, async ({ page, a11y }) => {
    // Step 5 signs in four times and asks the notification service, which asks identity each time.
    test.setTimeout(150_000);
    await ensureIdentityBudget(40);
    const { event, venue, chairs } = await arrangedEvent(true, "F3 Chairs");
    await requestChange(event.id, { expectedAttendance: 160 }, "More people registered");
    const booking = await confirmedBookingReference(event.id);

    // Step 1: the owner opens the event's page from My requests.
    await signIn(page, "organiser");
    await page.getByRole("link", { name: "My requests" }).click();
    await rowWith(page, event.name).getByRole("link", { name: "View" }).click();
    await expect(page.getByRole("heading", { name: event.name })).toBeVisible();

    // Step 2: the dialog says what will happen and that it can't be undone; an empty reason is refused and sends nothing.
    await page.getByRole("button", { name: "Cancel event" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("This can't be undone.", { exact: false })).toBeVisible();
    await a11y("cancel event dialog");
    await dialog.getByRole("button", { name: "Cancel event" }).click();
    await expect(dialog.getByText("Give a reason for cancelling the event.")).toBeVisible();
    expect(await statusOf(event.id)).not.toBe("CANCELLED");

    // Step 3: with a reason the event is cancelled and the page says so.
    await dialog.getByLabel("Reason").fill("The speaker withdrew.");
    await dialog.getByRole("button", { name: "Cancel event" }).click();
    await expect(dialog).toHaveCount(0);
    const banner = page.getByRole("heading", { name: "This event was cancelled" });
    await expect(banner).toBeVisible();
    await expect(page.getByText("The speaker withdrew.").first()).toBeVisible();
    await expect(page.getByText(/^Cancelled \S.*\.$/)).toBeVisible();
    await expect(statusPanel(page).getByText("Cancelled", { exact: true })).toBeVisible();
    for (const control of ["Cancel event", "Edit details", "Request a change"]) {
      await expect(page.getByRole("button", { name: control })).toHaveCount(0);
    }
    await expect(page.getByText("Change request closed")).toBeVisible();
    await a11y("request detail, cancelled");

    // Step 4: the coordinator sees the same banner and is offered neither Cancel event nor Confirm arrangements.
    await signOut(page);
    await signIn(page, "coordinator");
    await openFromAllEvents(page, event.name);
    await expect(page.getByRole("heading", { name: "This event was cancelled" })).toBeVisible();
    await expect(page.getByText("The speaker withdrew.").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel event" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Confirm arrangements" })).toHaveCount(0);

    // Step 5: the cancellation's event.cancelled reaches the notification service (in place of
    // Kafka). Each of the four has one cancellation notice, with the reason.
    const delivered = await deliverOutbox(event.id, { types: ["event.cancelled"] });
    expect(delivered).toEqual([{ outbox: "event.outbox", type: "event.cancelled", consumer: "notification", outcome: "stored" }]);
    const cancelled = `${labelOf(event)} has been cancelled. Reason: The speaker withdrew.`;
    const expected: [AccountKey, string][] = [
      ["organiser", `Your event ${cancelled}`],
      ["coordinator", `The event ${cancelled}`],
      ["venuestaff", `${cancelled} Released: booking ${booking} at ${venue.name}, ${PERIOD_TEXT}.`],
      ["techsupport", `${cancelled} The equipment you reserved has been released: ${chairs!.name} × 5.`],
    ];
    for (const [who, text] of expected) {
      await signOut(page);
      const notices = await openNotifications(page, who);
      await expect(messageOf(notices.filter({ hasText: event.name }))).toHaveText([text]);
    }
  });

  test("F4-T8 the coordinator cancels an event with a booking and reserved equipment; the venue and the stock are free again, and their staff are told", { tag: ["@F4", "@F4-T8"] }, async ({ page, a11y }) => {
    test.setTimeout(150_000);
    await ensureIdentityBudget(40);
    const { event, venue, chairs, lineId } = await arrangedEvent(true, "F4 Chairs");
    const booking = await confirmedBookingReference(event.id);
    const cancelled = `${labelOf(event)} has been cancelled. Reason: Venue flooded.`;
    const tuesday = (p: Page) => p.getByRole("region", { name: "Tuesday 2 March 2027" });
    const openDay = async () => {
      await page.getByRole("navigation").getByRole("link", { name: "Venues", exact: true }).click();
      await rowWith(page, venue.name).getByRole("link", { name: "View" }).click();
      await page.getByRole("button", { name: "Availability", exact: true }).click();
      await expect(page.getByText("Availability. Times are Singapore time.")).toBeVisible();
      await page.getByLabel("From", { exact: true }).fill("2027-03-02");
      await page.getByLabel("To", { exact: true }).fill("2027-03-02");
      await page.getByRole("button", { name: "Show" }).click();
      await expect(tuesday(page)).toBeVisible();
    };

    // Step 1: Venue Staff see the booking on the event's day.
    await signIn(page, "venuestaff");
    await openDay();
    await expect(tuesday(page).getByRole("list", { name: "Committed" }).getByRole("listitem").filter({ hasText: event.reference })).toContainText("Confirmed");

    // Step 2: the coordinator cancels; the dialog says what will be released.
    await signOut(page);
    await signIn(page, "coordinator");
    await openFromAllEvents(page, event.name);
    await page.getByRole("button", { name: "Cancel event" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("venue bookings and holds are");
    await expect(dialog).toContainText("released");
    await expect(dialog).toContainText("equipment reservations released");
    await a11y("cancel event dialog, with arrangements");
    await dialog.getByLabel("Reason").fill("Venue flooded.");
    await dialog.getByRole("button", { name: "Cancel event" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(statusPanel(page).getByText("Cancelled", { exact: true })).toBeVisible();
    // The cancellation's event.cancelled reaches the notification service (in place of Kafka).
    const delivered = await deliverOutbox(event.id, { types: ["event.cancelled"] });
    expect(delivered).toEqual([{ outbox: "event.outbox", type: "event.cancelled", consumer: "notification", outcome: "stored" }]);

    // Step 3: the venue's day shows no booking for the event, and the whole opening day is free;
    // one notice names the booking as released, with the reason.
    await signOut(page);
    await signIn(page, "venuestaff");
    await openDay();
    await expect(tuesday(page).getByRole("list", { name: "Free" }).getByRole("listitem")).toHaveText(["08:00–22:00"]);
    await expect(tuesday(page).getByText(event.reference)).toHaveCount(0);
    const staffNotices = await openNotifications(page);
    await expect(messageOf(staffNotices.filter({ hasText: event.name }))).toHaveText([
      `${cancelled} Released: booking ${booking} at ${venue.name}, ${PERIOD_TEXT}.`,
    ]);

    // Step 4: Technical Support see the line is no longer Reserved and the full stock free for the period.
    await signOut(page);
    await signIn(page, "techsupport");
    await page.getByRole("link", { name: "Equipment requests", exact: true }).click();
    const line = rowWith(page, chairs!.name);
    await expect(line).toBeVisible();
    await expect(line.getByText("Reserved", { exact: true })).toHaveCount(0);
    await page.getByRole("link", { name: "Equipment availability", exact: true }).click();
    await page.getByLabel("Equipment type").selectOption({ label: chairs!.name });
    await page.getByLabel("Requested quantity").fill("20");
    await page.getByLabel("Starts at (local time)").fill("2027-03-02T14:00");
    await page.getByLabel("Ends at (local time)").fill("2027-03-02T18:00");
    await page.getByRole("button", { name: "Check availability" }).click();
    await expect(page.getByRole("region", { name: "Availability result" })).toContainText("Available quantity: 20");
    const lines = await query<{ status: string }>("select status from equipment.equipment_request_lines where id = $1", [lineId!]);
    expect(lines[0]?.status).not.toBe("RESERVED");
    // One notice says the equipment reserved was released, with the reason.
    const supportNotices = await openNotifications(page);
    await expect(messageOf(supportNotices.filter({ hasText: event.name }))).toHaveText([
      `${cancelled} The equipment you reserved has been released: ${chairs!.name} × 5.`,
    ]);
  });

  test("F4-T7 the registration service cancels the event's registrations and waitlist entry from event.cancelled, and tells each attendee", { tag: ["@F4", "@F4-T7"] }, async ({ page }) => {
    test.setTimeout(150_000);
    await ensureAttendeeTwo();
    await ensureIdentityBudget(60);
    // FX-F4's E, Approved, booked at a venue whose Theatre layout seats 2 (L1, M1). The approval
    // reaches the registration service (in place of Kafka), which builds E's seats from it (EN-13).
    // The listing is the registration service's copy of E, open for registration.
    const event = await approvedRequest({ name: uniqueName("F4 Registrations") });
    const venue = await createVenue({ maxCapacity: 2, layouts: [{ name: "Theatre", capacity: 2 }] });
    const request = await requestBooking(event.id, venue.id, { expectedAttendance: 2 });
    await approveBooking(request.id);
    await listPlannedEvent(event, { seats: 0 });
    const seated = await deliverOutbox(event.id, { to: ["registration"], types: ["venue-booking.request-approved"] });
    expect(seated).toEqual([{ outbox: "venue.outbox", type: "venue-booking.request-approved", consumer: "registration.seat-builder", outcome: "built" }]);
    expect(await seatStatusesOf(event.id)).toEqual({ FREE: 2 });
    // Two Registered attendees (R2): Attendee One, and another attendee (FX-R-TAKEN). The event is
    // then full, and Attendee Two joins its waitlist (R6).
    const mine = await registerThroughApi(event.id);
    await takeSeats(event.id, 1);
    const other = (await registrationsOf(event.id)).find((registration) => registration.attendee_id !== ATTENDEE_ID)!;
    const waiting = await joinWaitlistThroughApi(event.id, "attendee2");

    // Step 1: O cancels E. It answers 200 with no registration released, writes event.cancelled for
    // E, and leaves the registrations to the registration service.
    const cancellation = await call<{ released: { registrations: number } }>("organiser", "POST", `/api/v1/events/${event.id}/cancellation`, {
      reason: "The speaker withdrew.",
    });
    expect(cancellation.status).toBe(200);
    expect(cancellation.body.released.registrations).toBe(0);
    const written = await query<{ envelope: { data: { cancelledAt: string } } }>(
      "select envelope from event.outbox where message_key = $1 and envelope->>'type' = 'event.cancelled'",
      [event.id],
    );
    expect(written).toHaveLength(1);
    const cancelledAt = written[0]!.envelope.data.cancelledAt;
    const [stored] = await query<{ cancelled_at: Date }>("select cancelled_at from event.events where id = $1", [event.id]);
    expect(stored!.cancelled_at.toISOString()).toBe(cancelledAt);
    expect((await registrationsOf(event.id)).map((registration) => registration.status)).toEqual(["REGISTERED", "REGISTERED"]);

    // Step 2: the registration service consumes that event.cancelled, and the messages it writes in
    // turn reach the notification service (both in place of Kafka).
    const delivered = await deliverOutbox(event.id, {
      to: ["registration", "notification"],
      types: ["event.cancelled", "registration.cancelled", "waitlist.cancelled"],
    });
    expect(delivered).toContainEqual({ outbox: "event.outbox", type: "event.cancelled", consumer: "registration.event-listings", outcome: "applied" });
    expect(delivered.filter((delivery) => delivery.outbox === "registration.outbox")).toEqual([
      { outbox: "registration.outbox", type: "registration.cancelled", consumer: "notification", outcome: "stored" },
      { outbox: "registration.outbox", type: "registration.cancelled", consumer: "notification", outcome: "stored" },
      { outbox: "registration.outbox", type: "waitlist.cancelled", consumer: "notification", outcome: "stored" },
    ]);

    // Step 3: both registrations Cancelled at the cancellation's time, the seats retired, the waitlist
    // entry Cancelled, and one message per registration and per entry, each naming its attendee.
    const registrations = await registrationsOf(event.id);
    expect(registrations.map((registration) => [registration.status, registration.cancelled_at?.toISOString()])).toEqual([
      ["CANCELLED", cancelledAt],
      ["CANCELLED", cancelledAt],
    ]);
    expect(await seatStatusesOf(event.id)).toEqual({ RETIRED: 2 });
    const entries = await waitlistOf(event.id);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ id: waiting.id, attendee_id: ACCOUNTS.attendee2.id, status: "CANCELLED" });
    expect(entries[0]!.cancelled_at!.toISOString()).toBe(cancelledAt);
    const outbox = await registrationOutboxOf(event.id);
    const cancelledRegistrations = outbox
      .filter((message) => message.type === "registration.cancelled")
      .map((message) => [message.data.attendeeId, message.data.registrationReference]);
    expect(cancelledRegistrations).toHaveLength(2);
    expect(cancelledRegistrations).toEqual(
      expect.arrayContaining([
        [ATTENDEE_ID, mine.reference],
        [other.attendee_id, other.reference],
      ]),
    );
    const cancelledEntries = outbox
      .filter((message) => message.type === "waitlist.cancelled")
      .map((message) => [message.data.attendeeId, message.data.waitlistReference]);
    expect(cancelledEntries).toEqual([[ACCOUNTS.attendee2.id, waiting.reference]]);

    // Each attendee is told: Attendee One and Attendee Two read it in Notifications; the other
    // attendee, who has no account here, has it stored for them.
    const label = labelOf(event);
    const mineNotices = await openNotifications(page, "attendee");
    await expect(messageOf(mineNotices.filter({ hasText: event.name }))).toHaveText([
      `${label} has been cancelled, so your registration ${mine.reference} is cancelled.`,
    ]);
    await signOut(page);
    const waitingNotices = await openNotifications(page, "attendee2");
    await expect(messageOf(waitingNotices.filter({ hasText: event.name }))).toHaveText([
      `${label} has been cancelled, so your place on its waitlist (${waiting.reference}) is cancelled.`,
    ]);
    const othersNotices = await query<{ message: string }>(
      "select message from notification.notifications where recipient_user_id = $1 and event_id = $2",
      [other.attendee_id, event.id],
    );
    expect(othersNotices.map((notice) => notice.message)).toEqual([`${label} has been cancelled, so your registration ${other.reference} is cancelled.`]);
  });
});
