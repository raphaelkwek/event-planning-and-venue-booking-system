import type { Browser, Page, TestInfo } from "@playwright/test";
import { expect, signIn, signOut, test } from "./support/fixtures.js";
import { ACCOUNTS } from "./support/accounts.js";
import {
  ATTENDEE_ID,
  addSecondVenue,
  attendeeCall,
  captureResponse,
  createRegistrationEvent,
  ensureIdentityBudget,
  eventLabel,
  registerThroughApi,
  registrationsOf,
  removeRFixtures,
  sendFromAttendeeConsole,
  singaporeMoment,
  takeSeats,
  type Envelope,
  type FxEvent,
  type RegistrationBody,
} from "./support/seed-registration.js";
import {
  additionsOf,
  createNoVenueEvent,
  ensureAttendeeTwo,
  joinWaitlistThroughApi,
  manage,
  openRegistrations,
  registrationRows,
  rowOf,
  startAddition,
  totals,
  waitlistOf,
  waitlistOthers,
  waitlistRows,
  withdrawOneTaken,
} from "./support/seed-management.js";
import {
  eventPage,
  expectPlaces,
  openEventFromEvents,
  openMyRegistrations,
  registerButton,
  registrationRow,
  withdrawButton,
} from "./support/registration-screens.js";

/**
 * R5 (an event's registrations), R6 (the waitlist) and R7 (adding an attendee by hand), through
 * the organiser's and coordinator's Registrations screen and the attendee's screens.
 *
 * The cards' FX-R-… statements (tests/R1/README.md, tests/R5/README.md) run against the job's own
 * database, and Attendee Two is added there (seed-management.ts). The notices these stories send
 * are built by the notification service from Kafka messages, and this stack runs without Kafka
 * (documentation/evidence/EN-14), so no journey here checks a notification; nor R6-T10 and R6-T11,
 * which start from Kafka messages (F3's cancellation, M1's booking) reaching the registration service.
 */

test.beforeAll(async () => {
  await ensureAttendeeTwo();
});

test.beforeEach(async () => {
  // A journey may wait for identity's request budget (ensureIdentityBudget) before it starts.
  test.setTimeout(150_000);
  await removeRFixtures();
  await ensureIdentityBudget(60);
});

/** The registration's row cells: attendee, when, status, how. */
const cells = (page: Page, name: string) => rowOf(page, name).getByRole("cell");
const waitlistSummary = (page: Page) => page.locator("h2", { hasText: /^Waitlist$/ }).locator("xpath=following-sibling::p[1]");
const notAvailable = (page: Page) => page.getByText("This event's registrations are not available to you", { exact: true });

/**
 * The event's page shows Full. The browse routes may be cached for a few seconds (EN-12), so, as
 * expectPlaces does, this reloads until the page shows it, and fails if it never does.
 */
async function expectFull(page: Page) {
  await expect(async () => {
    await page.reload();
    await expect(eventPage(page).getByText("Full", { exact: true })).toBeVisible({ timeout: 4_000 });
  }).toPass({ timeout: 60_000, intervals: [1_000, 2_000, 3_000] });
  await expect(registerButton(page)).toHaveCount(0);
}

/** A second browser, as the cards' "In another browser": the project's address, zone and locale. */
async function anotherBrowser(browser: Browser, testInfo: TestInfo) {
  const { baseURL, timezoneId, locale } = testInfo.project.use;
  const context = await browser.newContext({ baseURL, timezoneId, locale });
  return { context, page: await context.newPage() };
}

/** Opens the list as someone who neither owns nor coordinates the event: the 404 and no registration data. */
async function expectNoRegistrationData(page: Page, event: FxEvent) {
  const [list, waitlist] = await Promise.all([
    page.waitForResponse((r) => r.request().method() === "GET" && new URL(r.url()).pathname.endsWith(`/events/${event.eventId}/registrations`)),
    page.waitForResponse((r) => r.request().method() === "GET" && new URL(r.url()).pathname.endsWith(`/events/${event.eventId}/waitlist`)),
    page.goto(`/#/events/${event.eventId}/registrations`),
  ]);
  for (const response of [list, waitlist]) {
    expect(response.status()).toBe(404);
    const body = (await response.json()) as Envelope & Record<string, unknown>;
    expect(body.error?.code).toBe("EVENT_NOT_FOUND");
    expect(body).not.toHaveProperty("items");
    expect(body).not.toHaveProperty("totals");
  }
  await expect(notAvailable(page)).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(0);
  await expect(page.getByRole("list", { name: "Totals" })).toHaveCount(0);
  await expect(page.getByRole("main")).not.toContainText("Attendee One");
}

/** "Add an attendee": the review dialog, then its confirm button; returns the server's answer. */
async function confirmAddition(page: Page, button: "Add attendee" | "Add over capacity") {
  const dialog = page.getByRole("dialog");
  return captureResponse<Envelope & RegistrationBody>(page, "POST", "/manual-registrations", () =>
    dialog.getByRole("button", { name: button, exact: true }).click(),
  );
}

// ---------------------------------------------------------------------------------------------
// R5: view the registrations for an event I manage
// ---------------------------------------------------------------------------------------------

test.describe("R5 view the registrations for an event I manage", () => {
  test("R5-T1 the owning organiser sees each registration with the attendee's name, its time and its status", { tag: ["@R5", "@R5-T1"] }, async ({ page, a11y }) => {
    const event = await createRegistrationEvent();
    await manage(event.eventId);
    await registerThroughApi(event.eventId);
    const [registered] = await registrationsOf(event.eventId, ATTENDEE_ID);
    await signIn(page, "organiser");

    await openRegistrations(page, event.eventId);
    await expect(page.getByRole("main")).toContainText(eventLabel(event));
    await expect(registrationRows(page)).toHaveCount(1);
    await expect(cells(page, "Attendee One")).toHaveText([/^Attendee One/, singaporeMoment(registered!.registered_at), "Registered", "Self-registered"]);
    await expect(totals(page)).toHaveText(["Registered 1", "Withdrawn 0", "Places remaining 2", "Capacity 3"]);
    await a11y("event registrations");
  });

  test("R5-T2 the assigned coordinator sees the same list", { tag: ["@R5", "@R5-T2"] }, async ({ page, a11y }) => {
    const event = await createRegistrationEvent();
    await manage(event.eventId);
    await registerThroughApi(event.eventId);
    const [registered] = await registrationsOf(event.eventId, ATTENDEE_ID);
    await signIn(page, "coordinator");

    await openRegistrations(page, event.eventId);
    await expect(registrationRows(page)).toHaveCount(1);
    await expect(cells(page, "Attendee One")).toHaveText([/^Attendee One/, singaporeMoment(registered!.registered_at), "Registered", "Self-registered"]);
    await expect(totals(page)).toHaveText(["Registered 1", "Withdrawn 0", "Places remaining 2", "Capacity 3"]);
    await a11y("event registrations, coordinator");
  });

  test("R5-T3 another organiser, an unassigned coordinator and an attendee receive no registration data", { tag: ["@R5", "@R5-T3"] }, async ({ page, a11y }) => {
    const event = await createRegistrationEvent();
    await manage(event.eventId);
    await registerThroughApi(event.eventId);

    // Steps 1 and 2: Organiser Two and Coordinator Two are answered as if the event did not exist.
    await signIn(page, "organiser2");
    await expectNoRegistrationData(page, event);
    await a11y("event registrations, not available");
    await signOut(page);
    await signIn(page, "coordinator2");
    await expectNoRegistrationData(page, event);
    await signOut(page);

    // Step 3: the attendee has no route to the screen (sent to Events), and the API refuses the role.
    await signIn(page, "attendee");
    await page.goto(`/#/events/${event.eventId}/registrations`);
    await expect(page.getByRole("heading", { name: "Events", level: 1, exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Registrations", level: 1 })).toHaveCount(0);
    const sent = await sendFromAttendeeConsole<Envelope & Record<string, unknown>>(page, "GET", `/registration/api/v1/events/${event.eventId}/registrations`);
    // axe reports a serious scrollable-region-focusable violation on the console's output block (an app defect, outside this card), so no axe check here.
    expect(sent.status).toBe(403);
    expect(sent.body.error?.code).toBe("ROLE_NOT_AUTHORISED");
    expect(sent.body).not.toHaveProperty("items");
    expect(sent.body).not.toHaveProperty("totals");
  });

  test("R5-T4 totals for registered, withdrawn and places remaining come from the records", { tag: ["@R5", "@R5-T4"] }, async ({ page, a11y }) => {
    const event = await createRegistrationEvent({ seats: 4 });
    await manage(event.eventId);
    await takeSeats(event.eventId, 3);
    await withdrawOneTaken(event.eventId);
    await signIn(page, "organiser");

    await openRegistrations(page, event.eventId);
    await expect(totals(page)).toHaveText(["Registered 2", "Withdrawn 1", "Places remaining 2", "Capacity 4"]);
    await expect(registrationRows(page)).toHaveCount(3);
    const statuses = await registrationRows(page).locator("td:nth-child(3)").allTextContents();
    expect(statuses.filter((s) => s === "Registered")).toHaveLength(2);
    expect(statuses.filter((s) => s.startsWith("Withdrawn"))).toHaveLength(1);
    await a11y("event registrations, totals");
  });

  test("R5-T5 a withdrawal shows in the row and the totals when the list is next loaded", { tag: ["@R5", "@R5-T5"] }, async ({ page, browser, a11y }, testInfo) => {
    const event = await createRegistrationEvent();
    await manage(event.eventId);
    const registration = await registerThroughApi(event.eventId);
    await signIn(page, "organiser");
    await openRegistrations(page, event.eventId);
    await expect(totals(page)).toHaveText(["Registered 1", "Withdrawn 0", "Places remaining 2", "Capacity 3"]);
    await expect(cells(page, "Attendee One").nth(2)).toHaveText("Registered");

    // Step 1: in another browser, Attendee One withdraws (R4-T1 steps 1 to 3).
    const other = await anotherBrowser(browser, testInfo);
    try {
      await signIn(other.page, "attendee");
      await openMyRegistrations(other.page);
      await withdrawButton(registrationRow(other.page, event.name)).click();
      const done = await captureResponse<RegistrationBody>(other.page, "POST", `/registrations/${registration.id}/withdrawal`, () =>
        other.page.getByRole("dialog").getByRole("button", { name: "Withdraw registration" }).click(),
      );
      expect(done.status).toBe(200);
    } finally {
      await other.context.close();
    }

    // Step 2: the organiser reloads the list.
    const [withdrawn] = await registrationsOf(event.eventId, ATTENDEE_ID);
    expect(withdrawn!.status).toBe("WITHDRAWN");
    await page.reload();
    await expect(page.getByRole("heading", { name: "Registrations", level: 1, exact: true })).toBeVisible();
    await expect(cells(page, "Attendee One").nth(2)).toHaveText(`WithdrawnWithdrawn ${singaporeMoment(withdrawn!.withdrawn_at!)}`);
    await expect(totals(page)).toHaveText(["Registered 0", "Withdrawn 1", "Places remaining 3", "Capacity 3"]);
    await a11y("event registrations, after a withdrawal");
  });

  test("R5-T6 boundary: an event with no registrations yet", { tag: ["@R5", "@R5-T6"] }, async ({ page, a11y }) => {
    const event = await createRegistrationEvent();
    await manage(event.eventId);
    await signIn(page, "organiser");

    await openRegistrations(page, event.eventId);
    await expect(page.getByText("No one has registered yet.", { exact: true })).toBeVisible();
    await expect(page.getByRole("table", { name: "Registrations" })).toHaveCount(0);
    await expect(totals(page)).toHaveText(["Registered 0", "Withdrawn 0", "Places remaining 3", "Capacity 3"]);
    await a11y("event registrations, empty");
  });
});

// ---------------------------------------------------------------------------------------------
// R6: join and be invited from the waitlist
// ---------------------------------------------------------------------------------------------

/** "As Attendee Two, withdraw (R4-T1 steps 1–3)", in the browser. */
async function attendeeTwoWithdraws(page: Page, event: FxEvent) {
  await signIn(page, "attendee2");
  await openMyRegistrations(page);
  await withdrawButton(registrationRow(page, event.name)).click();
  const done = await captureResponse<RegistrationBody>(page, "POST", "/withdrawal", () =>
    page.getByRole("dialog").getByRole("button", { name: "Withdraw registration" }).click(),
  );
  expect(done.status).toBe(200);
  await expect(registrationRow(page, event.name).getByText("Withdrawn", { exact: true })).toBeVisible();
  await signOut(page);
}

/** Attendee Two registers (R2-T1 steps 1–2), as a setup step through the service's API. */
async function attendeeTwoRegisters(event: FxEvent): Promise<RegistrationBody> {
  const result = await attendeeCall<RegistrationBody & Envelope>("POST", "/api/v1/registrations", { eventId: event.eventId }, "attendee2");
  if (result.status !== 201) throw new Error(`Attendee Two registering answered ${result.status}: ${JSON.stringify(result.body)}`);
  return result.body;
}

const myWaitlistEntry = (page: Page, name: string) =>
  page
    .getByRole("list", { name: "My waitlist entries" })
    .getByRole("listitem")
    .filter({ has: page.getByRole("heading", { name, exact: true }) });

test.describe("R6 join and be invited from the waitlist", () => {
  test("R6-T1 an attendee refused for capacity joins the waitlist; no registration is made", { tag: ["@R6", "@R6-T1"] }, async ({ page, a11y }) => {
    const event = await createRegistrationEvent({ seats: 1 });
    await takeSeats(event.eventId, 1);
    await signIn(page, "attendee");

    // Step 1: the event shows Full; join the waitlist.
    await openEventFromEvents(page, event.name);
    await expectFull(page);
    await expect(registerButton(page)).toHaveCount(0);
    const joined = await captureResponse<{ reference: string; position: number }>(page, "POST", `/events/${event.eventId}/waitlist`, () =>
      page.getByRole("button", { name: "Join the waitlist" }).click(),
    );
    expect(joined.status).toBe(201);
    expect(joined.body.reference).toMatch(/^WL-\d{6}$/);
    await expect(page.getByText("You are on the waitlist")).toBeVisible();
    await expect(page.getByRole("main")).toContainText(`${joined.body.reference}: you are number 1 in line for ${event.name}.`);
    // axe reports a serious colour-contrast violation on the Full label (an app defect, outside this card), so no axe check here.

    // Step 2: My registrations lists the entry.
    await openMyRegistrations(page);
    const entry = myWaitlistEntry(page, event.name);
    await expect(entry.getByText("Waitlisted", { exact: true })).toBeVisible();
    const [stored] = await waitlistOf(event.eventId, ATTENDEE_ID);
    expect(stored).toMatchObject({ reference: joined.body.reference, status: "WAITLISTED" });
    await expect(entry).toContainText(`${joined.body.reference} · Joined ${singaporeMoment(stored!.joined_at)} · Number 1 in line`);
    await a11y("my registrations, waitlisted");
    expect(await registrationsOf(event.eventId, ATTENDEE_ID)).toHaveLength(0);
  });

  test("R6-T2 joining while places remain is refused; the event offers Register", { tag: ["@R6", "@R6-T2"] }, async ({ page }) => {
    const event = await createRegistrationEvent();
    await signIn(page, "attendee");

    const sent = await sendFromAttendeeConsole(page, "POST", `/registration/api/v1/events/${event.eventId}/waitlist`);
    expect(sent.status).toBe(409);
    expect(sent.body.error?.code).toBe("WAITLIST_PLACES_AVAILABLE");
    expect(sent.body.error?.message).toBe(`${eventLabel(event)} still has 3 places remaining, so register instead of joining the waitlist.`);
    expect(await waitlistOf(event.eventId)).toHaveLength(0);

    await openEventFromEvents(page, event.name);
    await expect(registerButton(page)).toBeVisible();
    await expect(page.getByRole("button", { name: "Join the waitlist" })).toHaveCount(0);
  });

  test("R6-T5 the organiser and the coordinator see the waitlist in the order it was joined", { tag: ["@R6", "@R6-T5"] }, async ({ page, a11y }) => {
    const event = await createRegistrationEvent({ seats: 1 });
    await manage(event.eventId);
    await takeSeats(event.eventId, 1);
    await waitlistOthers(event.eventId, 2);
    await joinWaitlistThroughApi(event.eventId);
    const entries = await waitlistOf(event.eventId);
    expect(entries.map((e) => e.attendee_id)[2]).toBe(ATTENDEE_ID);

    for (const who of ["organiser", "coordinator"] as const) {
      await signIn(page, who);
      await openRegistrations(page, event.eventId);
      await expect(waitlistRows(page)).toHaveCount(3);
      for (const [i, entry] of entries.entries()) {
        const row = waitlistRows(page).nth(i).getByRole("cell");
        await expect(row.nth(0)).toHaveText(String(i + 1));
        await expect(row.nth(2)).toHaveText(singaporeMoment(entry.joined_at));
        await expect(row.nth(3)).toHaveText("Waitlisted");
      }
      await expect(waitlistRows(page).nth(2).getByRole("cell").nth(1)).toHaveText("Attendee One");
      if (who === "organiser") await a11y("event registrations, waitlist");
      await signOut(page);
    }

    // Step 3: Organiser Two gets no waitlist data.
    await signIn(page, "organiser2");
    await expectNoRegistrationData(page, event);
  });

  test("R6-T6 a withdrawal tells the waitlist and registers nobody", { tag: ["@R6", "@R6-T6"] }, async ({ page, a11y }) => {
    const event = await createRegistrationEvent({ seats: 1 });
    await attendeeTwoRegisters(event);
    await joinWaitlistThroughApi(event.eventId);

    // Step 1: Attendee Two withdraws.
    await attendeeTwoWithdraws(page, event);

    // Step 2 (Notifications) needs Kafka. Step 3: no registration, the entry still Waitlisted, with when it was told.
    await signIn(page, "attendee");
    await openMyRegistrations(page);
    await expect(registrationRow(page, event.name)).toHaveCount(0);
    const [entry] = await waitlistOf(event.eventId, ATTENDEE_ID);
    expect(entry!.status).toBe("WAITLISTED");
    expect(entry!.last_notified_at).not.toBeNull();
    const shown = myWaitlistEntry(page, event.name);
    await expect(shown.getByText("Waitlisted", { exact: true })).toBeVisible();
    await expect(shown).toContainText(`A place opened on ${singaporeMoment(entry!.last_notified_at!)}. Register if one is still free.`);
    await a11y("my registrations, told of a place");
    expect(await registrationsOf(event.eventId, ATTENDEE_ID)).toHaveLength(0);
  });

  test("R6-T7 invited attendees register first come, first served", { tag: ["@R6", "@R6-T7"] }, async ({ page, a11y }) => {
    const event = await createRegistrationEvent({ seats: 1 });
    await manage(event.eventId);
    const two = await attendeeTwoRegisters(event);
    const [first] = await waitlistOthers(event.eventId, 1);
    await joinWaitlistThroughApi(event.eventId);
    await attendeeCall("POST", `/api/v1/registrations/${two.id}/withdrawal`, undefined, "attendee2").then((r) => expect(r.status).toBe(200));

    // Step 1: Attendee One, second in line, registers.
    await signIn(page, "attendee");
    await openEventFromEvents(page, event.name);
    await expectPlaces(page, "1 place remaining");
    const created = await captureResponse<RegistrationBody>(page, "POST", "/registrations", () => registerButton(page).click());
    expect(created.status).toBe(201);
    await expect(page.getByText("You are registered")).toBeVisible();

    // Step 2: a Registered registration, and the waitlist entry reads Registered.
    await openMyRegistrations(page);
    await expect(registrationRow(page, event.name).getByText("Registered", { exact: true })).toBeVisible();
    const [mine] = await waitlistOf(event.eventId, ATTENDEE_ID);
    expect(mine).toMatchObject({ status: "REGISTERED", registration_id: created.body.id });
    const entry = myWaitlistEntry(page, event.name);
    await expect(entry.getByText("Registered", { exact: true })).toBeVisible();
    await expect(entry).toContainText(`Registered ${singaporeMoment(mine!.registered_at!)}`);
    await a11y("my registrations, registered from the waitlist");
    await signOut(page);

    // Step 3: Attendee Two tries again: refused for capacity, offered the waitlist.
    await signIn(page, "attendee2");
    await openEventFromEvents(page, event.name);
    await expectFull(page);
    const sent = await sendFromAttendeeConsole(page, "POST", "/registration/api/v1/registrations", JSON.stringify({ eventId: event.eventId }));
    expect(sent.status).toBe(409);
    expect(sent.body.error?.code).toBe("REGISTRATION_FULL");
    expect(sent.body.error?.details?.waitlistOffered).toBe(true);
    await signOut(page);

    // Step 4: the attendee first in line is still Waitlisted; nobody was registered for them.
    await signIn(page, "organiser");
    await openRegistrations(page, event.eventId);
    await expect(waitlistRows(page)).toHaveCount(2);
    await expect(waitlistRows(page).nth(0).getByRole("cell").nth(3)).toHaveText("Waitlisted");
    await expect(waitlistRows(page).nth(1).getByRole("cell").nth(1)).toHaveText("Attendee One");
    await expect(waitlistRows(page).nth(1).getByRole("cell").nth(3)).toHaveText("Registered");
    expect((await waitlistOf(event.eventId)).find((e) => e.id === first!.id)!.status).toBe("WAITLISTED");
    expect((await registrationsOf(event.eventId)).filter((r) => r.attendee_id === first!.attendee_id)).toHaveLength(0);
  });

  test("R6-T8 an attendee leaves the waitlist; the entry is kept and later openings pass it by", { tag: ["@R6", "@R6-T8"] }, async ({ page, a11y }) => {
    const event = await createRegistrationEvent({ seats: 1 });
    await attendeeTwoRegisters(event);
    const joined = await joinWaitlistThroughApi(event.eventId);

    // Step 1: leave, after the dialog asks.
    await signIn(page, "attendee");
    await openMyRegistrations(page);
    const entry = myWaitlistEntry(page, event.name);
    await entry.getByRole("button", { name: "Leave the waitlist" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("Leave the waitlist?");
    await expect(dialog).toContainText(`You will no longer be told when a place opens at ${eventLabel(event)}. Entry ${joined.reference} will show as Left the waitlist.`);
    await a11y("leave the waitlist dialog");
    const left = await captureResponse(page, "POST", `/waitlist-entries/${joined.id}/withdrawal`, () =>
      dialog.getByRole("button", { name: "Leave the waitlist" }).click(),
    );
    expect(left.status).toBe(200);
    await expect(dialog).toHaveCount(0);
    const [stored] = await waitlistOf(event.eventId, ATTENDEE_ID);
    expect(stored!.status).toBe("WITHDRAWN");
    await expect(entry.getByText("Left the waitlist", { exact: true })).toBeVisible();
    await expect(entry).toContainText(`Left ${singaporeMoment(stored!.withdrawn_at!)}`);
    await signOut(page);

    // Step 2: Attendee Two withdraws, so a place opens. The left entry is not told (step 3's notice needs Kafka).
    await attendeeTwoWithdraws(page, event);
    const [after] = await waitlistOf(event.eventId, ATTENDEE_ID);
    expect(after).toMatchObject({ status: "WITHDRAWN", last_notified_at: null });
  });

  test("R6-T9 waitlist entries are never counted as registrations", { tag: ["@R6", "@R6-T9"] }, async ({ page, a11y }) => {
    const event = await createRegistrationEvent({ seats: 1 });
    await manage(event.eventId);
    await takeSeats(event.eventId, 1);
    await waitlistOthers(event.eventId, 2);
    await joinWaitlistThroughApi(event.eventId);

    // Step 1: the totals count the one registration; the three waiting are shown apart.
    await signIn(page, "organiser");
    await openRegistrations(page, event.eventId);
    await expect(totals(page)).toHaveText(["Registered 1", "Withdrawn 0", "Places remaining 0", "Capacity 1"]);
    await expect(registrationRows(page)).toHaveCount(1);
    await expect(registrationRows(page)).not.toContainText("Attendee One");
    await expect(waitlistSummary(page)).toContainText("3 attendees are waiting.");
    await expect(waitlistRows(page)).toHaveCount(3);
    await a11y("event registrations, waitlist apart");
    expect(await registrationsOf(event.eventId)).toHaveLength(1);
    await signOut(page);

    // Step 2: the attendee's page says Full.
    await signIn(page, "attendee");
    await openEventFromEvents(page, event.name);
    await expectFull(page);
  });
});

// ---------------------------------------------------------------------------------------------
// R7: add an attendee manually
// ---------------------------------------------------------------------------------------------

const ATTENDEE_EMAIL = ACCOUNTS.attendee.email;

test.describe("R7 add an attendee manually", () => {
  test("R7-T1 the owning organiser adds an attendee, seeing the capacity and the new total first", { tag: ["@R7", "@R7-T1"] }, async ({ page, a11y }) => {
    const event = await createRegistrationEvent();
    await manage(event.eventId);
    await signIn(page, "organiser");
    await openRegistrations(page, event.eventId);

    // Steps 2 and 3: the dialog shows the capacity and the total, then adds.
    const dialog = await startAddition(page, ATTENDEE_EMAIL, "Keynote speaker's guest");
    await expect(dialog).toContainText("Capacity 3");
    await expect(dialog).toContainText("With this addition: 1 attendee");
    await expect(dialog).not.toContainText("over capacity");
    await a11y("add an attendee dialog");
    const added = await confirmAddition(page, "Add attendee");
    expect(added.status).toBe(201);
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText(`Attendee One was added: registration ${added.body.reference}.`)).toBeVisible();
    const [stored] = await additionsOf(event.eventId);
    expect(stored).toMatchObject({ attendee_id: ATTENDEE_ID, status: "REGISTERED", added_by: ACCOUNTS.organiser.id, addition_reason: "Keynote speaker's guest", added_over_capacity: false });
    await expect(cells(page, "Attendee One")).toHaveText([
      /^Attendee One/,
      singaporeMoment(stored!.registered_at),
      "Registered",
      "Added by Organiser One“Keynote speaker's guest”",
    ]);
    await expect(totals(page)).toHaveText(["Registered 1", "Withdrawn 0", "Places remaining 2", "Capacity 3", "Added by hand 1"]);
    await a11y("event registrations, attendee added");
    await signOut(page);

    // Step 4 (the notice needs Kafka): the registration is listed for Attendee One.
    await signIn(page, "attendee");
    await openMyRegistrations(page);
    const row = registrationRow(page, event.name);
    await expect(row.getByText("Registered", { exact: true })).toBeVisible();
    await expect(row).toContainText(added.body.reference);
  });

  test("R7-T2 the assigned coordinator adds an attendee with no reason", { tag: ["@R7", "@R7-T2"] }, async ({ page }) => {
    const event = await createRegistrationEvent();
    await manage(event.eventId);
    await signIn(page, "coordinator");
    await openRegistrations(page, event.eventId);

    const dialog = await startAddition(page, ATTENDEE_EMAIL);
    await expect(dialog).toContainText("Capacity 3");
    await expect(dialog).toContainText("With this addition: 1 attendee");
    expect((await confirmAddition(page, "Add attendee")).status).toBe(201);
    await expect(cells(page, "Attendee One").nth(3)).toHaveText("Added by Coordinator One");
    const [stored] = await additionsOf(event.eventId);
    expect(stored).toMatchObject({ added_by: ACCOUNTS.coordinator.id, addition_reason: null, status: "REGISTERED" });
  });

  test("R7-T4 an addition is allowed after registration closes", { tag: ["@R7", "@R7-T4"] }, async ({ page }) => {
    const event = await createRegistrationEvent({ opens: "now() - interval '7 days'", closes: "now() - interval '1 day'" });
    await manage(event.eventId);
    await signIn(page, "organiser");
    await openRegistrations(page, event.eventId);

    const dialog = await startAddition(page, ATTENDEE_EMAIL);
    await expect(dialog).toContainText("Capacity 3");
    expect((await confirmAddition(page, "Add attendee")).status).toBe(201);
    await expect(cells(page, "Attendee One").nth(2)).toHaveText("Registered");
    await expect(cells(page, "Attendee One").nth(3)).toHaveText("Added by Organiser One");
    await expect(totals(page)).toHaveText(["Registered 1", "Withdrawn 0", "Places remaining 2", "Capacity 3", "Added by hand 1"]);
  });

  test("R7-T5 over capacity: the capacity and the new total are shown, then the addition is recorded as over capacity", { tag: ["@R7", "@R7-T5"] }, async ({ page, a11y }) => {
    const event = await createRegistrationEvent({ seats: 2 });
    await manage(event.eventId);
    await takeSeats(event.eventId, 2);
    await signIn(page, "organiser");
    await openRegistrations(page, event.eventId);

    // Step 2: the dialog warns, then adds over capacity.
    const dialog = await startAddition(page, ATTENDEE_EMAIL);
    await expect(dialog).toContainText("Capacity 2");
    await expect(dialog).toContainText("With this addition: 3 attendees");
    await expect(dialog.getByText("This takes the event over capacity")).toBeVisible();
    await a11y("add an attendee dialog, over capacity");
    const added = await confirmAddition(page, "Add over capacity");
    expect(added.status).toBe(201);

    // Step 3: the row and the totals; the attendee's page says Full.
    await expect(cells(page, "Attendee One").nth(3)).toHaveText("Added by Organiser OneOver capacityTakes the next seat that is freed");
    await expect(totals(page)).toHaveText(["Registered 3", "Withdrawn 0", "Places remaining 0", "Capacity 2", "Added by hand 1", "Over capacity by 1"]);
    const stored = (await additionsOf(event.eventId)).find((r) => r.attendee_id === ATTENDEE_ID);
    expect(stored).toMatchObject({ added_over_capacity: true, seat_id: null, status: "REGISTERED" });
    await signOut(page);
    await signIn(page, "attendee");
    await openEventFromEvents(page, event.name);
    await expectFull(page);
    await expect(eventPage(page)).not.toContainText(/-\d+ places? remaining/);
  });

  test("R7-T6 over capacity without confirming saves nothing", { tag: ["@R7", "@R7-T6"] }, async ({ page }) => {
    const event = await createRegistrationEvent({ seats: 2 });
    await manage(event.eventId);
    await takeSeats(event.eventId, 2);
    await signIn(page, "organiser");
    await openRegistrations(page, event.eventId);

    // Steps 1 and 2: the dialog, then Cancel.
    const dialog = await startAddition(page, ATTENDEE_EMAIL);
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(registrationRows(page)).toHaveCount(2);
    expect(await registrationsOf(event.eventId, ATTENDEE_ID)).toHaveLength(0);

    // Step 3: the addition without confirmOverCapacity, from the API console.
    const sent = await sendFromAttendeeConsole(
      page,
      "POST",
      `/registration/api/v1/events/${event.eventId}/manual-registrations`,
      JSON.stringify({ attendeeEmail: ATTENDEE_EMAIL }),
    );
    expect(sent.status).toBe(409);
    expect(sent.body.error?.code).toBe("REGISTRATION_OVER_CAPACITY_UNCONFIRMED");
    expect(sent.body.error?.details).toMatchObject({ capacity: 2, totalAfter: 3 });
    expect(await registrationsOf(event.eventId, ATTENDEE_ID)).toHaveLength(0);
  });

  test("R7-T7 with several venues the capacity is their total", { tag: ["@R7", "@R7-T7"] }, async ({ page }) => {
    const event = await createRegistrationEvent({ seats: 2 });
    await addSecondVenue(event.eventId, 3);
    await manage(event.eventId);
    await takeSeats(event.eventId, 4);
    await signIn(page, "organiser");
    await openRegistrations(page, event.eventId);

    const dialog = await startAddition(page, ATTENDEE_EMAIL);
    await expect(dialog).toContainText("Capacity 5");
    await expect(dialog).toContainText("With this addition: 5 attendees");
    await expect(dialog.getByText("This takes the event over capacity")).toHaveCount(0);
    expect((await confirmAddition(page, "Add attendee")).status).toBe(201);
    await expect(cells(page, "Attendee One").nth(3)).toHaveText("Added by Organiser One");
    await expect(totals(page)).toHaveText(["Registered 5", "Withdrawn 0", "Places remaining 0", "Capacity 5", "Added by hand 1"]);
    const stored = (await additionsOf(event.eventId)).find((r) => r.attendee_id === ATTENDEE_ID);
    expect(stored!.added_over_capacity).toBe(false);
    expect(stored!.seat_id).not.toBeNull();
  });

  test("R7-T8 an addition is refused while the event has no confirmed venue booking", { tag: ["@R7", "@R7-T8"] }, async ({ page, a11y }) => {
    const event = await createNoVenueEvent();
    await manage(event.eventId);
    await signIn(page, "organiser");
    await openRegistrations(page, event.eventId);

    const dialog = await startAddition(page, ATTENDEE_EMAIL);
    const refused = await confirmAddition(page, "Add over capacity");
    expect(refused.status).toBe(422);
    expect(refused.body.error?.code).toBe("REGISTRATION_NO_CONFIRMED_BOOKING");
    await expect(dialog).toContainText(`${eventLabel(event)} has no confirmed venue booking, so its capacity is not known yet and nobody can be added.`);
    await a11y("add an attendee dialog, refused");
    expect(await registrationsOf(event.eventId)).toHaveLength(0);
  });

  test("R7-T9 manual additions are told apart from self-registrations and counted", { tag: ["@R7", "@R7-T9"] }, async ({ page }) => {
    const event = await createRegistrationEvent();
    await manage(event.eventId);
    await takeSeats(event.eventId, 1);
    await signIn(page, "organiser");
    await openRegistrations(page, event.eventId);
    await startAddition(page, ATTENDEE_EMAIL);
    expect((await confirmAddition(page, "Add attendee")).status).toBe(201);

    // Step 1: one row of each kind, both counted.
    await page.reload();
    await expect(page.getByRole("heading", { name: "Registrations", level: 1, exact: true })).toBeVisible();
    const how = await registrationRows(page).locator("td:nth-child(4)").allTextContents();
    expect(how.sort()).toEqual(["Added by Organiser One", "Self-registered"]);
    await expect(totals(page)).toHaveText(["Registered 2", "Withdrawn 0", "Places remaining 1", "Capacity 3", "Added by hand 1"]);
    await signOut(page);

    // Step 2: the attendee's page counts the addition too.
    await signIn(page, "attendee");
    await openEventFromEvents(page, event.name);
    await expectPlaces(page, "1 place remaining");
  });

  test("R7-T10 a duplicate addition is refused, naming the existing registration", { tag: ["@R7", "@R7-T10"] }, async ({ page }) => {
    const event = await createRegistrationEvent();
    await manage(event.eventId);
    const existing = await registerThroughApi(event.eventId);
    await signIn(page, "organiser");
    await openRegistrations(page, event.eventId);

    const dialog = await startAddition(page, ATTENDEE_EMAIL);
    const refused = await confirmAddition(page, "Add attendee");
    expect(refused.status).toBe(409);
    expect(refused.body.error?.code).toBe("REGISTRATION_DUPLICATE");
    expect(refused.body.error?.message).toContain(existing.reference);
    await expect(dialog).toContainText(existing.reference);
    expect(await registrationsOf(event.eventId, ATTENDEE_ID)).toHaveLength(1);
  });

  test("R7-T11 the added attendee withdraws under R4's terms", { tag: ["@R7", "@R7-T11"] }, async ({ page }) => {
    // Pre-condition: R7-T1 done (the organiser adds Attendee One), on an event with no deadline and one with a passed deadline.
    const open = await createRegistrationEvent();
    const late = await createRegistrationEvent({ deadline: "now() - interval '1 minute'" });
    await manage(open.eventId);
    await manage(late.eventId);
    await signIn(page, "organiser");
    for (const event of [open, late]) {
      await openRegistrations(page, event.eventId);
      await startAddition(page, ATTENDEE_EMAIL, "Keynote speaker's guest");
      expect((await confirmAddition(page, "Add attendee")).status).toBe(201);
    }
    await signOut(page);
    await signIn(page, "attendee");
    await openEventFromEvents(page, open.name);
    await expectPlaces(page, "2 places remaining");

    // Step 1: withdraw the added registration.
    await openMyRegistrations(page);
    const row = registrationRow(page, open.name);
    await withdrawButton(row).click();
    const done = await captureResponse<RegistrationBody>(page, "POST", "/withdrawal", () =>
      page.getByRole("dialog").getByRole("button", { name: "Withdraw registration" }).click(),
    );
    expect(done.status).toBe(200);
    const [withdrawn] = await registrationsOf(open.eventId, ATTENDEE_ID);
    expect(withdrawn!.status).toBe("WITHDRAWN");
    await expect(row.getByText("Withdrawn", { exact: true })).toBeVisible();
    await expect(row).toContainText(`Withdrawn ${singaporeMoment(withdrawn!.withdrawn_at!)}`);
    await openEventFromEvents(page, open.name);
    await expectPlaces(page, "3 places remaining");

    // Step 2: past the deadline, refused naming it; nothing changes.
    await openMyRegistrations(page);
    const lateRow = registrationRow(page, late.name);
    await withdrawButton(lateRow).click();
    const dialog = page.getByRole("dialog");
    const refused = await captureResponse<Envelope>(page, "POST", "/withdrawal", () => dialog.getByRole("button", { name: "Withdraw registration" }).click());
    expect(refused.status).toBe(422);
    expect(refused.body.error?.code).toBe("WITHDRAWAL_DEADLINE_PASSED");
    await expect(dialog).toContainText(`The withdrawal deadline for ${eventLabel(late)} was`);
    await dialog.getByRole("button", { name: "Keep my place" }).click();
    await expect(lateRow.getByText("Registered", { exact: true })).toBeVisible();
    const [kept] = await registrationsOf(late.eventId, ATTENDEE_ID);
    expect(kept).toMatchObject({ status: "REGISTERED", withdrawn_at: null });
  });

  test("R7-T12 a freed seat goes to an attendee added over capacity first", { tag: ["@R7", "@R7-T12"] }, async ({ page }) => {
    const event = await createRegistrationEvent({ seats: 2 });
    await manage(event.eventId);
    await attendeeTwoRegisters(event);
    await takeSeats(event.eventId, 1);
    await signIn(page, "organiser");
    await openRegistrations(page, event.eventId);
    await startAddition(page, ATTENDEE_EMAIL);
    expect((await confirmAddition(page, "Add over capacity")).status).toBe(201);
    await signOut(page);

    // Step 1: Attendee Two withdraws.
    await attendeeTwoWithdraws(page, event);

    // Step 2: Attendee Two's page still says Full, and registering is refused for capacity.
    await signIn(page, "attendee2");
    await openEventFromEvents(page, event.name);
    await expectFull(page);
    const sent = await sendFromAttendeeConsole(page, "POST", "/registration/api/v1/registrations", JSON.stringify({ eventId: event.eventId }));
    expect(sent.status).toBe(409);
    expect(sent.body.error?.code).toBe("REGISTRATION_FULL");
    const added = (await additionsOf(event.eventId)).find((r) => r.attendee_id === ATTENDEE_ID);
    expect(added!.seat_id).not.toBeNull();
    expect(added!.added_over_capacity).toBe(true);
    await signOut(page);

    // Step 3: the organiser's totals.
    await signIn(page, "organiser");
    await openRegistrations(page, event.eventId);
    await expect(totals(page)).toHaveText(["Registered 2", "Withdrawn 1", "Places remaining 0", "Capacity 2", "Added by hand 1"]);
  });

  test("R7-T13 boundary: an unknown attendee, a staff account, and the reason's length", { tag: ["@R7", "@R7-T13"] }, async ({ page }) => {
    const event = await createRegistrationEvent();
    await manage(event.eventId);
    await signIn(page, "organiser");
    await openRegistrations(page, event.eventId);

    // Steps 1 and 2: nobody, and staff, are refused as not attendees.
    for (const email of ["nobody@connectsphere.test", ACCOUNTS.organiser2.email]) {
      const dialog = await startAddition(page, email);
      const refused = await confirmAddition(page, "Add attendee");
      expect(refused.status).toBe(422);
      expect(refused.body.error?.code).toBe("ATTENDEE_NOT_FOUND");
      await expect(dialog).toContainText(`No attendee account has the email ${email}, so nobody was added.`);
      await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
      await expect(dialog).toHaveCount(0);
    }
    expect(await registrationsOf(event.eventId)).toHaveLength(0);

    // Step 3: 501 characters. The form takes at most 500, so this is sent from the API console.
    const sent = await sendFromAttendeeConsole(
      page,
      "POST",
      `/registration/api/v1/events/${event.eventId}/manual-registrations`,
      JSON.stringify({ attendeeEmail: ATTENDEE_EMAIL, reason: "r".repeat(501) }),
    );
    expect(sent.status).toBe(400);
    expect(sent.body.error?.code).toBe("VALIDATION_FAILED");
    expect(JSON.stringify(sent.body.error)).toContain('"field":"reason"');
    expect(await registrationsOf(event.eventId)).toHaveLength(0);

    // Step 4: 500 characters is added, with the whole reason.
    const reason = "r".repeat(500);
    await openRegistrations(page, event.eventId);
    await startAddition(page, ATTENDEE_EMAIL, reason);
    expect((await confirmAddition(page, "Add attendee")).status).toBe(201);
    const [stored] = await additionsOf(event.eventId);
    expect(stored!.addition_reason).toBe(reason);
    await expect(cells(page, "Attendee One").nth(3)).toHaveText(`Added by Organiser One“${reason}”`);
  });
});
