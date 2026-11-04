import type { Page } from "@playwright/test";
import { expect, signIn, signOut, test, uniqueName } from "./support/fixtures.js";
import { must } from "./support/api.js";
import { deliverOutbox } from "./support/deliver.js";
import { messageOf, openNotifications } from "./support/notifications.js";
import { approvedRequest, type EventRow } from "./support/seed.js";
import { createEquipmentType, requestEquipment, reserveInFull, setLineStatus, type RequestLineRow } from "./support/seed-arrangements.js";
import { storedNotices } from "./support/seed-venue-notices.js";

/**
 * P2 (inventory), O1 (the coordinator's equipment request), O2 (Technical Support's status
 * updates), Q1 (reservation) and Q2 (release), through the real screens. Equipment types are
 * created with unique names, so each test sees only its own. CI's stack has no Kafka, so a journey
 * whose card ends on the coordinator's notifications hands the line's messages to the notification
 * service with deliverOutbox before the coordinator opens Notifications.
 */

const row = (page: Page, text: string) => page.getByRole("row").filter({ hasText: text });
/** A form field's own block: its label, its control and the message bound to it. */
const fieldBlock = (page: Page, id: string) => page.locator(`xpath=//label[@for="${id}"]/..`);
/** The row of an equipment line, found by its equipment cell (a substitute's name can appear in another line's row). */
const lineRow = (page: Page, typeName: string) => page.getByRole("row").filter({ has: page.getByRole("cell", { name: typeName, exact: true }) });
/** The status cell of a line on Technical Support's list and on the coordinator's request (the sixth on both). */
const statusOf = (page: Page, typeName: string) => lineRow(page, typeName).getByRole("cell").nth(5);
const LINE_CHANGED = "equipment-request.line-status-changed";
const named = (event: EventRow) => `${event.reference} “${event.name}”`;
const lineOf = (id: string) => must<RequestLineRow>("techsupport", "GET", `/api/v1/equipment/request-lines/${id}`);

/** The coordinator's way to an event's equipment request: "All events" → the event → "Equipment request". */
async function openEquipmentRequest(page: Page, event: EventRow) {
  await page.getByRole("link", { name: "All events" }).click();
  await row(page, event.name).getByRole("link", { name: "Open" }).click();
  await expect(page.getByRole("heading", { name: event.name })).toBeVisible();
  await page.getByRole("link", { name: "Equipment request" }).click();
  await expect(page.getByRole("heading", { name: "Equipment request" })).toBeVisible();
}

async function openEquipmentType(page: Page, name: string) {
  await page.getByRole("link", { name: "Equipment", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Equipment inventory" })).toBeVisible();
  await row(page, name).getByRole("link", { name: "Maintain" }).click();
  await expect(page.getByRole("heading", { name: "Maintain equipment type" })).toBeVisible();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(name);
}

async function fillNewType(page: Page, values: { name: string; description: string; characteristics: string; total: string }) {
  await page.getByRole("link", { name: "Equipment", exact: true }).click();
  await page.getByRole("button", { name: "New equipment type" }).click();
  await expect(page.getByRole("heading", { name: "New equipment type" })).toBeVisible();
  await page.getByLabel("Name", { exact: true }).fill(values.name);
  await page.getByLabel("Description", { exact: true }).fill(values.description);
  await page.getByLabel("Technical characteristics (name: value, one per line)").fill(values.characteristics);
  await page.getByLabel("Total quantity held").fill(values.total);
}

test.describe("P2 equipment inventory", () => {
  test("P2-T1 technical support create an equipment type with every inventory attribute", { tag: ["@P2", "@P2-T1"] }, async ({ page, a11y }) => {
    const name = uniqueName("P2 Wireless Microphone");
    await signIn(page, "techsupport");
    await expect(page.getByRole("heading", { name: "Equipment inventory" })).toBeVisible();
    await a11y("equipment inventory");

    await fillNewType(page, {
      name,
      description: "Handheld wireless microphone for talks and panels.",
      characteristics: "Frequency band: 534–598 MHz\nConnector: XLR\nPower: 2×AA",
      total: "20",
    });
    await a11y("new equipment type");
    await page.getByRole("button", { name: "Save equipment type" }).click();
    await expect(page.getByText("Equipment type saved.")).toBeVisible();

    await page.getByRole("button", { name: "Back to inventory" }).click();
    await expect(row(page, name)).toContainText("20");

    await row(page, name).getByRole("link", { name: "Maintain" }).click();
    await expect(page.getByRole("heading", { name: "Maintain equipment type" })).toBeVisible();
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue(name);
    await expect(page.getByLabel("Description", { exact: true })).toHaveValue("Handheld wireless microphone for talks and panels.");
    // All three characteristics come back; the stored record keeps no order among them.
    const characteristics = page.getByLabel("Technical characteristics (name: value, one per line)");
    await expect(characteristics).not.toHaveValue("");
    expect((await characteristics.inputValue()).split("\n").sort()).toEqual([
      "Connector: XLR",
      "Frequency band: 534–598 MHz",
      "Power: 2×AA",
    ]);
    await expect(page.getByLabel("Total quantity held")).toHaveValue("20");
    await a11y("maintain equipment type");
  });

  test("P2-T2 an equipment type with a total quantity of exactly zero is accepted", { tag: ["@P2", "@P2-T2"] }, async ({ page }) => {
    const name = uniqueName("P2 Spare Audio Mixer");
    await signIn(page, "techsupport");
    await fillNewType(page, { name, description: "Inventory type created before stock arrives.", characteristics: "Inputs: 12", total: "0" });
    await page.getByRole("button", { name: "Save equipment type" }).click();
    await expect(page.getByText("Equipment type saved.")).toBeVisible();

    await page.getByRole("button", { name: "Back to inventory" }).click();
    await expect(row(page, name).getByRole("cell").nth(3)).toHaveText("0");
  });

  test("P2-T3 a total quantity one below the minimum is refused and stores nothing", { tag: ["@P2", "@P2-T3"] }, async ({ page, a11y }) => {
    const name = uniqueName("P2 Negative Quantity");
    await signIn(page, "techsupport");
    await fillNewType(page, { name, description: "Boundary test record", characteristics: "Category: Test", total: "-1" });
    await page.getByRole("button", { name: "Save equipment type" }).click();

    await expect(fieldBlock(page, "equipment-total")).toContainText("Total quantity must be a whole number from 0 to 1000000.");
    await expect(page.getByRole("heading", { name: "New equipment type" })).toBeVisible();
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue(name);
    await expect(page.getByLabel("Description", { exact: true })).toHaveValue("Boundary test record");
    await expect(page.getByLabel("Technical characteristics (name: value, one per line)")).toHaveValue("Category: Test");
    await expect(page.getByLabel("Total quantity held")).toHaveValue("-1");
    await a11y("new equipment type, refused");

    await page.getByRole("button", { name: "Back to inventory" }).click();
    await expect(page.getByRole("heading", { name: "Equipment inventory" })).toBeVisible();
    await expect(page.getByRole("table")).toBeVisible();
    await expect(row(page, name)).toHaveCount(0);
  });

  test("P2-T4 technical support mark a quantity unavailable for a valid period with a reason", { tag: ["@P2", "@P2-T4"] }, async ({ page, a11y }) => {
    const type = await createEquipmentType("P2 Wireless Microphone", 20);
    await signIn(page, "techsupport");
    await openEquipmentType(page, type.name);

    await page.getByLabel("Quantity", { exact: true }).fill("2");
    await page.getByLabel("Unavailable from").fill("2030-12-10T09:00");
    await page.getByLabel("Unavailable until").fill("2030-12-10T09:01");
    await page.getByLabel("Reason", { exact: true }).fill("Battery compartments under repair");
    await page.getByRole("button", { name: "Mark unavailable" }).click();
    await expect(page.getByText("Unavailability recorded.")).toBeVisible();

    // Reopen the type: the entry is stored, not just shown.
    await page.reload();
    await expect(page.getByLabel("Total quantity held")).toHaveValue("20");
    const entries = page.locator("section[aria-labelledby='unavailability-heading'] li");
    await expect(entries).toHaveCount(1);
    await expect(entries.first()).toHaveText(
      "2 units · 10 Dec 2030, 9:00 am to 10 Dec 2030, 9:01 am · Battery compartments under repair (active)",
    );
    await a11y("maintain equipment type, unavailability recorded");
  });

  const refusals = [
    {
      card: "P2-T5",
      title: "marking equipment unavailable without a reason is refused and stores nothing",
      start: "2030-12-10T09:00",
      end: "2030-12-12T17:00",
      reason: "",
      message: "Enter why the equipment is unavailable.",
    },
    {
      card: "P2-T6",
      title: "whitespace does not satisfy the mandatory unavailability reason",
      start: "2030-12-10T09:00",
      end: "2030-12-12T17:00",
      reason: "   ",
      message: "Enter why the equipment is unavailable.",
    },
    {
      card: "P2-T7",
      title: "an unavailability period of zero duration is refused and stores nothing",
      start: "2030-12-10T09:00",
      end: "2030-12-10T09:00",
      reason: "Battery compartments under repair",
      message: "The end of the unavailable period must be later than the start.",
    },
    {
      card: "P2-T8",
      title: "a reversed unavailability period is refused and stores nothing",
      start: "2030-12-10T17:00",
      end: "2030-12-10T09:00",
      reason: "Battery compartments under repair",
      message: "The end of the unavailable period must be later than the start.",
    },
  ];

  for (const refusal of refusals) {
    test(`${refusal.card} ${refusal.title}`, { tag: ["@P2", `@${refusal.card}`] }, async ({ page }) => {
      const type = await createEquipmentType("P2 Wireless Microphone", 20);
      await signIn(page, "techsupport");
      await openEquipmentType(page, type.name);

      await page.getByLabel("Quantity", { exact: true }).fill("2");
      await page.getByLabel("Unavailable from").fill(refusal.start);
      await page.getByLabel("Unavailable until").fill(refusal.end);
      await page.getByLabel("Reason", { exact: true }).fill(refusal.reason);
      await page.getByRole("button", { name: "Mark unavailable" }).click();

      // The message sits against the field it names: Reason, or the end of the period.
      const field = refusal.message.startsWith("Enter why") ? "unavailable-reason" : "unavailable-end";
      await expect(fieldBlock(page, field)).toContainText(refusal.message);
      await expect(page.getByText("Unavailability recorded.")).toHaveCount(0);

      await page.reload();
      await expect(page.getByLabel("Total quantity held")).toHaveValue("20");
      await expect(page.getByText("No out-of-service periods are recorded.")).toBeVisible();
    });
  }
});

test.describe("O1 equipment request", () => {
  test("O1-T26 the coordinator saves lines, edits one and removes one, and technical support see the rest", { tag: ["@O1", "@O1-T26"] }, async ({ page, a11y }) => {
    // FX-APPROVED at the card's 14:00 to 18:00, on 2 December 2030 rather than 2026 so it never falls in the past.
    const event = await approvedRequest({ proposedStartAt: "2030-12-02T06:00:00.000Z", proposedEndAt: "2030-12-02T10:00:00.000Z" });
    const chairs = await createEquipmentType("O1 Folding Chairs", 50);
    const projectors = await createEquipmentType("O1 Projectors", 5);

    await signIn(page, "coordinator");
    await page.getByRole("link", { name: "All events" }).click();
    await row(page, event.name).getByRole("link", { name: "Open" }).click();
    await expect(page.getByRole("heading", { name: event.name })).toBeVisible();
    await page.getByRole("link", { name: "Equipment request" }).click();
    await expect(page.getByRole("heading", { name: "Equipment request" })).toBeVisible();
    await a11y("equipment request");

    // Step 2: a new line starts with the event's own times.
    await expect(page.getByLabel("Required from (local time)")).toHaveValue("2030-12-02T14:00");
    await expect(page.getByLabel("Required to (local time)")).toHaveValue("2030-12-02T18:00");

    // Step 3: chairs and a projector line of quantity 0, saved together.
    await page.getByLabel("Equipment type").selectOption({ label: chairs.name });
    await page.getByLabel("Quantity", { exact: true }).fill("40");
    await page.getByLabel("Technical requirements / notes").fill("Set out in rows of 10");
    await page.getByRole("button", { name: "Add another line" }).click();
    await page.getByLabel("Equipment type").nth(1).selectOption({ label: projectors.name });
    await page.getByLabel("Quantity", { exact: true }).nth(1).fill("0");
    await page.getByRole("button", { name: "Save request" }).click();

    await expect(page.getByText("lines.1.quantity")).toBeVisible();
    await expect(page.getByText("No equipment has been requested for this event yet.")).toBeVisible();
    await a11y("equipment request, refused");

    // Step 4: correct the projectors and save both.
    await page.getByLabel("Quantity", { exact: true }).nth(1).fill("2");
    await page.getByRole("button", { name: "Save request" }).click();
    await expect(page.getByText("2 lines saved")).toBeVisible();
    await expect(row(page, chairs.name)).toContainText("Submitted");
    await expect(row(page, projectors.name)).toContainText("Submitted");
    await expect(row(page, chairs.name).getByRole("cell").nth(1)).toHaveText("40");
    await expect(row(page, projectors.name).getByRole("cell").nth(1)).toHaveText("2");

    // Step 5: edit the chairs line.
    await row(page, chairs.name).getByRole("button", { name: "Edit" }).click();
    await expect(page.getByRole("heading", { name: "Edit line" })).toBeVisible();
    await page.locator("#edit-quantity").fill("45");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("heading", { name: "Edit line" })).toHaveCount(0);
    await expect(row(page, chairs.name).getByRole("cell").nth(1)).toHaveText("45");

    // Step 6: remove the projectors line.
    await row(page, projectors.name).getByRole("button", { name: "Remove" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText(`${projectors.name} × 2 will be marked Removed`);
    await a11y("remove equipment line dialog");
    await dialog.getByRole("button", { name: "Remove line" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(row(page, projectors.name)).toHaveCount(0);
    await expect(row(page, chairs.name)).toHaveCount(1);

    // Step 7: Technical Support see the chairs line, Submitted, with the event's reference.
    await signOut(page);
    await signIn(page, "techsupport");
    await page.getByRole("link", { name: "Equipment requests" }).click();
    await expect(page.getByRole("heading", { name: "Equipment requests" })).toBeVisible();
    const techRow = row(page, chairs.name);
    await expect(techRow).toContainText(event.reference);
    await expect(techRow).toContainText("Submitted");
    await expect(techRow.getByRole("cell").nth(2)).toHaveText("45");
    await expect(row(page, projectors.name)).toHaveCount(0);
    await a11y("equipment requests");
  });
});

test.describe("Q1 reserve equipment", () => {
  test("Q1-T14 technical support confirm a partial reservation, and the coordinator sees it", { tag: ["@Q1", "@Q1-T14"] }, async ({ page, a11y }) => {
    test.setTimeout(120_000);
    const event = await approvedRequest();
    const chairs = await createEquipmentType("Q1 Folding Chairs", 50);
    const [line] = await requestEquipment(event.id, [{ equipmentTypeId: chairs.id, quantity: 40 }]);
    await setLineStatus(line!.id, "CONFIRMED");

    await signIn(page, "techsupport");
    await page.getByRole("link", { name: "Equipment requests" }).click();
    const techRow = row(page, chairs.name);
    await expect(techRow).toContainText("Confirmed");
    await techRow.getByRole("button", { name: `Reserve ${chairs.name} for ${event.reference}` }).click();
    await expect(page.getByRole("heading", { name: `Reserve ${chairs.name} × 40 for ${event.reference}` })).toBeVisible();

    // Step 3: a lower quantity without saying it is partial.
    await page.getByLabel("Quantity to reserve").fill("30");
    await expect(page.getByLabel("Reserve fewer than requested")).not.toBeChecked();
    await page.getByRole("button", { name: "Reserve equipment" }).click();
    await expect(page.getByText("PARTIAL_NOT_CONFIRMED")).toBeVisible();
    await expect(techRow).toContainText("Confirmed");
    await expect(techRow).not.toContainText("Reserved 30");
    await a11y("reserve equipment, partial not confirmed");

    // Step 4: say so, and reserve.
    await page.getByLabel("Reserve fewer than requested").check();
    await page.getByRole("button", { name: "Reserve equipment" }).click();
    await expect(page.getByText(`Reserved 30 of 40 for ${event.reference}.`)).toBeVisible();
    await expect(techRow).toContainText("Reserved 30 of 40");
    await expect(techRow).toContainText("Tech Support One ·");
    await a11y("equipment requests, reserved");

    // Step 5: the line's messages reach the notification service (the test harness delivers them, as this stack
    // has no Kafka): the Confirmed status set up above, and the reservation.
    await signOut(page);
    expect(storedNotices(await deliverOutbox(event.id, { types: [LINE_CHANGED] }), LINE_CHANGED)).toBe(2);
    const notices = await openNotifications(page, "coordinator");
    await expect(messageOf(notices.filter({ hasText: `${chairs.name} × 40 is now Reserved` }))).toHaveText([
      `Technical Support updated equipment for ${named(event)}: ${chairs.name} × 40 is now Reserved (30 of 40 reserved).`,
    ]);
    await a11y("notifications, equipment reserved");
    await openEquipmentRequest(page, event);
    const coordinatorRow = row(page, chairs.name);
    await expect(coordinatorRow).toContainText("Reserved");
    await expect(coordinatorRow).toContainText("Reserved 30 of 40");
    await expect(coordinatorRow).toContainText("Tech Support One ·");
  });
});

test.describe("O2 technical support update a line's status", () => {
  test("O2-T17 technical support set one line Unavailable once a reason is given and substitute another, and the coordinator is told of both", { tag: ["@O2", "@O2-T17"] }, async ({ page, a11y }) => {
    test.setTimeout(120_000);
    // O1-T26's steps 1 to 4 leave two Submitted lines for the event: chairs × 40 and projectors × 2.
    const event = await approvedRequest();
    const chairs = await createEquipmentType("O1 Folding Chairs", 50);
    const projectors = await createEquipmentType("O1 Projectors", 5);
    const lines = await requestEquipment(event.id, [
      { equipmentTypeId: chairs.id, quantity: 40 },
      { equipmentTypeId: projectors.id, quantity: 2 },
    ]);
    const chairsLine = lines.find((l) => l.equipmentTypeName === chairs.name);
    const projectorsLine = lines.find((l) => l.equipmentTypeName === projectors.name);

    // Step 1.
    await signIn(page, "techsupport");
    await page.getByRole("link", { name: "Equipment requests" }).click();
    await expect(page.getByRole("heading", { name: "Equipment requests" })).toBeVisible();
    await expect(statusOf(page, chairs.name)).toContainText("Submitted");
    await expect(statusOf(page, projectors.name)).toContainText("Submitted");

    // Step 2: Unavailable with no reason is refused, naming the reason, and the line stays Submitted.
    await lineRow(page, chairs.name).getByRole("button", { name: `Update ${chairs.name} for ${event.reference}` }).click();
    await expect(page.getByRole("heading", { name: `Update ${chairs.name} × 40 for ${event.reference}` })).toBeVisible();
    await page.getByLabel("New status").selectOption({ label: "Unavailable" });
    await page.getByRole("button", { name: "Save status" }).click();
    await expect(fieldBlock(page, "reason")).toContainText("Give a reason why the equipment is unavailable.");
    await expect(page.getByText("VALIDATION_FAILED")).toBeVisible();
    await expect(statusOf(page, chairs.name)).toContainText("Submitted");
    expect((await lineOf(chairsLine!.id)).status).toBe("SUBMITTED");
    await a11y("update equipment line, reason missing");

    // Step 3: with the reason it is Unavailable.
    await page.getByLabel("Reason", { exact: true }).fill("All chairs are out at another event");
    await page.getByRole("button", { name: "Save status" }).click();
    await expect(page.getByText(`${chairs.name} for ${event.reference} is now Unavailable.`)).toBeVisible();
    await expect(statusOf(page, chairs.name)).toContainText("Unavailable");
    await expect(statusOf(page, chairs.name)).toContainText("Reason: All chairs are out at another event");

    // Step 4: the projectors are Substituted by three of the chairs; the row keeps the projectors and names the substitute.
    await lineRow(page, projectors.name).getByRole("button", { name: `Update ${projectors.name} for ${event.reference}` }).click();
    await page.getByLabel("New status").selectOption({ label: "Substituted" });
    await page.getByLabel("Substitute equipment").selectOption({ label: chairs.name });
    await page.getByLabel("Substitute quantity").fill("3");
    await page.getByRole("button", { name: "Save status" }).click();
    await expect(page.getByText(`${projectors.name} for ${event.reference} is now Substituted.`)).toBeVisible();
    await expect(lineRow(page, projectors.name).getByRole("cell").nth(2)).toHaveText("2");
    await expect(statusOf(page, projectors.name)).toContainText("Substituted");
    await expect(statusOf(page, projectors.name)).toContainText(`Instead: ${chairs.name} × 3`);
    expect(await lineOf(projectorsLine!.id)).toMatchObject({ status: "SUBSTITUTED", equipmentTypeName: projectors.name });
    await a11y("equipment requests, unavailable and substituted");
    await signOut(page);

    // Step 5: both changes' messages reach the notification service (the test harness delivers them, as this
    // stack has no Kafka), and the coordinator reads two notices naming the event, the equipment and the new status.
    expect(storedNotices(await deliverOutbox(event.id, { types: [LINE_CHANGED] }), LINE_CHANGED)).toBe(2);
    const notices = await openNotifications(page, "coordinator");
    const prefix = `Technical Support updated equipment for ${named(event)}: `;
    await expect(messageOf(notices.filter({ hasText: `${chairs.name} × 40 is now` }))).toHaveText([
      `${prefix}${chairs.name} × 40 is now Unavailable. Reason: All chairs are out at another event`,
    ]);
    await expect(messageOf(notices.filter({ hasText: `${projectors.name} × 2 is now` }))).toHaveText([
      `${prefix}${projectors.name} × 2 is now Substituted. Substitute: ${chairs.name} × 3.`,
    ]);
    await a11y("notifications, equipment status changed");
    await openEquipmentRequest(page, event);
    await expect(statusOf(page, chairs.name)).toContainText("Unavailable");
    await expect(statusOf(page, chairs.name)).toContainText("Reason: All chairs are out at another event");
    await expect(statusOf(page, projectors.name)).toContainText("Substituted");
    await expect(statusOf(page, projectors.name)).toContainText(`Instead: ${chairs.name} × 3`);
  });
});

test.describe("Q2 release equipment", () => {
  test("Q2-T13 technical support release once a reason is given and reserve again, the coordinator removes the Reserved line, and each release is told", { tag: ["@Q2", "@Q2-T13"] }, async ({ page, a11y }) => {
    test.setTimeout(120_000);
    // A Reserved chairs line, as Q1-T14 leaves one (reserved here in full).
    const event = await approvedRequest();
    const chairs = await createEquipmentType("Q2 Folding Chairs", 50);
    const [line] = await requestEquipment(event.id, [{ equipmentTypeId: chairs.id, quantity: 40 }]);
    await setLineStatus(line!.id, "CONFIRMED");
    await reserveInFull(line!.id);
    const release = `Release ${chairs.name} for ${event.reference}`;
    const reserve = `Reserve ${chairs.name} for ${event.reference}`;

    // Steps 1 and 2.
    await signIn(page, "techsupport");
    await page.getByRole("link", { name: "Equipment requests" }).click();
    const techRow = lineRow(page, chairs.name);
    await expect(techRow).toContainText("Reserved 40 of 40");
    await techRow.getByRole("button", { name: release }).click();
    await expect(page.getByRole("heading", { name: `Release ${chairs.name} × 40 for ${event.reference}` })).toBeVisible();

    // Step 3: no reason is refused inline, and the line stays Reserved.
    await page.getByRole("button", { name: "Release reservation" }).click();
    await expect(page.locator("#release-reason-error")).toHaveText("Give a reason for releasing the reservation.");
    await expect(techRow.getByRole("button", { name: release })).toBeVisible();
    expect((await lineOf(line!.id)).status).toBe("RESERVED");
    await a11y("release equipment, reason required");

    // Step 4: with a reason it is released; the line is Confirmed and can be reserved again.
    await page.getByLabel("Reason", { exact: true }).fill("Event moved");
    await page.getByRole("button", { name: "Release reservation" }).click();
    await expect(page.getByText("Equipment released", { exact: true })).toBeVisible();
    await expect(page.getByText(`Released ${chairs.name} for ${event.reference}: Event moved.`)).toBeVisible();
    await expect(statusOf(page, chairs.name)).toContainText("Confirmed");
    await expect(techRow.getByRole("button", { name: reserve })).toBeVisible();
    await a11y("equipment requests, released");

    // Step 5: reserve it again.
    await techRow.getByRole("button", { name: reserve }).click();
    await page.getByRole("button", { name: "Reserve equipment" }).click();
    await expect(page.getByText(`Reserved 40 of 40 for ${event.reference}.`)).toBeVisible();
    await expect(techRow.getByRole("button", { name: release })).toBeVisible();
    await signOut(page);

    // Steps 6 and 7: the coordinator removes the Reserved line; the dialog warns that its equipment will be released.
    await signIn(page, "coordinator");
    await openEquipmentRequest(page, event);
    await expect(statusOf(page, chairs.name)).toContainText("Reserved");
    await lineRow(page, chairs.name).getByRole("button", { name: "Remove" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText(`${chairs.name} × 40 will be marked Removed and no longer listed.`);
    await expect(dialog).toContainText("Its reserved equipment will be released.");
    await a11y("remove a reserved equipment line");
    await dialog.getByRole("button", { name: "Remove line" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(lineRow(page, chairs.name)).toHaveCount(0);
    expect((await lineOf(line!.id)).status).toBe("REMOVED");

    // Step 8: the line's messages reach the notification service (the test harness delivers them, as this stack
    // has no Kafka): Confirmed, Reserved, released, Reserved again, and released by the removal.
    expect(storedNotices(await deliverOutbox(event.id, { types: [LINE_CHANGED] }), LINE_CHANGED)).toBe(5);
    const notices = await openNotifications(page);
    const released = `The reservation of ${chairs.name} × 40 for ${named(event)} was released.`;
    await expect(messageOf(notices.filter({ hasText: released }).filter({ hasText: "Reason: Event moved" }))).toHaveText([
      `${released} The line is now Confirmed. Reason: Event moved`,
    ]);
    await expect(messageOf(notices.filter({ hasText: released }).filter({ hasText: "Reason: Request line removed" }))).toHaveText([
      `${released} The line is now Removed. Reason: Request line removed`,
    ]);
    await a11y("notifications, equipment released");
  });
});
