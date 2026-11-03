import type { Page } from "@playwright/test";
import { expect, signIn, signOut, test, uniqueName } from "./support/fixtures.js";
import { approvedRequest } from "./support/seed.js";
import { createEquipmentType, requestEquipment, setLineStatus } from "./support/seed-arrangements.js";

/**
 * P2 (inventory), O1 (the coordinator's equipment request) and Q1 (reservation), through the real
 * screens. Equipment types are created with unique names, so each test sees only its own.
 */

const row = (page: Page, text: string) => page.getByRole("row").filter({ hasText: text });
/** A form field's own block: its label, its control and the message bound to it. */
const fieldBlock = (page: Page, id: string) => page.locator(`xpath=//label[@for="${id}"]/..`);

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

    await expect(fieldBlock(page, "equipment-total")).toContainText("Total quantity must be a whole number of zero or greater.");
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

    // Step 5 (the coordinator's view of the request; the notification needs Kafka, which this stack leaves out).
    await signOut(page);
    await signIn(page, "coordinator");
    await page.goto(`/#/events/${event.id}/equipment`);
    await expect(page.getByRole("heading", { name: "Equipment request" })).toBeVisible();
    const coordinatorRow = row(page, chairs.name);
    await expect(coordinatorRow).toContainText("Reserved");
    await expect(coordinatorRow).toContainText("Reserved 30 of 40");
    await expect(coordinatorRow).toContainText("Tech Support One ·");
  });
});
