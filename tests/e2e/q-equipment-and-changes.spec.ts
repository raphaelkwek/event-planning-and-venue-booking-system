import type { Locator, Page } from "@playwright/test";
import { expect, signIn, signOut, test, uniqueName } from "./support/fixtures.js";
import { call, must } from "./support/api.js";
import { query } from "./support/seed-events.js";
import { MOVED_START, plannedEvent, runCardFixture, wirelessMicrophone, type PlannedEvent } from "./support/seed-equipment-changes.js";
import { eventBookings } from "./support/seed-venues.js";
import { deliverOutbox } from "./support/deliver.js";
import { messageOf, openNotifications } from "./support/notifications.js";

/**
 * P1 (equipment availability), P2 (the inventory's reduction boundary, audit trail and access) and
 * G2 (what a pending change would affect), through the real screens, on the SQL fixtures the cards
 * name (tests/P1/fixtures, tests/P2/fixtures) and FX-G2 built through the API.
 *
 * S3-T13 ends on notifications, which the notification service builds from Kafka messages; this
 * stack runs without Kafka, so the journey hands the approval's message to the notification
 * service itself (support/deliver.ts). S1-T13 and S2-T12 are in s-changes.spec.ts, Q1-T14 in
 * o-equipment.spec.ts.
 */

const row = (page: Page, text: string) => page.getByRole("row").filter({ hasText: text });
/** The total-quantity cell of an inventory row (Name, Kind, Tracking, Total, …), as P2-T2 reads it. */
const totalCell = (page: Page, name: string) => row(page, name).getByRole("cell").nth(3);

async function openInventory(page: Page) {
  await page.getByRole("link", { name: "Equipment", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Equipment inventory" })).toBeVisible();
}

async function openMaintainScreen(page: Page, name: string) {
  await row(page, name).getByRole("link", { name: "Maintain" }).click();
  await expect(page.getByRole("heading", { name: "Maintain equipment type" })).toBeVisible();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(name);
}

/** The server's answer to the Save click, so a repeated "Equipment type saved." can't be the previous one. */
function waitForSave(page: Page, typeId?: string) {
  return page.waitForResponse(
    (response) =>
      response.request().method() === (typeId ? "PUT" : "POST") &&
      /\/equipment\/api\/v1\/equipment\/types(\/|$)/.test(new URL(response.url()).pathname) &&
      (typeId ? response.url().includes(typeId) : true),
  );
}

test.describe("P1 equipment availability", () => {
  const TYPE_ID = "ae111111-0000-0000-0000-000000000014";
  const TYPE_NAME = "P1 Demo Conference Chairs";

  async function check(page: Page, quantity: number) {
    await page.getByLabel("Requested quantity").fill(String(quantity));
    const answered = page.waitForResponse((response) => response.url().includes("/availability?"));
    await page.getByRole("button", { name: "Check availability" }).click();
    const response = await answered;
    return { url: new URL(response.url()), status: response.status(), body: (await response.json()) as Record<string, unknown> };
  }

  async function expectAnswer(
    page: Page,
    answer: Awaited<ReturnType<typeof check>>,
    quantity: number,
  ) {
    const shortfall = Math.max(0, quantity - 5);
    // The request names the chosen type and the window: 18:00 to 22:00 Singapore time is 10:00Z to 14:00Z.
    expect(answer.url.pathname).toBe(`/equipment/api/v1/equipment/types/${TYPE_ID}/availability`);
    expect(answer.url.searchParams.get("startsAt")).toBe("2026-12-15T10:00:00.000Z");
    expect(answer.url.searchParams.get("endsAt")).toBe("2026-12-15T14:00:00.000Z");
    expect(answer.url.searchParams.get("requestedQuantity")).toBe(String(quantity));
    expect(answer.status).toBe(200);
    expect(answer.body).toMatchObject({ equipmentTypeId: TYPE_ID, availableQuantity: 5, shortfallQuantity: shortfall, requestedQuantity: quantity });
    await expect(page.getByText("Available quantity: 5")).toBeVisible();
    await expect(page.getByText(`Shortfall quantity: ${shortfall}`)).toBeVisible();
  }

  test("P1-T14 a signed-in technical support user sees the numeric result of peak usage and repeated checks agree", { tag: ["@P1", "@P1-T14"] }, async ({ page, a11y }) => {
    // Pre-condition 3: the card's fixture, run immediately before the case.
    await runCardFixture("P1/fixtures/ui-availability.sql");
    await signIn(page, "techsupport");

    // Steps 1 to 3.
    await page.getByRole("link", { name: "Equipment availability" }).click();
    await expect(page.getByRole("heading", { name: "Equipment availability" })).toBeVisible();
    await a11y("equipment availability");
    await page.getByLabel("Equipment type").selectOption({ label: TYPE_NAME });
    await page.getByLabel("Starts at (local time)").fill("2026-12-15T18:00");
    await page.getByLabel("Ends at (local time)").fill("2026-12-15T22:00");

    // Step 4: 6 requested.
    const first = await check(page, 6);
    await expectAnswer(page, first, 6);
    await a11y("equipment availability, result");

    // Step 5: 5 requested.
    const second = await check(page, 5);
    await expectAnswer(page, second, 5);

    // Step 6: back to 6, and the same result again.
    const third = await check(page, 6);
    await expectAnswer(page, third, 6);
    expect(third.body).toEqual(first.body);

    // Nothing was reserved or changed by checking.
    const reservations = await query<{ event_reference: string; quantity: number; status: string }>(
      "select event_reference, quantity, status from equipment.bulk_reservations where equipment_type_id = $1 order by event_reference",
      [TYPE_ID],
    );
    expect(reservations.map((reservation) => ({ ...reservation }))).toEqual([
      { event_reference: "EVT-P1-DEMO-A", quantity: 4, status: "RESERVED" },
      { event_reference: "EVT-P1-DEMO-B", quantity: 5, status: "RESERVED" },
    ]);
    const [type] = await query<{ total_quantity: number }>("select total_quantity from equipment.equipment_types where id = $1", [TYPE_ID]);
    expect(type!.total_quantity).toBe(10);
    const [history] = await query<{ count: string }>("select count(*) from equipment.inventory_history where equipment_type_id = $1", [TYPE_ID]);
    expect(Number(history!.count)).toBe(0);
    const [unavailable] = await query<{ count: string }>("select count(*) from equipment.unavailability where equipment_type_id = $1", [TYPE_ID]);
    expect(Number(unavailable!.count)).toBe(0);
  });
});

test.describe("P2 reducing the total below the stock that is reserved", () => {
  const RESERVED_FIXTURE = "P2/fixtures/reserved-bulk-stock.sql";
  const TYPE_ID = "22000000-0000-0000-0000-000000000001";
  const TYPE_NAME = "P2 Reserved Conference Chair";

  /** Pre-conditions 4 and 5: the type is in "Equipment" with its current total, and opens on that total. */
  async function openReservedChair(page: Page, total: string) {
    await openInventory(page);
    await expect(totalCell(page, TYPE_NAME)).toHaveText(total);
    await openMaintainScreen(page, TYPE_NAME);
    await expect(page.getByLabel("Total quantity held")).toHaveValue(total);
  }

  /** The two reservations as the card lists them: references, quantities, periods (10:00-12:00 and 10:30-11:30 Singapore time on 15 December 2026) and state. */
  async function expectReservationsUnchanged() {
    const rows = await query<{ event_reference: string; quantity: number; starts_at: Date; ends_at: Date; status: string }>(
      "select event_reference, quantity, starts_at, ends_at, status from equipment.bulk_reservations where equipment_type_id = $1 order by event_reference",
      [TYPE_ID],
    );
    expect(
      rows.map((reservation) => ({
        event_reference: reservation.event_reference,
        quantity: reservation.quantity,
        starts_at: reservation.starts_at.toISOString(),
        ends_at: reservation.ends_at.toISOString(),
        status: reservation.status,
      })),
    ).toEqual([
      { event_reference: "EVT-700101", quantity: 6, starts_at: "2026-12-15T02:00:00.000Z", ends_at: "2026-12-15T04:00:00.000Z", status: "RESERVED" },
      { event_reference: "EVT-700102", quantity: 4, starts_at: "2026-12-15T02:30:00.000Z", ends_at: "2026-12-15T03:30:00.000Z", status: "RESERVED" },
    ]);
  }

  /** Steps 1 to 3 of T9 and T13: change the total, save, return to "Equipment" and reopen the type. */
  async function reduceAndReopen(page: Page, from: string, to: string) {
    await openReservedChair(page, from);
    await page.getByLabel("Total quantity held").fill(to);
    const saved = waitForSave(page, TYPE_ID);
    await page.getByRole("button", { name: "Save equipment type" }).click();
    expect((await saved).status()).toBe(200);
    await expect(page.getByText("Equipment type saved.")).toBeVisible();
    await page.getByRole("button", { name: "Back to inventory" }).click();
    await expect(page.getByRole("heading", { name: "Equipment inventory" })).toBeVisible();
    await expect(totalCell(page, TYPE_NAME)).toHaveText(to);
    await openMaintainScreen(page, TYPE_NAME);
    await expect(page.getByLabel("Total quantity held")).toHaveValue(to);
  }

  test("P2-T9 a total equal to the greatest overlapping reserved quantity is accepted", { tag: ["@P2", "@P2-T9"] }, async ({ page, a11y }) => {
    await runCardFixture(RESERVED_FIXTURE);
    await signIn(page, "techsupport");
    await reduceAndReopen(page, "12", "10");
    await a11y("maintain equipment type, total reduced to the reserved quantity");
    await expectReservationsUnchanged();
  });

  test("P2-T10 a reduction below the overlapping reservations is refused naming them and changes nothing", { tag: ["@P2", "@P2-T10"] }, async ({ page, a11y }) => {
    await runCardFixture(RESERVED_FIXTURE);
    await signIn(page, "techsupport");
    await openReservedChair(page, "12");

    // Steps 1 and 2.
    await page.getByLabel("Total quantity held").fill("9");
    const answered = waitForSave(page, TYPE_ID);
    await page.getByRole("button", { name: "Save equipment type" }).click();
    expect((await answered).status()).toBe(409);

    // The refusal names both reservations with their reserved units.
    const refusal = page.getByText(/Total quantity cannot be reduced to 9/);
    await expect(refusal).toBeVisible();
    await expect(refusal).toContainText("EVT-700101 (6)");
    await expect(refusal).toContainText("EVT-700102 (4)");
    await expect(page.getByText("Equipment type saved.")).toHaveCount(0);
    await a11y("maintain equipment type, reduction refused");

    // Step 3: back to "Equipment" and reopen it.
    await page.getByRole("button", { name: "Back to inventory" }).click();
    await expect(page.getByRole("heading", { name: "Equipment inventory" })).toBeVisible();
    await expect(totalCell(page, TYPE_NAME)).toHaveText("12");
    await openMaintainScreen(page, TYPE_NAME);
    await expect(page.getByLabel("Total quantity held")).toHaveValue("12");
    await expectReservationsUnchanged();
  });

  test("P2-T13 a reduced total one above the overlapping reserved quantity is accepted", { tag: ["@P2", "@P2-T13"] }, async ({ page, a11y }) => {
    await runCardFixture(RESERVED_FIXTURE);
    await signIn(page, "techsupport");
    await reduceAndReopen(page, "12", "11");
    await a11y("maintain equipment type, total reduced above the reserved quantity");
    // Step 4: the SQL editor's query on the reservations.
    await expectReservationsUnchanged();
  });
});

test.describe("P2 audit trail and access", () => {
  const TECH_SUPPORT_ID = "00000000-0000-0000-0000-000000000004";

  test("P2-T11 creating and updating inventory and recording unavailability each capture the actor, time, previous and new quantity", { tag: ["@P2", "@P2-T11"] }, async ({ page, a11y }) => {
    const name = uniqueName("P2 Audit Speaker");
    await signIn(page, "techsupport");
    const beforeStep1 = new Date();

    // Step 1: create the type with total 20 and note its id from #/equipment/<id>/edit.
    await openInventory(page);
    await page.getByRole("button", { name: "New equipment type" }).click();
    await expect(page.getByRole("heading", { name: "New equipment type" })).toBeVisible();
    await page.getByLabel("Name", { exact: true }).fill(name);
    await page.getByLabel("Description", { exact: true }).fill("Portable powered speaker");
    await page.getByLabel("Technical characteristics (name: value, one per line)").fill("Power: 500 W");
    await page.getByLabel("Tracking method").selectOption({ label: "Bulk quantity" });
    await page.getByLabel("Total quantity held").fill("20");
    const created = waitForSave(page);
    await page.getByRole("button", { name: "Save equipment type" }).click();
    expect((await created).status()).toBe(201);
    await expect(page).toHaveURL(/#\/equipment\/[0-9a-f-]{36}\/edit$/);
    await expect(page.getByRole("heading", { name: "Maintain equipment type" })).toBeVisible();
    const typeId = /#\/equipment\/([0-9a-f-]{36})\/edit$/.exec(page.url())![1]!;
    await expect(page.getByLabel("Total quantity held")).toHaveValue("20");

    // Step 2: 24.
    await page.getByLabel("Total quantity held").fill("24");
    const updated = waitForSave(page, typeId);
    await page.getByRole("button", { name: "Save equipment type" }).click();
    expect((await updated).status()).toBe(200);
    await expect(page.getByText("Equipment type saved.")).toBeVisible();

    // Step 3: three units out of service from 09:00 to 17:00 Singapore time (the card's day moved to 2030).
    await page.getByLabel("Quantity", { exact: true }).fill("3");
    await page.getByLabel("Unavailable from").fill("2030-12-20T09:00");
    await page.getByLabel("Unavailable until").fill("2030-12-20T17:00");
    await page.getByLabel("Reason", { exact: true }).fill("Amplifier inspection");
    await page.getByRole("button", { name: "Mark unavailable" }).click();
    await expect(page.getByText("Unavailability recorded.")).toBeVisible();
    await a11y("maintain equipment type, audited");

    // Step 4: the SQL editor's query.
    const history = await query<{
      action: string;
      previous_quantity: number;
      new_quantity: number;
      actor_user_id: string;
      actor_role: string;
      occurred_at: Date;
    }>(
      "select action, previous_quantity, new_quantity, actor_user_id, actor_role, occurred_at from equipment.inventory_history where equipment_type_id = $1 order by occurred_at, id",
      [typeId],
    );
    const afterQuery = new Date();
    expect(history.map((entry) => [entry.action, entry.previous_quantity, entry.new_quantity])).toEqual([
      ["TYPE_CREATED", 0, 20],
      ["TYPE_UPDATED", 20, 24],
      ["UNAVAILABILITY_RECORDED", 0, 3],
    ]);
    for (const entry of history) {
      expect(entry.actor_user_id).toBe(TECH_SUPPORT_ID);
      expect(entry.actor_role).toBe("TECH_SUPPORT_STAFF");
      expect(entry.occurred_at).toBeInstanceOf(Date);
      expect(entry.occurred_at.getTime()).toBeGreaterThanOrEqual(beforeStep1.getTime());
      expect(entry.occurred_at.getTime()).toBeLessThanOrEqual(afterQuery.getTime());
    }
  });

  test("P2-T12 inventory changes attempted by every other active role are refused and store nothing", { tag: ["@P2", "@P2-T12"] }, async ({ page, a11y }) => {
    // Pre-conditions: P2-T1's type, total 20, no unavailability.
    const type = await wirelessMicrophone();
    const body = JSON.stringify({
      name: "P2 Unauthorized Rename",
      description: "Unauthorized change",
      characteristics: { "Frequency band": "534–598 MHz" },
      kind: "BULK",
      totalQuantity: 19,
      unitLabels: [],
    });

    for (const key of ["organiser", "coordinator", "venuestaff", "attendee"] as const) {
      await signIn(page, key);
      // Steps 1 and 2. An attendee reaches the API console by its address; it is not in their navigation.
      if (key === "attendee") await page.goto("/#/console");
      else await page.getByRole("link", { name: "API console" }).click();
      await expect(page.getByRole("heading", { name: "Direct API console" })).toBeVisible();
      await page.getByLabel("Method").fill("PUT");
      await page.getByLabel("Path").fill(`/equipment/api/v1/equipment/types/${type.id}`);
      await page.getByLabel("Body (JSON, optional)").fill(body);
      await page.getByRole("button", { name: "Send", exact: true }).click();

      // Step 3: refused with 403, and the screen shows the server's own refusal.
      const result = page.locator("pre");
      await expect(result).toBeVisible();
      await expect(page.locator("h3").first()).toContainText("403");
      await expect(result).toContainText("ROLE_NOT_AUTHORISED");
      await expect(result).toContainText("Your role is not authorised to use this function.");
      if (key === "organiser") await a11y("direct API console with a role refusal");
      await signOut(page);
    }

    // Step 4: Technical Support's own view of the type.
    await signIn(page, "techsupport");
    await openInventory(page);
    await expect(row(page, type.name)).toHaveCount(1);
    await expect(totalCell(page, type.name)).toHaveText("20");
    await openMaintainScreen(page, type.name);
    expect(page.url()).toContain(`#/equipment/${type.id}/edit`);
    await expect(page.getByLabel("Description", { exact: true })).toHaveValue("Handheld wireless microphone for talks and panels.");
    await expect(page.getByLabel("Technical characteristics (name: value, one per line)")).toHaveValue("Frequency band: 534–598 MHz");
    await expect(page.getByLabel("Total quantity held")).toHaveValue("20");
    await expect(page.getByText("No out-of-service periods are recorded.")).toBeVisible();
    await expect(page.getByText("P2 Unauthorized Rename")).toHaveCount(0);
    await a11y("maintain equipment type, unchanged");

    // Step 5: no history record by any of the four users.
    const [others] = await query<{ count: string }>(
      "select count(*) from equipment.inventory_history where equipment_type_id = $1 and actor_user_id in ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000005')",
      [type.id],
    );
    expect(Number(others!.count)).toBe(0);
    // And the record kept is Technical Support's own creation only.
    const [all] = await query<{ count: string }>("select count(*) from equipment.inventory_history where equipment_type_id = $1", [type.id]);
    expect(Number(all!.count)).toBe(1);
  });
});

// G2 and S3: the change request's review page, the arrangements it lists, and the period S3's reasons quote.
/** The period S3's reasons quote, in Singapore time, as formatPeriod writes it. */
const WAS = "Tuesday 2 March 2027, 14:00–18:00";
const NOW = "Tuesday 2 March 2027, 15:00–18:00";

async function openReviewPage(page: Page, name: string) {
  await page.getByRole("link", { name: "All events" }).click();
  await row(page, name).getByRole("link", { name: "Open" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
}

const previewOf = (page: Page) => page.locator("section[aria-labelledby='change-impact-heading']");
const today = (page: Page) => page.evaluate(() => new Date().toLocaleDateString());

async function expectArrangementsListed(page: Page, fx: PlannedEvent) {
  const items = previewOf(page).locator("li");
  await expect(items).toHaveCount(3);
  await expect(items.filter({ hasText: `Booking ${fx.theatreBooking.reference}, ${fx.venueOne.name}` })).toHaveCount(1);
  await expect(items.filter({ hasText: `Booking ${fx.hallBooking.reference}, ${fx.venueTwo.name}` })).toHaveCount(1);
  await expect(items.filter({ hasText: `${fx.chairs.name}, quantity ${fx.reservedQuantity}` })).toHaveCount(1);
  await expect(previewOf(page)).toContainText("Registrations: 0");
  return {
    theatre: items.filter({ hasText: fx.theatreBooking.reference }),
    hall: items.filter({ hasText: fx.hallBooking.reference }),
    reservation: items.filter({ hasText: fx.chairs.name }),
  };
}

test.describe("G2 preview what a change would affect", () => {
  test("G2-T8 the coordinator reads what a pending change would affect, flags nothing by looking, and loses the section once it is decided", { tag: ["@G2", "@G2-T8"] }, async ({ page, a11y }) => {
    // FX-G2 (browser level): a change that moves the start time and raises attendance to 150; and another event whose pending change is to the venue requirements only.
    const fx = await plannedEvent({ proposedStartAt: MOVED_START, expectedAttendance: 150 });
    const requirementsOnly = await plannedEvent({ venueRequirements: { notes: "Stage with a lectern" } });

    // Step 1: the assigned coordinator opens the change request's review page.
    await signIn(page, "coordinator");
    await openReviewPage(page, fx.event.name);
    const pending = page.getByRole("region", { name: "Pending change" });
    await expect(pending).toBeVisible();

    // Step 2: "If this change is approved", above the Approve and Reject actions.
    await expect(previewOf(page).getByRole("heading", { name: "If this change is approved" })).toBeVisible();
    const arrangements = await expectArrangementsListed(page, fx);
    await expect(arrangements.theatre).toContainText("Requires reconfirmation");
    await expect(arrangements.theatre).toContainText(`The booking is for ${WAS}, but the event is now ${NOW}.`);
    await expect(arrangements.theatre).toContainText("Unsuitable");
    await expect(arrangements.theatre).toContainText(`Expected attendance is now 150, but ${fx.venueOne.name} holds 100 in the Theatre layout.`);
    await expect(arrangements.hall).toContainText("Requires reconfirmation");
    await expect(arrangements.hall).toContainText(`The booking is for ${WAS}, but the event is now ${NOW}.`);
    await expect(arrangements.hall).not.toContainText("Unsuitable");
    await expect(arrangements.reservation).toContainText("Flagged for review");
    await expect(arrangements.reservation).toContainText(`The reservation is for ${WAS}, but the event is now ${NOW}.`);
    await expect(arrangements.reservation).not.toContainText("Requires reconfirmation");
    await expect(arrangements.reservation).not.toContainText("Unsuitable");
    const previewBox = await previewOf(page).boundingBox();
    const approveBox = await page.getByRole("button", { name: "Approve change" }).boundingBox();
    const rejectBox = await page.getByRole("button", { name: "Reject change" }).boundingBox();
    expect(previewBox!.y + previewBox!.height).toBeLessThanOrEqual(approveBox!.y + 1);
    expect(previewBox!.y + previewBox!.height).toBeLessThanOrEqual(rejectBox!.y + 1);
    await a11y("coordinator review detail, change preview");

    // Step 3: the event page, where "Outstanding flags" would show: viewing flagged nothing.
    const flagsRead = page.waitForResponse((response) => response.url().includes(`/events/${fx.event.id}/arrangement-flags`));
    await openReviewPage(page, fx.event.name);
    expect((await flagsRead).status()).toBe(200);
    await expect(page.getByRole("heading", { name: "Outstanding flags" })).toHaveCount(0);
    const flags = await must<{ flags: unknown[] }>("coordinator", "GET", `/api/v1/events/${fx.event.id}/arrangement-flags`);
    expect(flags.flags).toEqual([]);
    const { bookings } = await eventBookings(fx.event.id);
    expect(bookings).toHaveLength(2);
    for (const booking of bookings) {
      expect(booking.status).toBe("CONFIRMED");
      expect(booking.requiresReconfirmation).toBe(false);
    }

    // Step 4: reject the change with a reason, and read the page again: the section is gone.
    await page.getByRole("button", { name: "Reject change" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Reason").fill("The venues cannot move");
    await dialog.getByRole("button", { name: "Confirm rejection" }).click();
    await expect(dialog).toHaveCount(0);
    const date = await today(page);
    await expect(page.getByText(`Change rejected on ${date}: The venues cannot move`)).toBeVisible();
    await expect(page.getByRole("heading", { name: "If this change is approved" })).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("heading", { name: fx.event.name })).toBeVisible();
    await expect(page.getByText(`Change rejected on ${date}: The venues cannot move`)).toBeVisible();
    await expect(page.getByRole("heading", { name: "If this change is approved" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Approve change" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Reject change" })).toHaveCount(0);

    // Step 5: another event, with a pending change to the venue requirements only: it lists the arrangements and flags none.
    await openReviewPage(page, requirementsOnly.event.name);
    await expect(previewOf(page).getByRole("heading", { name: "If this change is approved" })).toBeVisible();
    await expectArrangementsListed(page, requirementsOnly);
    await expect(previewOf(page).getByText("Requires reconfirmation")).toHaveCount(0);
    await expect(previewOf(page).getByText("Unsuitable")).toHaveCount(0);
    await expect(previewOf(page).getByText("Flagged for review")).toHaveCount(0);
    await a11y("coordinator review detail, change preview without flags");
  });
});

test.describe("S3 reconsider the arrangements an approved change affects", () => {
  const items = (section: Locator) => section.locator("li");
  const outstanding = (page: Page) => page.locator("section[aria-labelledby='outstanding-flags-heading']");

  /** The three flags and their reasons, in a list of arrangements (the impact or the Outstanding flags panel). */
  async function expectFlags(section: Locator, fx: PlannedEvent) {
    const theatre = items(section).filter({ hasText: fx.theatreBooking.reference });
    const hall = items(section).filter({ hasText: fx.hallBooking.reference });
    const reservation = items(section).filter({ hasText: fx.chairs.name });
    await expect(theatre.filter({ hasText: "Requires reconfirmation" })).toContainText(`The booking is for ${WAS}, but the event is now ${NOW}.`);
    await expect(theatre.filter({ hasText: "Unsuitable" })).toContainText(`Expected attendance is now 150, but ${fx.venueOne.name} holds 100 in the Theatre layout.`);
    await expect(hall.filter({ hasText: "Requires reconfirmation" })).toContainText(`The booking is for ${WAS}, but the event is now ${NOW}.`);
    await expect(hall.filter({ hasText: "Unsuitable" })).toHaveCount(0);
    await expect(reservation.filter({ hasText: "Flagged for review" })).toContainText(`The reservation is for ${WAS}, but the event is now ${NOW}.`);
  }

  // AC8 is read as "the assigned Event Coordinator" (documentation/clarifications.md, D-03, 4 Nov 2026), as A4 and W9-35
  // scope coordinators to the events assigned to them; CQ-11 is still open with the customer.
  test("S3-T13 the coordinator approves a change and sees what it flagged; confirming is refused; the owner sees the flags, nobody else does, and the staff are told", { tag: ["@S3", "@S3-T13"] }, async ({ page, a11y }) => {
    // FX-S3 (browser level): two confirmed bookings (Theatre 100, Hall 200) and a reservation, and a pending change that moves the start and raises attendance to 150.
    const fx = await plannedEvent({ proposedStartAt: MOVED_START, expectedAttendance: 150 });

    // Steps 1 and 2: approve, and read the impact list.
    await signIn(page, "coordinator");
    await openReviewPage(page, fx.event.name);
    await page.getByRole("button", { name: "Approve change" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Confirm approval" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText(`Change approved on ${await today(page)}`)).toBeVisible();
    await expect(previewOf(page).getByRole("heading", { name: "Affected arrangements" })).toBeVisible();
    await expectArrangementsListed(page, fx);
    await expectFlags(previewOf(page), fx);
    await a11y("coordinator review detail, change approved with flags");

    // Step 3: the event page's Outstanding flags panel.
    await openReviewPage(page, fx.event.name);
    await expect(outstanding(page).getByRole("heading", { name: "Outstanding flags" })).toBeVisible();
    await expect(items(outstanding(page))).toHaveCount(4);
    await expectFlags(outstanding(page), fx);

    // Step 4: confirming the event (F5) is refused, naming every flag.
    await page.getByRole("button", { name: "Confirm arrangements" }).click();
    const confirm = page.getByRole("dialog");
    await confirm.getByRole("button", { name: "Confirm arrangements" }).click();
    await expect(confirm.getByText("ARRANGEMENTS_NOT_READY")).toBeVisible();
    const named = confirm.getByLabel("Outstanding arrangements");
    // The dialog words each flag as F5's refusal does (lower case, "flagged unsuitable"), the reservation by its equipment line.
    await expect(named).toContainText(`${fx.theatreBooking.reference} at ${fx.venueOne.name}: requires reconfirmation.`);
    await expect(named).toContainText(`${fx.theatreBooking.reference} at ${fx.venueOne.name}: flagged unsuitable.`);
    await expect(named).toContainText(`${fx.hallBooking.reference} at ${fx.venueTwo.name}: requires reconfirmation.`);
    await expect(named).toContainText(`${fx.chairs.name} × ${fx.reservedQuantity}: flagged for review.`);
    await a11y("confirm arrangements dialog, refused for flags");
    await confirm.getByRole("button", { name: "Cancel" }).click();
    expect((await must<{ status: string }>("coordinator", "GET", `/api/v1/events/${fx.event.id}`)).status).toBe("PLANNING");
    await signOut(page);

    // Step 5: the owner sees the panel; an Event Coordinator the event is not assigned to sees no event and no flags.
    await signIn(page, "organiser");
    await page.getByRole("link", { name: "My requests" }).click();
    await row(page, fx.event.name).getByRole("link", { name: "View" }).click();
    await expect(page.getByRole("heading", { name: fx.event.name })).toBeVisible();
    await expectFlags(outstanding(page), fx);
    await signOut(page);
    await signIn(page, "coordinator2");
    await page.goto(`/#/review/${fx.event.id}`);
    await expect(page.getByText("No event with that reference is assigned to you.")).toBeVisible();
    await expect(page.getByText(fx.event.name)).toHaveCount(0);
    await expect(outstanding(page)).toHaveCount(0);
    const otherCoordinator = await call("coordinator2", "GET", `/api/v1/events/${fx.event.id}/arrangement-flags`);
    expect(otherCoordinator.status).toBe(404);
    await signOut(page);

    // Step 6: Organiser Two sees no event and no flags.
    await signIn(page, "organiser2");
    await page.goto(`/#/requests/${fx.event.id}`);
    await expect(page.getByText(fx.event.name)).toHaveCount(0);
    await expect(outstanding(page)).toHaveCount(0);
    const flags = await call("organiser2", "GET", `/api/v1/events/${fx.event.id}/arrangement-flags`);
    expect(flags.status).toBe(404);
    await signOut(page);

    // Step 7: the approval's message reaches the notification service (the test harness delivers it, as this stack
    // has no Kafka) and is stored, not retried. Venue Staff One looks after both venues, so they get one notice naming
    // both bookings and every flag's reason; Technical Support get one for the reservation.
    const deliveries = await deliverOutbox(fx.event.id, { types: ["change-request.arrangements-flagged"] });
    expect(deliveries).toEqual([{ outbox: "change.outbox", type: "change-request.arrangements-flagged", consumer: "notification", outcome: "stored" }]);
    const label = `${fx.event.reference} “${fx.event.name}”`;
    const flaggedNotices = (notices: Locator) => notices.filter({ hasText: label }).filter({ hasText: "after an approved change" });
    const moved = `The booking is for ${WAS}, but the event is now ${NOW}.`;
    const tooSmall = `Expected attendance is now 150, but ${fx.venueOne.name} holds 100 in the Theatre layout.`;
    // The message lists the bookings soonest first, then by reference (these two start together), each with its flags in turn.
    const [first, second] = [
      { ...fx.theatreBooking, reasons: `${moved} ${tooSmall}` },
      { ...fx.hallBooking, reasons: moved },
    ].sort((a, b) => (a.reference < b.reference ? -1 : 1));
    await expect(messageOf(flaggedNotices(await openNotifications(page, "venuestaff")))).toHaveText([
      `Booking ${first!.reference} at ${first!.venueName} and booking ${second!.reference} at ${second!.venueName} for ${label} ` +
        `need attention after an approved change. ${first!.reference}: ${first!.reasons} ${second!.reference}: ${second!.reasons}`,
    ]);
    await a11y("venue staff notifications, change flagged bookings");
    await signOut(page);
    await expect(messageOf(flaggedNotices(await openNotifications(page, "techsupport")))).toHaveText([
      `The ${fx.chairs.name} reservation for ${label} is flagged for review after an approved change: The reservation is for ${WAS}, but the event is now ${NOW}. Release it if it is no longer needed.`,
    ]);
  });
});
