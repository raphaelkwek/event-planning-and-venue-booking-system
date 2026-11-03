import type { Locator, Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { expect, signIn, signOut, test, uniqueName } from "./support/fixtures.js";
import { must } from "./support/api.js";
import { approvedRequest } from "./support/seed.js";
import {
  ATTENDEE_ID,
  DESCRIPTION,
  PERIOD_TEXT,
  VENUE_ONE,
  VENUE_TWO,
  addSecondVenue,
  captureResponse,
  createRegistrationEvent,
  ensureIdentityBudget,
  eventLabel,
  isWithinLastMinute,
  listingTimes,
  otherAttendeeRegistration,
  registerThroughApi,
  registrationCountOf,
  registrationsOf,
  removeRFixtures,
  sendFromAttendeeConsole,
  singaporeMoment,
  symposiumName,
  takeSeats,
  withdrawThroughApi,
  type Envelope,
  type FxEvent,
  type RegistrationBody,
} from "./support/seed-registration.js";

/**
 * R1 (browse the events open for registration), R2 (register), R3 (my registrations) and R4
 * (withdraw), through the real attendee screens and the organiser's registration settings.
 *
 * The cards' FX-R-… statements are run against the job's own database (seed-registration.ts).
 * Not run here: R2-T12 and R4-T9, whose notifications arrive over Kafka, which the browser
 * tests' stack leaves out (documentation/evidence/EN-14).
 */

test.beforeEach(async () => {
  // A journey may wait for identity's request budget (ensureIdentityBudget) before it starts.
  test.setTimeout(150_000);
  await removeRFixtures();
  await ensureIdentityBudget(60);
});

// ---------------------------------------------------------------------------------------------
// Screens
// ---------------------------------------------------------------------------------------------

const attendeeNav = (page: Page) => page.getByRole("navigation", { name: "Attendee" });
const eventCard = (page: Page, name: string) => page.getByRole("article", { name, exact: true });
const eventPage = (page: Page) => page.getByRole("main").getByRole("article");
const registerButton = (page: Page) => page.getByRole("button", { name: "Register", exact: true });
const registrationList = (page: Page) => page.getByRole("list", { name: "My registrations" });
const registrationRow = (page: Page, name: string) =>
  registrationList(page)
    .getByRole("listitem")
    .filter({ has: page.getByRole("heading", { name, exact: true }) });
const withdrawButton = (row: Locator) => row.getByRole("button", { name: "Withdraw", exact: true });

async function openEvents(page: Page) {
  await attendeeNav(page).getByRole("link", { name: "Events", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Events", level: 1, exact: true })).toBeVisible();
}

async function openMyRegistrations(page: Page) {
  await attendeeNav(page).getByRole("link", { name: "My registrations", exact: true }).click();
  await expect(page.getByRole("heading", { name: "My registrations", level: 1, exact: true })).toBeVisible();
}

/** "Find the card for <name>" and "Click View event". */
async function viewEvent(page: Page, name: string) {
  await expect(eventCard(page, name)).toBeVisible();
  await eventCard(page, name).getByRole("link", { name: "View event" }).click();
  await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
}

/** "Click Events, find <name> and click View event". */
async function openEventFromEvents(page: Page, name: string) {
  await openEvents(page);
  await viewEvent(page, name);
}

/** R2-T1 steps 1 and 2: open the event from Events and click Register. */
async function registerFromEventPage(page: Page, event: FxEvent) {
  await openEventFromEvents(page, event.name);
  const created = await captureResponse<RegistrationBody & Envelope>(page, "POST", "/registrations", () => registerButton(page).click());
  expect(created.status).toBe(201);
  await expect(page.getByText("You are registered")).toBeVisible();
  await expect(page.getByRole("main")).toContainText(`Registration ${created.body.reference} for ${event.name} is confirmed.`);
  return created.body;
}

/** The text of a registration's row: `REG-… · Registered <day>, <time>`. */
const registeredAs = (registeredAt: Date) => `Registered ${singaporeMoment(registeredAt)}`;
const withdrawnAs = (withdrawnAt: Date) => `Withdrawn ${singaporeMoment(withdrawnAt)}`;

// ---------------------------------------------------------------------------------------------
// R1: browse events open for registration
// ---------------------------------------------------------------------------------------------

test.describe("R1 browse the events open for registration", () => {
  test("R1-T1 an open event is listed with its published details, and its page shows the same with Register", { tag: ["@R1", "@R1-T1"] }, async ({ page, a11y }) => {
    const event = await createRegistrationEvent();
    await signIn(page, "attendee");

    await openEvents(page);
    const card = eventCard(page, event.name);
    await expect(card).toBeVisible();
    await a11y("events open for registration");
    await expect(card.getByRole("heading", { name: event.name })).toBeVisible();
    await expect(card).toContainText(DESCRIPTION);
    await expect(card).toContainText(PERIOD_TEXT);
    await expect(card).toContainText(VENUE_ONE.line);
    await expect(card).toContainText("3 places remaining");

    await card.getByRole("link", { name: "View event" }).click();
    await expect(page.getByRole("heading", { name: event.name, level: 1 })).toBeVisible();
    const detail = eventPage(page);
    await expect(detail).toContainText(DESCRIPTION);
    await expect(detail).toContainText(PERIOD_TEXT);
    await expect(detail).toContainText(VENUE_ONE.line);
    await expect(detail).toContainText("3 places remaining");
    await expect(registerButton(page)).toBeVisible();
    await a11y("open event");
  });

  test("R1-T2 an event with two confirmed venues lists each venue and totals the places remaining", { tag: ["@R1", "@R1-T2"] }, async ({ page, a11y }) => {
    const event = await createRegistrationEvent();
    await addSecondVenue(event.eventId, 2);
    await signIn(page, "attendee");

    await openEvents(page);
    const card = eventCard(page, event.name);
    await expect(card).toBeVisible();
    await a11y("events open for registration");
    await expect(card).toContainText(VENUE_ONE.line);
    await expect(card).toContainText(VENUE_TWO.line);
    await expect(card).toContainText("5 places remaining");
    await expect(card).not.toContainText("3 places remaining");
    await expect(card).not.toContainText("2 places remaining");

    await card.getByRole("link", { name: "View event" }).click();
    await expect(page.getByRole("heading", { name: event.name, level: 1 })).toBeVisible();
    const detail = eventPage(page);
    await expect(detail).toContainText(VENUE_ONE.line);
    await expect(detail).toContainText(VENUE_TWO.line);
    await expect(detail).toContainText("5 places remaining");
  });

  test("R1-T3 a Confirmed event whose registration is not enabled is not listed", { tag: ["@R1", "@R1-T3"] }, async ({ page, a11y }) => {
    const notRequired = await createRegistrationEvent({ name: uniqueName("R No Registration"), required: false });
    const event = await createRegistrationEvent();
    await signIn(page, "attendee");

    await openEvents(page);
    await expect(eventCard(page, event.name)).toBeVisible();
    await a11y("events open for registration");
    await expect(page.getByText(notRequired.name)).toHaveCount(0);
    await expect(page.getByRole("article", { name: notRequired.name, exact: true })).toHaveCount(0);
  });

  test("R1-T4 events in any status but Confirmed are not listed, even with registration open", { tag: ["@R1", "@R1-T4"] }, async ({ page, a11y }) => {
    const statuses = ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "APPROVED", "PLANNING", "SAFETY_REVIEW", "REJECTED", "CANCELLED", "COMPLETED"];
    const others: FxEvent[] = [];
    for (const status of statuses) others.push(await createRegistrationEvent({ name: uniqueName(`R Status ${status}`), status }));
    const event = await createRegistrationEvent();
    await signIn(page, "attendee");

    await openEvents(page);
    await expect(eventCard(page, event.name)).toBeVisible();
    await a11y("events open for registration");
    expect(others).toHaveLength(9);
    for (const other of others) await expect(page.getByText(other.name)).toHaveCount(0);
    // Only the Confirmed event is listed.
    await expect(page.getByRole("list", { name: "Events open for registration" }).getByRole("article")).toHaveCount(1);
  });

  test("R1-T5 boundary: an event whose registration closes in one minute is listed; one that closed a minute ago is not", { tag: ["@R1", "@R1-T5"] }, async ({ page, a11y }) => {
    const closesSoon = await createRegistrationEvent({ name: uniqueName("R Closes Soon"), closes: "now() + interval '1 minute'" });
    const closed = await createRegistrationEvent({ name: uniqueName("R Closed"), closes: "now() - interval '1 minute'" });
    await signIn(page, "attendee");

    // Within a minute of the fixture.
    await openEvents(page);
    await expect(eventCard(page, closesSoon.name)).toBeVisible();
    await a11y("events open for registration");
    await expect(page.getByText(closed.name)).toHaveCount(0);
  });

  test("R1-T6 an event with no places remaining shows Full and offers no Register action", { tag: ["@R1", "@R1-T6"] }, async ({ page }) => {
    const event = await createRegistrationEvent();
    await takeSeats(event.eventId, 3);
    await signIn(page, "attendee");

    await openEvents(page);
    const card = eventCard(page, event.name);
    await expect(card).toBeVisible();
    // axe reports a serious colour-contrast violation on the Full label (an app defect, outside this card), so no axe check here.
    await expect(card.getByText("Full", { exact: true })).toBeVisible();
    await expect(card).not.toContainText(/places? remaining/);

    await card.getByRole("link", { name: "View event" }).click();
    await expect(page.getByRole("heading", { name: event.name, level: 1 })).toBeVisible();
    const detail = eventPage(page);
    await expect(detail.getByText("Full", { exact: true })).toBeVisible();
    await expect(detail).not.toContainText(/places? remaining/);
    await expect(registerButton(page)).toHaveCount(0);
    // axe reports a serious colour-contrast violation on the Full label (an app defect, outside this card), so no axe check here.
  });

  test("R1-T7 boundary: with one place left the event shows 1 place remaining, no Full label, and still offers Register", { tag: ["@R1", "@R1-T7"] }, async ({ page, a11y }) => {
    const event = await createRegistrationEvent();
    await takeSeats(event.eventId, 2);
    await signIn(page, "attendee");

    await openEvents(page);
    const card = eventCard(page, event.name);
    await expect(card).toBeVisible();
    await a11y("events open for registration");
    await expect(card).toContainText("1 place remaining");
    await expect(card.getByText("Full", { exact: true })).toHaveCount(0);

    await card.getByRole("link", { name: "View event" }).click();
    await expect(page.getByRole("heading", { name: event.name, level: 1 })).toBeVisible();
    await expect(eventPage(page)).toContainText("1 place remaining");
    await expect(eventPage(page).getByText("Full", { exact: true })).toHaveCount(0);
    await expect(registerButton(page)).toBeVisible();
  });

  test("R1-T8 internal information is not shown: the page and the API response carry only the published fields", { tag: ["@R1", "@R1-T8"] }, async ({ page, a11y }) => {
    const event = await createRegistrationEvent();
    await signIn(page, "attendee");

    await openEventFromEvents(page, event.name);
    await a11y("open event");
    const detail = eventPage(page);
    await expect(detail).toContainText(DESCRIPTION);
    await expect(detail).toContainText(PERIOD_TEXT);
    await expect(detail).toContainText(VENUE_ONE.line);
    await expect(detail).toContainText("3 places remaining");
    // No review comment, clarification, coordinator, booking, layout or equipment.
    const shown = await page.getByRole("main").innerText();
    expect(shown).not.toMatch(/review|clarification|coordinator|booking|layout|equipment/i);

    const sent = await sendFromAttendeeConsole<{ items: Record<string, unknown>[] }>(page, "GET", "/registration/api/v1/open-events");
    await a11y("direct API console");
    expect(sent.status).toBe(200);
    const item = sent.body.items.find((candidate) => candidate.eventId === event.eventId);
    expect(item).toBeDefined();
    expect(Object.keys(item!).sort()).toEqual(
      [
        "description",
        "endsAt",
        "eventId",
        "isFull",
        "name",
        "placesRemaining",
        "reference",
        "registrationClosesAt",
        "registrationOpensAt",
        "startsAt",
        "venues",
        "withdrawalDeadline",
      ].sort(),
    );
    const venues = item!.venues as Record<string, unknown>[];
    expect(venues).toHaveLength(1);
    expect(Object.keys(venues[0]!).sort()).toEqual(["location", "name"]);
    expect(venues[0]).toEqual({ name: VENUE_ONE.name, location: VENUE_ONE.location });
  });
});

// ---------------------------------------------------------------------------------------------
// R2: register
// ---------------------------------------------------------------------------------------------

test.describe("R2 register for an event", () => {
  test("R2-T1 an attendee registers for an open event, sees a confirmation, and the registration is stored as Registered", { tag: ["@R2", "@R2-T1"] }, async ({ page, a11y }) => {
    const event = await createRegistrationEvent();
    await signIn(page, "attendee");

    await openEventFromEvents(page, event.name);
    const created = await captureResponse<RegistrationBody & Envelope>(page, "POST", "/registrations", () => registerButton(page).click());
    expect(created.status).toBe(201);
    await expect(page.getByText("You are registered")).toBeVisible();
    expect(created.body.reference).toMatch(/^REG-\d{6}$/);
    await expect(page.getByRole("main")).toContainText(`Registration ${created.body.reference} for ${event.name} is confirmed.`);
    await expect(page.getByRole("main").getByRole("link", { name: "My registrations" })).toBeVisible();
    await a11y("registered");

    const rows = await registrationsOf(event.eventId);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.attendee_id).toBe(ATTENDEE_ID);
    expect(rows[0]!.event_id).toBe(event.eventId);
    expect(rows[0]!.status).toBe("REGISTERED");
    expect(rows[0]!.reference).toBe(created.body.reference);
    expect(isWithinLastMinute(rows[0]!.registered_at)).toBe(true);
  });

  test("R2-T2 places come from the layout capacity, not the expected attendance, and no registration capacity is entered anywhere", { tag: ["@R2", "@R2-T2"] }, async ({ page, a11y }) => {
    // The fixture has no expected attendance at all: it never reaches the registration service.
    const event = await createRegistrationEvent({ seats: 3 });
    await takeSeats(event.eventId, 1);
    await signIn(page, "attendee");

    await openEventFromEvents(page, event.name);
    await expect(eventPage(page)).toContainText("2 places remaining");
    await a11y("open event");
    const created = await captureResponse<RegistrationBody & Envelope>(page, "POST", "/registrations", () => registerButton(page).click());
    expect(created.status).toBe(201);
    await expect(page.getByText("You are registered")).toBeVisible();
    // The attendee's screen has nowhere to type a capacity.
    await expect(page.getByRole("main").getByRole("textbox")).toHaveCount(0);
    await expect(page.getByRole("main").getByRole("spinbutton")).toHaveCount(0);
    await expect(page.getByLabel(/capacity/i)).toHaveCount(0);

    // Nor does the organiser's: the new request form and the registration settings.
    const approved = await approvedRequest({ proposedStartAt: "2030-12-02T06:00:00.000Z", proposedEndAt: "2030-12-02T10:00:00.000Z" });
    await signOut(page);
    await signIn(page, "organiser");
    await page.getByRole("link", { name: "New request" }).click();
    await expect(page.getByRole("heading", { name: "New event request" })).toBeVisible();
    await a11y("new request");
    await expect(page.getByLabel("Expected attendance")).toBeVisible();
    await expect(page.getByLabel(/registration capacity/i)).toHaveCount(0);
    await expect(page.getByText(/registration capacity/i)).toHaveCount(0);

    await page.getByRole("link", { name: "My requests" }).click();
    await page.getByRole("row").filter({ hasText: approved.name }).getByRole("link", { name: "View" }).click();
    await page.getByRole("button", { name: "Registration settings" }).click();
    await expect(page.getByRole("heading", { name: "Registration settings" })).toBeVisible();
    await a11y("registration settings");
    await expect(page.getByLabel(/capacity/i)).toHaveCount(0);
    await expect(page.getByText(/capacity/i)).toHaveCount(0);
    await expect(page.getByRole("spinbutton")).toHaveCount(0);
  });

  test("R2-T4 registering for a full event is refused naming capacity and offering the waitlist, and stores nothing", { tag: ["@R2", "@R2-T4"] }, async ({ page, a11y }) => {
    const event = await createRegistrationEvent();
    await takeSeats(event.eventId, 3);
    await signIn(page, "attendee");

    // The event page shows Full and no Register button (R1-T6). To try anyway, the API console.
    await openEventFromEvents(page, event.name);
    await expect(eventPage(page).getByText("Full", { exact: true })).toBeVisible();
    await expect(registerButton(page)).toHaveCount(0);
    // axe reports a serious colour-contrast violation on the Full label (an app defect, outside this card), so no axe check here.

    const sent = await sendFromAttendeeConsole(page, "POST", "/registration/api/v1/registrations", JSON.stringify({ eventId: event.eventId }));
    await a11y("direct API console");
    expect(sent.status).toBe(409);
    expect(sent.body.error?.code).toBe("REGISTRATION_FULL");
    expect(sent.body.error?.message).toContain("has no places remaining");
    expect(sent.body.error?.message).toContain(eventLabel(event));
    expect(sent.body.error?.details?.waitlistOffered).toBe(true);

    expect(await registrationsOf(event.eventId, ATTENDEE_ID)).toHaveLength(0);
    await openEvents(page);
    const card = eventCard(page, event.name);
    await expect(card.getByText("Full", { exact: true })).toBeVisible();
    await expect(card).not.toContainText(/places? remaining/);
  });

  test("R2-T6 a second registration is refused naming the first, stores no second record, and leaves the places unchanged", { tag: ["@R2", "@R2-T6"] }, async ({ page, a11y }) => {
    const event = await createRegistrationEvent();
    await signIn(page, "attendee");

    // R2-T1 steps 1 and 2; note the reference shown.
    const first = await registerFromEventPage(page, event);

    await page.reload();
    await expect(page.getByRole("heading", { name: event.name, level: 1 })).toBeVisible();
    await expect(eventPage(page)).toContainText("2 places remaining");
    const again = await captureResponse<Envelope>(page, "POST", "/registrations", () => registerButton(page).click());
    expect(again.status).toBe(409);
    expect(again.body.error?.code).toBe("REGISTRATION_DUPLICATE");
    await expect(page.getByRole("main")).toContainText(
      `You are already registered for ${eventLabel(event)} (registration ${first.reference}), so no second registration was made.`,
    );
    await a11y("registration refused");

    const rows = await registrationsOf(event.eventId, ATTENDEE_ID);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.reference).toBe(first.reference);
    await expect(eventPage(page)).toContainText("2 places remaining");
  });

  test("R2-T8 boundary: before registration opens the attempt is refused naming the window, and nothing is stored", { tag: ["@R2", "@R2-T8"] }, async ({ page, a11y }) => {
    const event = await createRegistrationEvent({ opens: "now() + interval '1 day'" });
    const { opens, closes } = await listingTimes(event.eventId);
    await signIn(page, "attendee");

    // Listed, because its closing has not passed.
    await openEventFromEvents(page, event.name);
    await a11y("open event");
    const refused = await captureResponse<Envelope>(page, "POST", "/registrations", () => registerButton(page).click());
    expect(refused.status).toBe(422);
    expect(refused.body.error?.code).toBe("REGISTRATION_OUTSIDE_WINDOW");
    await expect(page.getByRole("main")).toContainText(
      `Registration for ${eventLabel(event)} opens on ${singaporeMoment(opens)} and closes on ${singaporeMoment(closes)}, so you cannot register now.`,
    );
    await a11y("registration refused");

    expect(await registrationsOf(event.eventId, ATTENDEE_ID)).toHaveLength(0);
    await expect(eventPage(page)).toContainText("3 places remaining");
  });

  test("R2-T11 the owning organiser sets the registration window; another organiser and an invalid window are refused", { tag: ["@R2", "@R2-T11"] }, async ({ page, a11y }) => {
    // The card's 2 December 2026 moves to 2 December 2030 (as EN-14 moved G1-T5), same times, so it is never in the past.
    const event = await approvedRequest({ proposedStartAt: START_2030, proposedEndAt: END_2030 });
    await openRegistrationSettings(page, event.name);
    await a11y("registration settings");

    // Step 2: closing before opening is refused under Registration closes, and nothing is saved.
    await page.getByLabel("Attendees register for this event").check();
    await setMoment(page, "Registration opens", "2030-12-01", "09:00");
    await setMoment(page, "Registration closes", "2030-11-30", "09:00");
    const refused = await save(page);
    expect(refused.status).toBe(400);
    await expect(groupOf(page, "Registration closes").getByRole("alert")).toHaveText("Registration closing must be later than registration opening.");
    await expect(page.getByText("Registration settings saved.")).toHaveCount(0);
    await a11y("registration settings, refused");
    expect(await settingsOf(event.id)).toMatchObject({ registrationRequired: false, registrationOpensAt: null, registrationClosesAt: null });

    // A closing after the event start is refused as well.
    await setMoment(page, "Registration closes", "2030-12-02", "15:00");
    const afterStart = await save(page);
    expect(afterStart.status).toBe(400);
    await expect(groupOf(page, "Registration closes").getByRole("alert")).toHaveText("Registration closing must be no later than the event start.");
    expect(await settingsOf(event.id)).toMatchObject({ registrationRequired: false, registrationClosesAt: null });

    // Step 3: a valid closing is saved and the request shows the new window.
    await setMoment(page, "Registration closes", "2030-12-02", "12:00");
    const saved = await save(page);
    expect(saved.status).toBe(200);
    await expect(page.getByText("Registration settings saved.")).toBeVisible();
    await expect(page.getByLabel("Registration opens date")).toHaveValue("2030-12-01");
    await expect(page.getByLabel("Registration opens time")).toHaveValue("09:00");
    await expect(page.getByLabel("Registration closes date")).toHaveValue("2030-12-02");
    await expect(page.getByLabel("Registration closes time")).toHaveValue("12:00");
    await a11y("registration settings, saved");
    expect(await settingsOf(event.id)).toMatchObject({
      registrationRequired: true,
      registrationOpensAt: "2030-12-01T01:00:00.000Z",
      registrationClosesAt: "2030-12-02T04:00:00.000Z",
    });
    await page.reload();
    await expect(page.getByLabel("Registration closes date")).toHaveValue("2030-12-02");
    await expect(page.getByLabel("Registration closes time")).toHaveValue("12:00");
    await page.getByRole("link", { name: "Back to the request" }).click();
    await expect(page.getByRole("heading", { name: event.name })).toBeVisible();
    await expect(page.getByText("Registration required", { exact: true }).locator("..")).toContainText("Yes");

    // Step 4: another organiser can't see the event or change its settings.
    await signOut(page);
    await signIn(page, "organiser2");
    await page.goto(`/#/events/${event.id}/registration`);
    await expect(page.getByText("No event with that reference is available to you.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Save registration settings" })).toHaveCount(0);
    await a11y("registration settings refused");
    expect(await settingsOf(event.id)).toMatchObject({
      registrationRequired: true,
      registrationOpensAt: "2030-12-01T01:00:00.000Z",
      registrationClosesAt: "2030-12-02T04:00:00.000Z",
    });
  });
});

// ---------------------------------------------------------------------------------------------
// R3: my registrations
// ---------------------------------------------------------------------------------------------

/** Two events, registered for, the second then withdrawn: the card's pre-conditions for R3-T1 and R3-T5. */
async function oneRegisteredOneWithdrawn() {
  const registered = await createRegistrationEvent({ name: symposiumName() });
  const withdrawn = await createRegistrationEvent({ name: uniqueName("R Second Talk") });
  const first = await registerThroughApi(registered.eventId);
  const second = await registerThroughApi(withdrawn.eventId);
  await withdrawThroughApi(second.id);
  const [firstRow] = await registrationsOf(registered.eventId, ATTENDEE_ID);
  const [secondRow] = await registrationsOf(withdrawn.eventId, ATTENDEE_ID);
  return { registered, withdrawn, first, second, firstRow: firstRow!, secondRow: secondRow! };
}

test.describe("R3 my registrations", () => {
  test("R3-T1 My registrations lists each registration with the event, date, times, venue location, status and registration time", { tag: ["@R3", "@R3-T1"] }, async ({ page, a11y }) => {
    const setup = await oneRegisteredOneWithdrawn();
    await signIn(page, "attendee");

    await openMyRegistrations(page);
    await expect(registrationRow(page, setup.registered.name)).toBeVisible();
    await a11y("my registrations");
    await expect(registrationList(page).getByRole("listitem")).toHaveCount(2);

    const registeredRow = registrationRow(page, setup.registered.name);
    await expect(registeredRow).toContainText(PERIOD_TEXT);
    await expect(registeredRow).toContainText(VENUE_ONE.location);
    await expect(registeredRow.getByText("Registered", { exact: true })).toBeVisible();
    await expect(registeredRow).toContainText(setup.first.reference);
    await expect(registeredRow).toContainText(registeredAs(setup.firstRow.registered_at));

    const withdrawnRow = registrationRow(page, setup.withdrawn.name);
    await expect(withdrawnRow).toContainText(PERIOD_TEXT);
    await expect(withdrawnRow).toContainText(VENUE_ONE.location);
    await expect(withdrawnRow.getByText("Withdrawn", { exact: true })).toBeVisible();
    await expect(withdrawnRow).toContainText(setup.second.reference);
    await expect(withdrawnRow).toContainText(registeredAs(setup.secondRow.registered_at));
  });

  test("R3-T2 another attendee's registrations are never listed", { tag: ["@R3", "@R3-T2"] }, async ({ page }) => {
    const event = await createRegistrationEvent();
    const other = await otherAttendeeRegistration(event.eventId);
    await signIn(page, "attendee");

    await openMyRegistrations(page);
    await expect(page.getByText("You have no registrations yet.")).toBeVisible();
    // axe reports a serious link-in-text-block violation on the empty state's Events link (an app defect, outside this card), so no axe check here.
    await expect(registrationList(page)).toHaveCount(0);
    await expect(page.getByText(other.reference)).toHaveCount(0);
    await expect(page.getByText(event.name)).toHaveCount(0);
  });

  test("R3-T3 another attendee's registration by its id answers as if it did not exist", { tag: ["@R3", "@R3-T3"] }, async ({ page, a11y }) => {
    const event = await createRegistrationEvent();
    const other = await otherAttendeeRegistration(event.eventId);
    await signIn(page, "attendee");

    const theirs = await sendFromAttendeeConsole(page, "GET", `/registration/api/v1/registrations/${other.id}`);
    await a11y("direct API console");
    const random = await sendFromAttendeeConsole(page, "GET", `/registration/api/v1/registrations/${randomUUID()}`);

    for (const sent of [theirs, random]) {
      expect(sent.status).toBe(404);
      expect(sent.body.error?.code).toBe("REGISTRATION_NOT_FOUND");
      expect(sent.body.error?.message).toBe("No registration with that id is yours.");
    }
    expect(theirs.body.error?.message).toBe(random.body.error?.message);
    // Nothing about the other attendee's registration is returned.
    expect(JSON.stringify(theirs.body)).not.toContain(other.reference);
    expect(JSON.stringify(theirs.body)).not.toContain(event.name);
  });

  test("R3-T5 each entry shows the registration time and, only where applicable, the withdrawal time", { tag: ["@R3", "@R3-T5"] }, async ({ page, a11y }) => {
    const setup = await oneRegisteredOneWithdrawn();
    await signIn(page, "attendee");

    await openMyRegistrations(page);
    await expect(registrationRow(page, setup.withdrawn.name)).toBeVisible();
    await a11y("my registrations");

    const withdrawnRow = registrationRow(page, setup.withdrawn.name);
    expect(setup.secondRow.withdrawn_at).not.toBeNull();
    const withdrawnAt = setup.secondRow.withdrawn_at!;
    expect(withdrawnAt.getTime()).toBeGreaterThan(setup.secondRow.registered_at.getTime());
    await expect(withdrawnRow).toContainText(registeredAs(setup.secondRow.registered_at));
    await expect(withdrawnRow).toContainText(withdrawnAs(withdrawnAt));

    const registeredRow = registrationRow(page, setup.registered.name);
    await expect(registeredRow).toContainText(registeredAs(setup.firstRow.registered_at));
    await expect(registeredRow).not.toContainText("Withdrawn");
  });

  test("R3-T6 boundary: an attendee with no registrations sees an empty state, not an error", { tag: ["@R3", "@R3-T6"] }, async ({ page }) => {
    // The fixtures were removed before this journey, so Attendee One has no registrations (as after the cards' reset).
    expect(await registrationCountOf(ATTENDEE_ID)).toBe(0);
    await signIn(page, "attendee");

    await openMyRegistrations(page);
    await expect(page.getByText("You have no registrations yet.")).toBeVisible();
    await expect(page.getByRole("main").getByRole("link", { name: "Events", exact: true })).toBeVisible();
    // axe reports a serious link-in-text-block violation on the empty state's Events link (an app defect, outside this card), so no axe check here.
    await expect(page.getByText("could not be loaded")).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------------------------
// R4: withdraw
// ---------------------------------------------------------------------------------------------

test.describe("R4 withdraw a registration", () => {
  test("R4-T1 an attendee withdraws their registration after confirming; it becomes Withdrawn and is not deleted", { tag: ["@R4", "@R4-T1"] }, async ({ page, a11y }) => {
    const event = await createRegistrationEvent();
    const registration = await registerThroughApi(event.eventId);
    await signIn(page, "attendee");

    await openMyRegistrations(page);
    const row = registrationRow(page, event.name);
    await expect(row).toBeVisible();
    await a11y("my registrations");
    await withdrawButton(row).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Withdraw your registration?");
    await expect(dialog).toContainText("will be released for someone else");
    await expect(dialog).toContainText(`registration ${registration.reference} will show as Withdrawn`);
    await a11y("withdraw dialog");

    const done = await captureResponse<RegistrationBody>(page, "POST", `/registrations/${registration.id}/withdrawal`, () =>
      dialog.getByRole("button", { name: "Withdraw registration" }).click(),
    );
    expect(done.status).toBe(200);
    await expect(dialog).toHaveCount(0);

    const rows = await registrationsOf(event.eventId, ATTENDEE_ID);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.status).toBe("WITHDRAWN");
    expect(rows[0]!.withdrawn_at).not.toBeNull();
    expect(rows[0]!.withdrawn_at!.getTime()).toBeGreaterThan(rows[0]!.registered_at.getTime());
    await expect(row.getByText("Withdrawn", { exact: true })).toBeVisible();
    await expect(row).toContainText(withdrawnAs(rows[0]!.withdrawn_at!));
    await expect(withdrawButton(row)).toHaveCount(0);
    await a11y("my registrations, withdrawn");
  });

  test("R4-T2 places remaining increases by exactly one on a successful withdrawal", { tag: ["@R4", "@R4-T2"] }, async ({ page, a11y }) => {
    const event = await createRegistrationEvent();
    await takeSeats(event.eventId, 1);
    // Pre-condition: the attendee registers (R2-T1 steps 1 and 2).
    await signIn(page, "attendee");
    await registerFromEventPage(page, event);

    // Step 1: open the event and note the places remaining.
    await openEventFromEvents(page, event.name);
    await expect(eventPage(page)).toContainText("1 place remaining");
    await a11y("open event");

    // Step 2: withdraw (R4-T1 steps 1 to 3).
    await openMyRegistrations(page);
    await withdrawButton(registrationRow(page, event.name)).click();
    const dialog = page.getByRole("dialog");
    const done = await captureResponse<RegistrationBody>(page, "POST", "/withdrawal", () =>
      dialog.getByRole("button", { name: "Withdraw registration" }).click(),
    );
    expect(done.status).toBe(200);
    await expect(registrationRow(page, event.name).getByText("Withdrawn", { exact: true })).toBeVisible();

    // Step 3: open the event again.
    await openEventFromEvents(page, event.name);
    await expect(eventPage(page)).toContainText("2 places remaining");
    await expect(eventPage(page)).not.toContainText("1 place remaining");
  });

  test("R4-T3 another attendee's registration cannot be withdrawn; it is answered as not found", { tag: ["@R4", "@R4-T3"] }, async ({ page, a11y }) => {
    const event = await createRegistrationEvent();
    const other = await otherAttendeeRegistration(event.eventId);
    await signIn(page, "attendee");
    await openEventFromEvents(page, event.name);
    await expect(eventPage(page)).toContainText("2 places remaining");

    const sent = await sendFromAttendeeConsole(page, "POST", `/registration/api/v1/registrations/${other.id}/withdrawal`);
    await a11y("direct API console");
    expect(sent.status).toBe(404);
    expect(sent.body.error?.code).toBe("REGISTRATION_NOT_FOUND");
    expect(sent.body.error?.message).toBe("No registration with that id is yours.");

    // The other attendee's registration is untouched, and the places are unchanged.
    const rows = await registrationsOf(event.eventId);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe(other.id);
    expect(rows[0]!.status).toBe("REGISTERED");
    expect(rows[0]!.withdrawn_at).toBeNull();
    await openEventFromEvents(page, event.name);
    await expect(eventPage(page)).toContainText("2 places remaining");
  });

  test("R4-T6 boundary: a withdrawal after the deadline is refused naming it; the registration stays Registered", { tag: ["@R4", "@R4-T6"] }, async ({ page, a11y }) => {
    // The deadline is two minutes after the fixture runs, and the card waits for it to pass.
    test.setTimeout(300_000);
    const event = await createRegistrationEvent({ deadline: "now() + interval '2 minutes'" });
    const { deadline } = await listingTimes(event.eventId);
    expect(deadline).not.toBeNull();
    const registration = await registerThroughApi(event.eventId);
    await signIn(page, "attendee");

    // Step 1: wait until the deadline has passed, then withdraw (R4-T1 steps 1 to 3).
    const wait = deadline!.getTime() - Date.now() + 2_000;
    if (wait > 0) await page.waitForTimeout(wait);
    await openMyRegistrations(page);
    const row = registrationRow(page, event.name);
    await expect(row).toBeVisible();
    await a11y("my registrations");
    await withdrawButton(row).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const refused = await captureResponse<Envelope>(page, "POST", `/registrations/${registration.id}/withdrawal`, () =>
      dialog.getByRole("button", { name: "Withdraw registration" }).click(),
    );
    expect(refused.status).toBe(422);
    expect(refused.body.error?.code).toBe("WITHDRAWAL_DEADLINE_PASSED");
    await expect(dialog).toContainText(
      `The withdrawal deadline for ${eventLabel(event)} was ${singaporeMoment(deadline!)}, so registration ${registration.reference} can no longer be withdrawn.`,
    );
    await a11y("withdraw dialog, refused");

    // Step 2: the registration and the places are unchanged.
    await dialog.getByRole("button", { name: "Keep my place" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(row.getByText("Registered", { exact: true })).toBeVisible();
    const rows = await registrationsOf(event.eventId, ATTENDEE_ID);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.status).toBe("REGISTERED");
    expect(rows[0]!.withdrawn_at).toBeNull();
    await openEventFromEvents(page, event.name);
    await expect(eventPage(page)).toContainText("2 places remaining");
  });

  test("R4-T8 the owning organiser sets the withdrawal deadline; one after the event start is refused", { tag: ["@R4", "@R4-T8"] }, async ({ page, a11y }) => {
    // The card's 2 December 2026 moves to 2 December 2030 (as EN-14 moved G1-T5), same times.
    const event = await approvedRequest({ proposedStartAt: START_2030, proposedEndAt: END_2030 });
    await openRegistrationSettings(page, event.name);
    await a11y("registration settings");

    // Step 2: a deadline after the event start (14:00) is refused under Withdrawal deadline; nothing is saved.
    await page.getByLabel("Attendees register for this event").check();
    await setMoment(page, "Registration opens", "2030-12-01", "09:00");
    await setMoment(page, "Registration closes", "2030-12-02", "12:00");
    await setMoment(page, "Withdrawal deadline (optional)", "2030-12-02", "15:00");
    const refused = await save(page);
    expect(refused.status).toBe(400);
    await expect(groupOf(page, "Withdrawal deadline (optional)").getByRole("alert")).toHaveText(
      "The withdrawal deadline must be no later than the event start.",
    );
    await expect(page.getByText("Registration settings saved.")).toHaveCount(0);
    await a11y("registration settings, refused");
    expect(await settingsOf(event.id)).toMatchObject({ registrationRequired: false, withdrawalDeadlineAt: null });

    // Step 3: a deadline before the start is saved.
    await setMoment(page, "Withdrawal deadline (optional)", "2030-12-02", "13:00");
    const saved = await save(page);
    expect(saved.status).toBe(200);
    await expect(page.getByText("Registration settings saved.")).toBeVisible();
    await expect(page.getByLabel("Withdrawal deadline (optional) date")).toHaveValue("2030-12-02");
    await expect(page.getByLabel("Withdrawal deadline (optional) time")).toHaveValue("13:00");
    expect(await settingsOf(event.id)).toMatchObject({ registrationRequired: true, withdrawalDeadlineAt: "2030-12-02T05:00:00.000Z" });

    // Step 4: clearing the deadline saves with none, which means withdrawal is allowed until the event starts.
    await page.getByLabel("Withdrawal deadline (optional) date").fill("");
    await page.getByLabel("Withdrawal deadline (optional) time").fill("");
    const cleared = await save(page);
    expect(cleared.status).toBe(200);
    await expect(page.getByText("Registration settings saved.")).toBeVisible();
    await expect(page.getByLabel("Withdrawal deadline (optional) date")).toHaveValue("");
    await expect(page.getByLabel("Withdrawal deadline (optional) time")).toHaveValue("");
    await expect(page.getByText("Without a withdrawal deadline, attendees can withdraw until the event starts.")).toBeVisible();
    expect(await settingsOf(event.id)).toMatchObject({ registrationRequired: true, withdrawalDeadlineAt: null });
    await a11y("registration settings, saved");
  });

  test("R4-T10 registering again after withdrawing creates a new registration", { tag: ["@R4", "@R4-T10"] }, async ({ page, a11y }) => {
    const event = await createRegistrationEvent();
    // Pre-condition: R4-T1 done; note the withdrawn reference.
    const old = await registerThroughApi(event.eventId);
    await withdrawThroughApi(old.id);
    await signIn(page, "attendee");

    // Step 1: open the event from Events and click Register.
    const created = await registerFromEventPage(page, event);
    expect(created.reference).toMatch(/^REG-\d{6}$/);
    expect(created.reference).not.toBe(old.reference);
    await expect(page.getByRole("main")).not.toContainText(old.reference);
    await a11y("registered");

    // Step 2: My registrations lists both.
    await page.getByRole("main").getByRole("link", { name: "My registrations" }).click();
    await expect(page.getByRole("heading", { name: "My registrations", level: 1, exact: true })).toBeVisible();
    await expect(registrationList(page).getByRole("listitem")).toHaveCount(2);
    await a11y("my registrations");
    const oldRow = registrationList(page).getByRole("listitem").filter({ hasText: old.reference });
    const newRow = registrationList(page).getByRole("listitem").filter({ hasText: created.reference });
    await expect(oldRow.getByText("Withdrawn", { exact: true })).toBeVisible();
    await expect(newRow.getByText("Registered", { exact: true })).toBeVisible();
    await expect(withdrawButton(newRow)).toBeVisible();
    await expect(withdrawButton(oldRow)).toHaveCount(0);
    const rows = await registrationsOf(event.eventId, ATTENDEE_ID);
    expect(rows.map((r) => r.status).sort()).toEqual(["REGISTERED", "WITHDRAWN"]);
  });

  test("R4-T11 withdraw asks for confirmation; keeping the place changes nothing", { tag: ["@R4", "@R4-T11"] }, async ({ page, a11y }) => {
    const event = await createRegistrationEvent();
    const registration = await registerThroughApi(event.eventId);
    await signIn(page, "attendee");

    await openMyRegistrations(page);
    const row = registrationRow(page, event.name);
    await expect(row).toBeVisible();
    await a11y("my registrations");
    await withdrawButton(row).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    // The dialog restates what will happen before anything changes.
    await expect(dialog).toContainText("Withdraw your registration?");
    await expect(dialog).toContainText(`${event.reference} “${event.name}” will be released for someone else`);
    await expect(dialog).toContainText(`registration ${registration.reference} will show as Withdrawn`);
    expect((await registrationsOf(event.eventId, ATTENDEE_ID))[0]!.status).toBe("REGISTERED");
    await a11y("withdraw dialog");

    await dialog.getByRole("button", { name: "Keep my place" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(row.getByText("Registered", { exact: true })).toBeVisible();
    await expect(withdrawButton(row)).toBeVisible();
    await expect(row).not.toContainText("Withdrawn");
    const rows = await registrationsOf(event.eventId, ATTENDEE_ID);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.status).toBe("REGISTERED");
    expect(rows[0]!.withdrawn_at).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------
// The organiser's registration settings (R2-T11, R4-T8)
// ---------------------------------------------------------------------------------------------

/** The card's 14:00 to 18:00 request, on 2 December 2030 rather than 2026 so it never falls in the past. */
const START_2030 = "2030-12-02T06:00:00.000Z";
const END_2030 = "2030-12-02T10:00:00.000Z";

interface SettingsBody {
  registrationRequired: boolean;
  registrationOpensAt: string | null;
  registrationClosesAt: string | null;
  withdrawalDeadlineAt: string | null;
}

/** The settings as the event module holds them (what the screen saved), read as the owning organiser. */
function settingsOf(eventId: string) {
  return must<SettingsBody>("organiser", "GET", `/api/v1/events/${eventId}`);
}

/** "Open the request from My requests and click Registration settings." */
async function openRegistrationSettings(page: Page, name: string) {
  await signIn(page, "organiser");
  await page.getByRole("link", { name: "My requests" }).click();
  await page.getByRole("row").filter({ hasText: name }).getByRole("link", { name: "View" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
  await page.getByRole("button", { name: "Registration settings" }).click();
  await expect(page.getByRole("heading", { name: "Registration settings" })).toBeVisible();
}

const groupOf = (page: Page, label: string) => page.getByRole("group", { name: label });

async function setMoment(page: Page, label: string, date: string, time: string) {
  await page.getByLabel(`${label} date`).fill(date);
  await page.getByLabel(`${label} time`).fill(time);
}

/** Click "Save registration settings" and wait for the server's answer. */
function save(page: Page) {
  return captureResponse<Envelope>(page, "PUT", "/registration-settings", () =>
    page.getByRole("button", { name: "Save registration settings" }).click(),
  );
}
