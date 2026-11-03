import type { Page } from "@playwright/test";
import { expect, signIn, signOut, test } from "./support/fixtures.js";
import { approvedRequest } from "./support/seed.js";
import { requestChange } from "./support/seed-arrangements.js";

/**
 * S1 (the organiser requests a change to a significant field) and S2 (the assigned coordinator
 * decides it), through the real screens. The notifications both cards end on are built by the
 * notification service from Kafka messages, and this stack runs without Kafka, so they are not
 * checked here.
 */

const row = (page: Page, text: string) => page.getByRole("row").filter({ hasText: text });
/** The page's own detail block for a field: a label div followed by its value. */
const detail = (page: Page, label: string) => page.locator(`xpath=//div[div[normalize-space()="${label}"] and count(div)=2]`).first();

async function openFromMyRequests(page: Page, name: string) {
  await page.getByRole("link", { name: "My requests" }).click();
  await row(page, name).getByRole("link", { name: "View" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
}

async function openReviewPage(page: Page, name: string) {
  await page.getByRole("link", { name: "All events" }).click();
  await row(page, name).getByRole("link", { name: "Open" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
}

/** Today's date as the screens write it (toLocaleDateString in the browser's locale and zone). */
const today = (page: Page) => page.evaluate(() => new Date().toLocaleDateString());

test.describe("S1 request a change", () => {
  test("S1-T13 the organiser requests a change: nothing changed, a missing reason, then the pending notice", { tag: ["@S1", "@S1-T13"] }, async ({ page, a11y }) => {
    const event = await approvedRequest();
    await signIn(page, "organiser");
    await openFromMyRequests(page, event.name);
    await page.getByRole("button", { name: "Request a change" }).click();
    const form = page.getByRole("form", { name: "Request a change" });
    await expect(form).toBeVisible();
    await a11y("request a change form");

    // Step 2: nothing changed, so nothing is sent.
    await form.getByRole("button", { name: "Send request" }).click();
    await expect(form.getByRole("status")).toHaveText("You haven't changed anything.");
    await expect(page.getByText("A change is pending")).toHaveCount(0);

    // Step 3: a change with no reason is refused beside Reason.
    await form.getByLabel("Expected attendance").fill("180");
    await form.getByRole("button", { name: "Send request" }).click();
    const reasonBlock = page.locator('xpath=//label[@for="change-reason"]/..');
    await expect(reasonBlock.getByRole("alert")).toBeVisible();
    await expect(page.getByText("A change is pending")).toHaveCount(0);
    await a11y("request a change form, reason refused");

    // Step 4: with a reason it is sent, and the page says it is pending.
    await form.getByLabel("Reason").fill("More people registered");
    await form.getByRole("button", { name: "Send request" }).click();
    await expect(form).toHaveCount(0);
    const date = await today(page);
    await expect(page.getByText(`Change requested on ${date}: expected attendance (Pending)`)).toBeVisible();
    await expect(page.getByRole("button", { name: "Request a change" })).toHaveCount(0);
    await a11y("organiser request detail, change pending");

    // Step 5 (the request page; the coordinator's notification needs Kafka).
    await signOut(page);
    await signIn(page, "coordinator");
    await openReviewPage(page, event.name);
    const pending = page.getByRole("region", { name: "Pending change" });
    await expect(pending).toContainText(`Change requested on ${date}: expected attendance (Pending)`);
    await expect(pending).toContainText("Reason: More people registered");
  });
});

test.describe("S2 decide a change request", () => {
  test("S2-T12 the coordinator approves one change and rejects another with a reason, and the organiser sees both", { tag: ["@S2", "@S2-T12"] }, async ({ page, a11y }) => {
    const first = await approvedRequest();
    const second = await approvedRequest();
    await requestChange(first.id, { expectedAttendance: 180 }, "More people registered");
    await requestChange(second.id, { expectedAttendance: 180 }, "More people registered");

    await signIn(page, "coordinator");
    const date = await today(page);

    // Step 1: approve the first, with confirmation.
    await openReviewPage(page, first.name);
    await page.getByRole("button", { name: "Approve change" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("expected attendance: 150 → 180");
    await a11y("approve change dialog");
    await dialog.getByRole("button", { name: "Confirm approval" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText(`Change approved on ${date}`)).toBeVisible();
    await expect(detail(page, "Expected attendance")).toContainText("180");
    await a11y("coordinator review detail, change approved");

    // Steps 2 and 3: reject the second, first without a reason.
    await openReviewPage(page, second.name);
    await page.getByRole("button", { name: "Reject change" }).click();
    await expect(dialog).toBeVisible();
    await a11y("reject change dialog");
    await dialog.getByRole("button", { name: "Confirm rejection" }).click();
    await expect(dialog).toContainText("Give a reason for rejecting the change.");
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Reason").fill("No larger hall");
    await dialog.getByRole("button", { name: "Confirm rejection" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText(`Change rejected on ${date}: No larger hall`)).toBeVisible();
    await expect(detail(page, "Expected attendance")).toContainText("150");

    // Step 4: neither page offers a decision any more.
    for (const event of [first, second]) {
      await openReviewPage(page, event.name);
      await expect(page.getByText(/Change (approved|rejected) on/)).toBeVisible();
      await expect(page.getByRole("button", { name: "Approve change" })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Reject change" })).toHaveCount(0);
    }

    // Step 5 (the request pages; the organiser's notifications need Kafka).
    await signOut(page);
    await signIn(page, "organiser");
    await openFromMyRequests(page, first.name);
    await expect(page.getByText(`Change approved on ${date}`)).toBeVisible();
    await expect(detail(page, "Expected attendance")).toContainText("180");
    await expect(page.getByRole("button", { name: "Request a change" })).toBeVisible();
    await a11y("organiser request detail, change decided");

    await openFromMyRequests(page, second.name);
    await expect(page.getByText(`Change rejected on ${date}: No larger hall`)).toBeVisible();
    await expect(detail(page, "Expected attendance")).toContainText("150");
    await expect(page.getByRole("button", { name: "Request a change" })).toBeVisible();
  });
});
