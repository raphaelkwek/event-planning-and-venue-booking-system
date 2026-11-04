import type { Page } from "@playwright/test";
import { expect, signIn, signOut, test } from "./support/fixtures.js";
import { deliverOutbox } from "./support/deliver.js";
import { messageOf, openNotifications } from "./support/notifications.js";
import { approvedRequest } from "./support/seed.js";
import { requestChange } from "./support/seed-arrangements.js";

/**
 * S1 (the organiser requests a change to a significant field) and S2 (the assigned coordinator
 * decides it), through the real screens. The notifications both cards end on are built by the
 * notification service from Kafka messages, and this stack runs without Kafka, so each journey
 * hands the change module's message to the notification service with deliverOutbox
 * (support/deliver.ts) before the recipient opens Notifications.
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

/** How the notices name an event: its reference, then its name in quotes. */
const labelOf = (event: { reference: string; name: string }) => `${event.reference} “${event.name}”`;

test.describe("S1 request a change", () => {
  test("S1-T13 the organiser requests a change: nothing changed, a missing reason, then the pending notice and the coordinator's notification", { tag: ["@S1", "@S1-T13"] }, async ({ page, a11y }) => {
    // The delivery in step 5 runs the consumers in a process of their own, which takes a few seconds.
    test.setTimeout(120_000);
    const event = await approvedRequest();
    await signIn(page, "organiser");
    await openFromMyRequests(page, event.name);
    await page.getByRole("button", { name: "Request a change" }).click();
    const form = page.getByRole("form", { name: "Request a change" });
    await expect(form).toBeVisible();
    await a11y("request a change form");

    // Step 2: nothing changed, so nothing is sent.
    const posted: string[] = [];
    page.on("request", (request) => {
      if (request.method() === "POST" && new URL(request.url()).pathname.endsWith("/change-requests")) posted.push(request.url());
    });
    await form.getByRole("button", { name: "Send request" }).click();
    await expect(form.getByRole("status")).toHaveText("You haven't changed anything.");
    await expect(page.getByText("A change is pending")).toHaveCount(0);
    expect(posted).toEqual([]);

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

    // Step 5: the request's message reaches the notification service (in place of Kafka). The
    // coordinator's notification names the request, and opening it shows the same pending notice.
    const delivered = await deliverOutbox(event.id, { types: ["change-request.submitted"] });
    expect(delivered).toEqual([{ outbox: "change.outbox", type: "change-request.submitted", consumer: "notification", outcome: "stored" }]);
    await signOut(page);
    await signIn(page, "coordinator");
    const notices = await openNotifications(page);
    const notice = notices.filter({ hasText: event.name });
    await expect(messageOf(notice)).toHaveText([`A change has been requested for ${labelOf(event)}: expected attendance.`]);
    await notice.getByRole("button", { name: "Open" }).click();
    await expect(page.getByRole("heading", { name: event.name })).toBeVisible();
    const pending = page.getByRole("region", { name: "Pending change" });
    await expect(pending).toContainText(`Change requested on ${date}: expected attendance (Pending)`);
    await expect(pending).toContainText("Reason: More people registered");
  });
});

test.describe("S2 decide a change request", () => {
  test("S2-T12 the coordinator approves one change and rejects another with a reason, and the organiser sees and is told of both", { tag: ["@S2", "@S2-T12"] }, async ({ page, a11y }) => {
    // The deliveries in step 5 run the consumers in a process of their own, which takes a few seconds each.
    test.setTimeout(120_000);
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
    const decisions: string[] = [];
    page.on("request", (request) => {
      if (request.method() === "POST" && new URL(request.url()).pathname.endsWith("/decision")) decisions.push(request.url());
    });
    await dialog.getByRole("button", { name: "Confirm rejection" }).click();
    await expect(dialog).toContainText("Give a reason for rejecting the change.");
    await expect(dialog).toBeVisible();
    expect(decisions).toEqual([]);
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

    // Step 5: the two decisions' messages reach the notification service (in place of Kafka); the
    // organiser opens both requests, then Notifications.
    for (const [event, type] of [
      [first, "change-request.approved"],
      [second, "change-request.rejected"],
    ] as const) {
      const delivered = await deliverOutbox(event.id, { types: [type] });
      expect(delivered).toEqual([{ outbox: "change.outbox", type, consumer: "notification", outcome: "stored" }]);
    }
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

    // Two entries, one for each outcome.
    const notices = await openNotifications(page);
    await expect(messageOf(notices.filter({ hasText: first.name }))).toHaveText([
      `Your change request for ${labelOf(first)} was approved: expected attendance.`,
    ]);
    await expect(messageOf(notices.filter({ hasText: second.name }))).toHaveText([
      `Your change request for ${labelOf(second)} was rejected. Reason: No larger hall`,
    ]);
  });
});
