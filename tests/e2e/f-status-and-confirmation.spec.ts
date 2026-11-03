import type { Locator, Page } from "@playwright/test";
import { expect, signIn, signOut, test } from "./support/fixtures.js";
import { must } from "./support/api.js";
import { approvedRequest, createVenue, submitRequest, underReviewRequest } from "./support/seed.js";
import { confirmedBooking, createEquipmentType, requestEquipment, setLineStatus } from "./support/seed-arrangements.js";

/**
 * F2 (status and its history), F5 (confirming the arrangements, to Safety Review) and G1 (editing
 * an event's descriptive details), through the real screens.
 */

const row = (page: Page, text: string) => page.getByRole("row").filter({ hasText: text });
const statusPanel = (page: Page) => page.locator("aside").filter({ has: page.getByRole("heading", { name: "Status" }) });
const historyRows = (page: Page) => page.locator("section[aria-labelledby='status-history-heading'] tbody tr");

/** One history row: From, To, By (role, then the user's name), When. */
async function expectHistoryRow(entry: Locator, from: string, to: string, role: string) {
  const cells = entry.getByRole("cell");
  await expect(cells.nth(0)).toHaveText(from);
  await expect(cells.nth(1)).toHaveText(to);
  await expect(cells.nth(2)).toContainText(role);
  // A date and a time, as the browser formats them (en-SG: 02/03/2027, 2:00:00 pm).
  await expect(cells.nth(3)).toHaveText(/\d{1,2}\/\d{1,2}\/\d{4}, \d{1,2}:\d{2}:\d{2}\s?(am|pm)/i);
}

async function expectApprovedHistory(page: Page) {
  await expect(historyRows(page)).toHaveCount(3);
  await expectHistoryRow(historyRows(page).nth(0), "Draft", "Submitted", "Event Organiser");
  await expectHistoryRow(historyRows(page).nth(1), "Submitted", "Under Review", "Event Coordinator");
  await expectHistoryRow(historyRows(page).nth(2), "Under Review", "Approved", "Event Coordinator");
}

async function openFromMyRequests(page: Page, name: string) {
  await page.getByRole("link", { name: "My requests" }).click();
  await row(page, name).getByRole("link", { name: "View" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
}

async function openFromAllEvents(page: Page, name: string) {
  await page.getByRole("link", { name: "All events" }).click();
  await row(page, name).getByRole("link", { name: "Open" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
}

test.describe("F2 status and status history", () => {
  test("F2-T1 the owning organiser sees the current status and the full history of their event", { tag: ["@F2", "@F2-T1"] }, async ({ page, a11y }) => {
    const event = await approvedRequest();
    await signIn(page, "organiser");
    await openFromMyRequests(page, event.name);

    await expect(statusPanel(page)).toContainText("Approved");
    await expectApprovedHistory(page);
    await a11y("organiser request detail");
  });

  test("F2-T2 the assigned coordinator sees the full history", { tag: ["@F2", "@F2-T2"] }, async ({ page, a11y }) => {
    const event = await approvedRequest();
    await signIn(page, "coordinator");
    await openFromAllEvents(page, event.name);

    await expect(statusPanel(page)).toContainText("Approved");
    await expect(statusPanel(page)).toContainText("Assigned coordinator");
    await expect(statusPanel(page)).toContainText("Coordinator One");
    await expectApprovedHistory(page);
    await a11y("coordinator review detail");
  });

  test("F2-T3 an Event Coordinator who is not assigned to the event does not see it or its history", { tag: ["@F2", "@F2-T3"] }, async ({ page }) => {
    // A4 (CR-05) revised the card: A3's "coordinators see every event" is superseded.
    const event = await approvedRequest();
    await signIn(page, "coordinator2");
    await page.getByRole("link", { name: "All events" }).click();
    await expect(page.getByRole("heading", { name: "All events" })).toBeVisible();
    await expect(page.getByText(event.name)).toHaveCount(0);

    await page.goto(`/#/review/${event.id}`);
    await expect(page.getByText("No event with that reference is assigned to you.")).toBeVisible();
    await expect(page.getByText(event.name)).toHaveCount(0);
    await expect(page.getByText("Status history")).toHaveCount(0);
    await expect(page.getByText("Coordinator One")).toHaveCount(0);
  });

  test("F2-T5 history entries are chronological and show the previous and new status, role and time", { tag: ["@F2", "@F2-T5"] }, async ({ page }) => {
    const event = await underReviewRequest();
    await must("coordinator", "POST", `/api/v1/events/${event.id}/reject`, { reason: "No suitable venue is available." });
    await signIn(page, "organiser");
    await openFromMyRequests(page, event.name);

    await expect(historyRows(page)).toHaveCount(3);
    await expectHistoryRow(historyRows(page).nth(0), "Draft", "Submitted", "Event Organiser");
    await expectHistoryRow(historyRows(page).nth(1), "Submitted", "Under Review", "Event Coordinator");
    await expectHistoryRow(historyRows(page).nth(2), "Under Review", "Rejected", "Event Coordinator");

    // Each row's From is the To of the row above, and no time is earlier than the one above.
    const rows = await historyRows(page).evaluateAll((trs) =>
      trs.map((tr) => [...tr.querySelectorAll("td")].map((td) => td.textContent?.trim() ?? "")),
    );
    for (let i = 1; i < rows.length; i++) expect(rows[i]![0]).toBe(rows[i - 1]![1]);
    const times = await page.evaluate(async (id) => {
      const stored = JSON.parse(sessionStorage.getItem("connectsphere.session") ?? "{}") as { token?: string };
      const response = await fetch(`/event/api/v1/events/${id}/status-history`, { headers: { Authorization: `Bearer ${stored.token}` } });
      const body = (await response.json()) as { items: { occurredAt: string }[] };
      return body.items.map((item) => Date.parse(item.occurredAt));
    }, event.id);
    expect(times).toHaveLength(3);
    for (let i = 1; i < times.length; i++) expect(times[i]!).toBeGreaterThanOrEqual(times[i - 1]!);
  });

  test("F2-T6 an event with one history entry shows exactly that entry", { tag: ["@F2", "@F2-T6"] }, async ({ page }) => {
    const event = await submitRequest();
    await signIn(page, "organiser");
    await openFromMyRequests(page, event.name);

    await expect(statusPanel(page)).toContainText("Submitted");
    await expect(historyRows(page)).toHaveCount(1);
    await expectHistoryRow(historyRows(page).first(), "Draft", "Submitted", "Event Organiser");
    await expect(page.getByText("No status changes recorded.")).toHaveCount(0);
  });
});

test.describe("G1 edit an event's descriptive details", () => {
  test("G1-T1 the owning organiser edits the descriptive details of an approved event", { tag: ["@G1", "@G1-T1"] }, async ({ page, a11y }) => {
    const event = await approvedRequest();
    await signIn(page, "organiser");
    await openFromMyRequests(page, event.name);
    const before = {
      start: (await page.getByText("Proposed start").locator("..").textContent()) ?? "",
      end: (await page.getByText("Proposed end").locator("..").textContent()) ?? "",
      attendance: (await page.getByText("Expected attendance").locator("..").textContent()) ?? "",
      venue: (await page.getByText("Venue requirements").locator("..").textContent()) ?? "",
      equipment: (await page.getByText("Equipment requirements").locator("..").textContent()) ?? "",
    };

    await page.getByRole("button", { name: "Edit details" }).click();
    await expect(page.getByRole("heading", { name: "Edit event details" })).toBeVisible();
    await a11y("edit event details");
    await page.getByLabel("Purpose").fill("Share faculty research with industry partners");
    await page.getByLabel("Description").fill("A one-day symposium for the school of computing, with an industry panel.");
    await page.getByLabel("Accessibility notes").fill("Step-free access to the stage, and a hearing loop");
    await page.getByLabel("Contact details").fill("Dr Mei Lin Tan, meilin.tan@smu.edu.sg, 6828 0123");
    await page.getByRole("button", { name: "Save details" }).click();

    await expect(page.getByText("Details saved.")).toBeVisible();
    await expect(page.getByRole("heading", { name: event.name })).toBeVisible();
    await expect(page.getByText("Share faculty research with industry partners")).toBeVisible();
    await expect(page.getByText("A one-day symposium for the school of computing, with an industry panel.")).toBeVisible();
    await expect(page.getByText("Step-free access to the stage, and a hearing loop")).toBeVisible();
    await expect(page.getByText("Dr Mei Lin Tan, meilin.tan@smu.edu.sg, 6828 0123")).toBeVisible();
    await expect(statusPanel(page)).toContainText("Approved");
    await expect(page.getByText("Proposed start").locator("..")).toHaveText(before.start);
    await expect(page.getByText("Proposed end").locator("..")).toHaveText(before.end);
    await expect(page.getByText("Expected attendance").locator("..")).toHaveText(before.attendance);
    await expect(page.getByText("Expected attendance").locator("..")).toContainText("150");
    await expect(page.getByText("Venue requirements").locator("..")).toHaveText(before.venue);
    await expect(page.getByText("Equipment requirements").locator("..")).toHaveText(before.equipment);
  });

  test("G1-T5 the significant fields are read-only and point to a change request", { tag: ["@G1", "@G1-T5"] }, async ({ page }) => {
    // The standard request at the card's 14:00 to 18:00, on 2 December 2030 rather than 2026 so it never falls in the past.
    // Recorded venue and equipment requirements, so there is something to show read-only.
    const event = await approvedRequest({
      proposedStartAt: "2030-12-02T06:00:00.000Z",
      proposedEndAt: "2030-12-02T10:00:00.000Z",
      venueRequirements: { layout: "Theatre", facilities: ["Projector"] },
      equipmentRequired: true,
      equipmentRequirements: [{ equipmentType: "Wireless microphone", quantity: 2 }],
    });
    await signIn(page, "organiser");
    await openFromMyRequests(page, event.name);
    await page.getByRole("button", { name: "Edit details" }).click();
    await expect(page.getByRole("heading", { name: "Edit event details" })).toBeVisible();

    // Only the four descriptive fields take typing.
    const typeable = page.locator("form input:not([type=hidden]):not([type=checkbox]), form textarea, form select");
    await expect(typeable).toHaveCount(4);
    for (const label of ["Purpose", "Description", "Accessibility notes", "Contact details"]) {
      await expect(page.getByLabel(label)).toBeEditable();
    }

    const locked = page.locator("section[aria-labelledby='details-locked']");
    await expect(locked.getByRole("heading", { name: "Changed only through a change request" })).toBeVisible();
    await expect(locked).toContainText("These can be changed only through a change request, because the arrangements already made depend on them.");
    const [start, end] = await page.evaluate(() => [
      new Date("2030-12-02T06:00:00.000Z").toLocaleString(),
      new Date("2030-12-02T10:00:00.000Z").toLocaleString(),
    ]);
    await expect(locked).toContainText(`${start} to ${end}`);
    await expect(locked).toContainText("2/12/2030, 2:00:00 pm");
    await expect(locked).toContainText("2/12/2030, 6:00:00 pm");
    await expect(locked.getByText("Expected attendance").locator("..")).toContainText("150");
    await expect(locked.getByText("Venue requirements").locator("..")).toContainText("Room layout: Theatre");
    await expect(locked.getByText("Venue requirements").locator("..")).toContainText("Facilities: Projector");
    await expect(locked.getByText("Equipment requirements").locator("..")).toContainText("2 × Wireless microphone");
    await expect(locked.locator("input, textarea, select")).toHaveCount(0);
  });
});

test.describe("F5 confirm the arrangements", () => {
  test("F5-T21 the assigned coordinator is refused while equipment is outstanding, then confirms to Safety Review", { tag: ["@F5", "@F5-T21"] }, async ({ page, a11y }) => {
    // FX-BOOKING: an approved event that needs equipment, a venue booking Venue Staff approved,
    // and one equipment line Technical Support set Confirmed but did not reserve.
    const event = await approvedRequest({
      equipmentRequired: true,
      equipmentRequirements: [{ equipmentType: "Folding chairs", quantity: 5 }],
    });
    const venue = await createVenue();
    await confirmedBooking(event.id, venue.id);
    const chairs = await createEquipmentType("F5 Chairs", 20);
    const [line] = await requestEquipment(event.id, [{ equipmentTypeId: chairs.id, quantity: 5 }]);
    await setLineStatus(line!.id, "CONFIRMED");

    // Steps 1 and 2: confirming is refused, naming the line.
    await signIn(page, "coordinator");
    await openFromAllEvents(page, event.name);
    await page.getByRole("button", { name: "Confirm arrangements" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Confirm the venue and equipment arrangements?")).toBeVisible();
    await a11y("confirm arrangements dialog");
    await dialog.getByRole("button", { name: "Confirm arrangements" }).click();
    await expect(dialog.getByText("This event can't be confirmed yet.", { exact: false })).toBeVisible();
    const outstanding = dialog.getByLabel("Outstanding arrangements");
    await expect(outstanding.getByRole("listitem")).toHaveText([`${chairs.name} × 5 is Confirmed.`]);
    await expect(dialog).toBeVisible();
    await expect(statusPanel(page).getByText("Approved", { exact: true })).toBeAttached();
    await a11y("confirm arrangements dialog, refused");
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(statusPanel(page).getByText("Approved", { exact: true })).toBeVisible();

    // A different coordinator can't open the event at all (A4), so is offered no "Confirm arrangements".
    await signOut(page);
    await signIn(page, "coordinator2");
    await page.getByRole("link", { name: "All events" }).click();
    await expect(page.getByRole("heading", { name: "All events" })).toBeVisible();
    await expect(page.getByText(event.name)).toHaveCount(0);
    await page.goto(`/#/review/${event.id}`);
    await expect(page.getByText("No event with that reference is assigned to you.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Confirm arrangements" })).toHaveCount(0);

    // Step 3: Technical Support reserve the line in full (Q1-T1's steps).
    await signOut(page);
    await signIn(page, "techsupport");
    await page.getByRole("link", { name: "Equipment requests" }).click();
    await row(page, chairs.name).getByRole("button", { name: `Reserve ${chairs.name} for ${event.reference}` }).click();
    await page.getByRole("button", { name: "Reserve equipment" }).click();
    await expect(page.getByText(`Reserved 5 of 5 for ${event.reference}.`)).toBeVisible();

    // Step 4: now the arrangements confirm, to Safety Review.
    await signOut(page);
    await signIn(page, "coordinator");
    await openFromAllEvents(page, event.name);
    await page.getByRole("button", { name: "Confirm arrangements" }).click();
    await dialog.getByRole("button", { name: "Confirm arrangements" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(statusPanel(page).getByText("Safety Review", { exact: true })).toBeVisible();
    await expect(statusPanel(page).getByText("Confirmed", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Confirm arrangements" })).toHaveCount(0);

    // Step 5: the history's newest row is Approved to Safety Review, by the coordinator.
    await expect(historyRows(page)).toHaveCount(4);
    await expectHistoryRow(historyRows(page).nth(3), "Approved", "Safety Review", "Event Coordinator");
    await expect(historyRows(page).nth(3)).toContainText("Coordinator One");
    await a11y("coordinator review detail, safety review");

  });
});
