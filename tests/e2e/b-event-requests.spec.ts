import type { Page } from "@playwright/test";
import { expect, signIn, signOut, test, uniqueName } from "./support/fixtures.js";
import { CARD_END_LOCAL, CARD_START_LOCAL, rowWith, saveDraft, sideStatus, sideValue } from "./support/seed-events.js";

/**
 * B1, B2: an organiser submits an event request, and an incomplete or invalid one is refused
 * naming every field at fault. C1, C2: drafts are saved, reopened and submitted.
 */

const PURPOSE = "Share faculty research";
const DESCRIPTION = "A one-day symposium for the school of computing.";
const ACCESSIBILITY = "Step-free access to the stage";
const REFERENCE = /^EVT-\d{6}$/;

/** B2's message for each mandatory field left empty. */
const REQUIRED_MESSAGES = {
  "Event name": "Event name is required.",
  Purpose: "Purpose is required.",
  Description: "Description is required.",
  "Proposed start": "Proposed start date and time is required.",
  "Proposed end": "Proposed end date and time is required.",
  "Expected attendance": "Expected attendance is required.",
};

/** The standard request (tests/README.md), typed into the form, with a name no other run uses. */
async function enterStandardRequest(
  page: Page,
  name: string,
  changes: { start?: string; end?: string; attendance?: string } = {},
) {
  await page.getByLabel("Event name").fill(name);
  await page.getByLabel("Purpose").fill(PURPOSE);
  await page.getByLabel("Description").fill(DESCRIPTION);
  await page.getByLabel("Proposed start").fill(changes.start ?? CARD_START_LOCAL);
  await page.getByLabel("Proposed end").fill(changes.end ?? CARD_END_LOCAL);
  await page.getByLabel("Expected attendance").fill(changes.attendance ?? "150");
  await page.getByLabel("Accessibility needs").fill(ACCESSIBILITY);
}

/** The block a form field sits in: its label, the input and any message under it. */
function fieldBox(page: Page, label: string) {
  return page.locator("label").filter({ hasText: new RegExp(`^${label}`) }).locator("xpath=..");
}

async function openNewRequest(page: Page) {
  await page.getByRole("link", { name: "New request" }).click();
  await expect(page.getByRole("heading", { name: "New event request" })).toBeVisible();
}

async function expectNoRowIn(page: Page, name: string) {
  await page.getByRole("link", { name: "My requests" }).click();
  await expect(page.getByRole("heading", { name: "My requests" })).toBeVisible();
  // The list has loaded once the "All" filter and the table's header are drawn.
  await expect(page.getByRole("columnheader", { name: "Reference" })).toBeVisible();
  await expect(page.getByText(name)).toHaveCount(0);
}

async function expectRefusedUnder(page: Page, field: string, message: string) {
  await expect(page.getByText("VALIDATION_FAILED")).toBeVisible();
  await expect(page.getByText("This request is not ready to be submitted.")).toBeVisible();
  await expect(fieldBox(page, field)).toContainText(message);
}

test.describe("B1 submit an event request", () => {
  test(
    "B1-T1 an organiser submits a complete request, which needs no equipment, and the Lead can assign it",
    { tag: ["@B1", "@B1-T1", "@B2", "@B2-T14"] },
    async ({ page, a11y }) => {
      const name = uniqueName("Annual Research Symposium");
      await signIn(page, "organiser");
      await openNewRequest(page);
      await a11y("new event request");
      await enterStandardRequest(page, name);
      await page.getByRole("button", { name: "Submit request" }).click();

      await expect(page.getByRole("heading", { name })).toBeVisible();
      await expect(sideStatus(page)).toHaveText("Submitted");
      const reference = (await page.getByText(REFERENCE).textContent())!.trim();
      expect(reference).toMatch(REFERENCE);
      await expect(sideValue(page, "Submitted")).toHaveText(/\d{1,2}\/\d{1,2}\/\d{4}/);
      await expect(sideValue(page, "Organiser")).toHaveText("Organiser One");
      // B2-T14: with "Equipment is required" left unticked, the request needs no equipment.
      await expect(page.getByText("Equipment requirements").locator("xpath=..")).toContainText("None required");
      await a11y("request page");

      // Since E3 a new request waits for the Lead, not in a coordinator's review queue.
      await signOut(page);
      await signIn(page, "lead");
      await expect(page.getByRole("heading", { name: "Unassigned requests" })).toBeVisible();
      await expect(rowWith(page, name)).toContainText(reference);
    },
  );

  test("B1-T6 a blocked submission creates nothing and keeps the values typed", { tag: ["@B1", "@B1-T6"] }, async ({ page }) => {
    const name = uniqueName("Half-finished symposium");
    await signIn(page, "organiser");
    await openNewRequest(page);
    await page.getByLabel("Event name").fill(name);
    await page.getByLabel("Purpose").fill(PURPOSE);
    await page.getByRole("button", { name: "Submit request" }).click();

    await expect(page.getByText("VALIDATION_FAILED")).toBeVisible();
    await expect(page.getByLabel("Event name")).toHaveValue(name);
    await expect(page.getByLabel("Purpose")).toHaveValue(PURPOSE);
    await expectNoRowIn(page, name);
  });
});

test.describe("B2 validation of a submission", () => {
  test("B2-T1 submitting with every mandatory field empty names each one at once", { tag: ["@B2", "@B2-T1"] }, async ({ page, a11y }) => {
    await signIn(page, "organiser");
    await openNewRequest(page);
    await page.getByRole("button", { name: "Submit request" }).click();

    await expect(page.getByText("VALIDATION_FAILED")).toBeVisible();
    await expect(page.getByText("This request is not ready to be submitted.")).toBeVisible();
    // One refusal names all six, and each field shows its own message under it.
    for (const [label, message] of Object.entries(REQUIRED_MESSAGES)) {
      await expect(page.getByRole("listitem").filter({ hasText: message })).toHaveCount(1);
      await expect(fieldBox(page, label)).toContainText(message);
    }
    await a11y("new event request refused");
  });

  test("B2-T3 an end equal to the start is refused", { tag: ["@B2", "@B2-T3"] }, async ({ page }) => {
    const name = uniqueName("Annual Research Symposium");
    await signIn(page, "organiser");
    await openNewRequest(page);
    await enterStandardRequest(page, name, { end: CARD_START_LOCAL });
    await page.getByRole("button", { name: "Submit request" }).click();

    await expectRefusedUnder(page, "Proposed end", "The end date and time must be later than the start date and time.");
    await expectNoRowIn(page, name);
  });

  test("B2-T7 an expected attendance of 0 is refused", { tag: ["@B2", "@B2-T7"] }, async ({ page }) => {
    const name = uniqueName("Annual Research Symposium");
    await signIn(page, "organiser");
    await openNewRequest(page);
    await enterStandardRequest(page, name, { attendance: "0" });
    await page.getByRole("button", { name: "Submit request" }).click();

    await expectRefusedUnder(page, "Expected attendance", "Expected attendance must be a whole number from 1 to 1000000.");
    await expectNoRowIn(page, name);
  });

  test("B2-T12 registration closing exactly at the event start is accepted", { tag: ["@B2", "@B2-T12"] }, async ({ page }) => {
    const name = uniqueName("Annual Research Symposium");
    await signIn(page, "organiser");
    await openNewRequest(page);
    await enterStandardRequest(page, name);
    await page.getByRole("checkbox", { name: "Attendee registration is required" }).check();
    await page.getByLabel("Registration opens").fill("2026-11-20T09:00");
    await page.getByLabel("Registration closes").fill(CARD_START_LOCAL);
    await page.getByRole("button", { name: "Submit request" }).click();

    await expect(page.getByRole("heading", { name })).toBeVisible();
    await expect(sideStatus(page)).toHaveText("Submitted");
    await expect(page.getByText(REFERENCE)).toBeVisible();
  });

  test("B2-T13 registration closing one minute after the event start is refused", { tag: ["@B2", "@B2-T13"] }, async ({ page }) => {
    const name = uniqueName("Annual Research Symposium");
    await signIn(page, "organiser");
    await openNewRequest(page);
    await enterStandardRequest(page, name);
    await page.getByRole("checkbox", { name: "Attendee registration is required" }).check();
    await page.getByLabel("Registration opens").fill("2026-11-20T09:00");
    await page.getByLabel("Registration closes").fill("2026-12-02T14:01");
    await page.getByRole("button", { name: "Submit request" }).click();

    await expectRefusedUnder(page, "Registration closes", "Registration closing must be no later than the event start.");
    await expectNoRowIn(page, name);
  });

  test("B2-T15 a blocked submission from a draft changes no stored value", { tag: ["@B2", "@B2-T15"] }, async ({ page }) => {
    const name = uniqueName("Partly planned symposium");
    await signIn(page, "organiser");
    await openNewRequest(page);
    await page.getByLabel("Event name").fill(name);
    await page.getByLabel("Expected attendance").fill("100");
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByRole("heading", { name: "Edit draft" })).toBeVisible();

    await page.getByLabel("Expected attendance").fill("200");
    await page.getByRole("button", { name: "Submit request" }).click();
    await expect(page.getByText("VALIDATION_FAILED")).toBeVisible();

    await page.getByRole("link", { name: "My requests" }).click();
    const row = rowWith(page, name);
    await expect(row).toContainText("Draft");
    await expect(row.getByRole("cell").first()).toHaveText("—");
    await row.getByRole("link", { name: "Open draft" }).click();
    await expect(page.getByLabel("Expected attendance")).toHaveValue("100");
  });
});

test.describe("C1 save a draft", () => {
  test("C1-T1 a draft is saved with only the event name", { tag: ["@C1", "@C1-T1"] }, async ({ page, a11y }) => {
    await signIn(page, "organiser");
    await openNewRequest(page);
    await page.getByLabel("Event name").fill(uniqueName("Untitled idea"));
    await page.getByRole("button", { name: "Save draft" }).click();

    await expect(page.getByText(/^Saved as a draft at \d{1,2}:\d{2}:\d{2}/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Edit draft" })).toBeVisible();
    await expect(page).toHaveURL(/#\/drafts\/[0-9a-f-]{36}$/);
    await a11y("edit draft");
  });

  test("C1-T3 saving with no event name is refused, and nothing is stored", { tag: ["@C1", "@C1-T3"] }, async ({ page }) => {
    // The purpose is unique, so a stored row could be recognised by it.
    const purpose = uniqueName("Share faculty research");
    await signIn(page, "organiser");
    await openNewRequest(page);
    await page.getByLabel("Purpose").fill(purpose);
    await page.getByRole("button", { name: "Save draft" }).click();

    await expect(page.getByText("VALIDATION_FAILED")).toBeVisible();
    await expect(page.getByText("This draft could not be saved.")).toBeVisible();
    await expect(fieldBox(page, "Event name")).toContainText("Event name is required.");
    await expect(page.getByRole("heading", { name: "New event request" })).toBeVisible();
    await expectNoRowIn(page, purpose);
  });

  test("C1-T9 a draft is not visible to another organiser", { tag: ["@C1", "@C1-T9"] }, async ({ page }) => {
    const draft = await saveDraft({ name: uniqueName("Not ready to be seen") });
    await signIn(page, "organiser2");
    await page.getByRole("link", { name: "My requests" }).click();
    await expect(page.getByRole("columnheader", { name: "Reference" })).toBeVisible();
    await expect(page.getByText(draft.name)).toHaveCount(0);

    await page.goto(`/#/drafts/${draft.id}`);
    await expect(page.getByText("DRAFT_NOT_FOUND")).toBeVisible();
    await expect(page.getByText("No draft with that reference is available to you.")).toBeVisible();
    for (const label of ["Event name", "Purpose", "Description", "Proposed start", "Proposed end", "Expected attendance", "Accessibility needs"]) {
      await expect(page.getByLabel(label)).toHaveValue("");
    }
  });

  test("C1-T10 a failed save leaves the previously saved draft unchanged", { tag: ["@C1", "@C1-T10"] }, async ({ page }) => {
    const name = uniqueName("Original name");
    await signIn(page, "organiser");
    await openNewRequest(page);
    await page.getByLabel("Event name").fill(name);
    await page.getByLabel("Purpose").fill("Original purpose");
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByRole("heading", { name: "Edit draft" })).toBeVisible();
    await page.getByRole("link", { name: "My requests" }).click();
    const savedAt = (await rowWith(page, name).getByRole("cell").nth(3).textContent())!;
    expect(savedAt).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
    await rowWith(page, name).getByRole("link", { name: "Open draft" }).click();
    await expect(page.getByLabel("Event name")).toHaveValue(name);

    await page.getByLabel("Event name").fill("");
    await page.getByLabel("Purpose").fill("Changed purpose");
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByText("VALIDATION_FAILED")).toBeVisible();
    await expect(fieldBox(page, "Event name")).toContainText("Event name is required.");

    await page.getByRole("link", { name: "My requests" }).click();
    await expect(rowWith(page, name).getByRole("cell").nth(3)).toHaveText(savedAt);
    await rowWith(page, name).getByRole("link", { name: "Open draft" }).click();
    await expect(page.getByLabel("Event name")).toHaveValue(name);
    await expect(page.getByLabel("Purpose")).toHaveValue("Original purpose");
  });
});

test.describe("C2 reopen and submit a draft", () => {
  test("C2-T1 reopening a draft restores every saved field exactly", { tag: ["@C2", "@C2-T1"] }, async ({ page }) => {
    const name = uniqueName("Annual Research Symposium");
    await signIn(page, "organiser");
    await openNewRequest(page);
    await enterStandardRequest(page, name);
    await page.getByRole("checkbox", { name: "Equipment is required" }).check();
    await page.getByRole("checkbox", { name: "Attendee registration is required" }).check();
    await page.getByLabel("Registration opens").fill("2026-11-20T09:00");
    await page.getByLabel("Registration closes").fill("2026-12-01T17:00");
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByRole("heading", { name: "Edit draft" })).toBeVisible();

    await page.getByRole("link", { name: "My requests" }).click();
    await rowWith(page, name).getByRole("link", { name: "Open draft" }).click();
    await expect(page.getByLabel("Event name")).toHaveValue(name);
    await expect(page.getByLabel("Purpose")).toHaveValue(PURPOSE);
    await expect(page.getByLabel("Description")).toHaveValue(DESCRIPTION);
    await expect(page.getByLabel("Proposed start")).toHaveValue(CARD_START_LOCAL);
    await expect(page.getByLabel("Proposed end")).toHaveValue(CARD_END_LOCAL);
    await expect(page.getByLabel("Expected attendance")).toHaveValue("150");
    await expect(page.getByLabel("Accessibility needs")).toHaveValue(ACCESSIBILITY);
    await expect(page.getByRole("checkbox", { name: "Equipment is required" })).toBeChecked();
    await expect(page.getByRole("checkbox", { name: "Attendee registration is required" })).toBeChecked();
    await expect(page.getByLabel("Registration opens")).toHaveValue("2026-11-20T09:00");
    await expect(page.getByLabel("Registration closes")).toHaveValue("2026-12-01T17:00");
  });

  test("C2-T3 submitting a complete draft moves it to Submitted", { tag: ["@C2", "@C2-T3"] }, async ({ page }) => {
    const name = uniqueName("Annual Research Symposium");
    await signIn(page, "organiser");
    await openNewRequest(page);
    await enterStandardRequest(page, name);
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByRole("heading", { name: "Edit draft" })).toBeVisible();

    await page.getByRole("link", { name: "My requests" }).click();
    await rowWith(page, name).getByRole("link", { name: "Open draft" }).click();
    await page.getByRole("button", { name: "Submit request" }).click();
    await expect(page.getByRole("heading", { name })).toBeVisible();
    await expect(sideStatus(page)).toHaveText("Submitted");
    await expect(page.getByText(REFERENCE)).toBeVisible();
    await expect(sideValue(page, "Submitted")).toHaveText(/\d{1,2}\/\d{1,2}\/\d{4}/);

    await page.getByRole("link", { name: "My requests" }).click();
    const rows = rowWith(page, name);
    await expect(rows).toHaveCount(1);
    await expect(rows).toContainText("Submitted");
    await expect(rows.getByRole("link", { name: "View" })).toBeVisible();
    await expect(rows.getByRole("link", { name: "Open draft" })).toHaveCount(0);
  });

  test("C2-T4 submitting an incomplete draft applies the full submission validation", { tag: ["@C2", "@C2-T4"] }, async ({ page }) => {
    const draft = await saveDraft({ name: uniqueName("Only a name") });
    await signIn(page, "organiser");
    await page.getByRole("link", { name: "My requests" }).click();
    await rowWith(page, draft.name).getByRole("link", { name: "Open draft" }).click();
    await expect(page.getByLabel("Event name")).toHaveValue(draft.name);
    await page.getByRole("button", { name: "Submit request" }).click();

    await expect(page.getByText("VALIDATION_FAILED")).toBeVisible();
    // Every field the draft lacks is named at once, each under its own field; the name it has is not.
    for (const [label, message] of Object.entries(REQUIRED_MESSAGES).filter(([label]) => label !== "Event name")) {
      await expect(page.getByRole("listitem").filter({ hasText: message })).toHaveCount(1);
      await expect(fieldBox(page, label)).toContainText(message);
    }
    await expect(fieldBox(page, "Event name")).not.toContainText("is required");

    await page.getByRole("link", { name: "My requests" }).click();
    const row = rowWith(page, draft.name);
    await expect(row).toContainText("Draft");
    await expect(row.getByRole("cell").first()).toHaveText("—");
  });
});
