import type { Page } from "@playwright/test";
import { expect, signIn, test } from "./support/fixtures.js";
import { approvedRequest, createVenue, submitRequest, assign } from "./support/seed.js";

/**
 * EN-14: visual snapshots of key screens, compared against baselines made on CI's Linux runner.
 * The config runs these (and only these, of the journeys) in the 360, 768 and 1280 px projects.
 *
 * Each screen shows only rows this test seeds, under fixed names, so nothing another journey
 * wrote can change the picture. References, ids and every printed date or time are masked.
 * Fonts render differently on Windows and macOS, so the comparisons run on Linux only.
 */
test.skip(process.platform !== "linux" && !process.env.E2E_VISUAL_LOCAL, "Visual baselines are made on Linux CI");

const VISUAL = { fullPage: true };

/** What changes from run to run: references, and anything printed as a date or a time. */
function dynamic(page: Page) {
  return [
    page.getByText(/EVT-\d{6}|HLD-\d+|BKG-\d+/),
    page.getByText(/\d{1,2}:\d{2}/),
    page.getByText(/\b20\d\d\b/),
  ];
}

test.describe("visual snapshots", { tag: ["@visual", "@EN-14", "@EN-14-T6"] }, () => {
  test("EN-14-T6 sign-in screen", { tag: ["@A1"] }, async ({ page, a11y }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
    await a11y("sign-in");
    await expect(page).toHaveScreenshot("sign-in.png", VISUAL);
  });

  test("EN-14-T6 new event request form", { tag: ["@B1"] }, async ({ page, a11y }) => {
    await signIn(page, "organiser");
    await page.getByRole("link", { name: "New request" }).click();
    await expect(page.getByRole("heading", { name: "New event request" })).toBeVisible();
    await a11y("new event request");
    await expect(page).toHaveScreenshot("new-request.png", { ...VISUAL, mask: dynamic(page) });
  });

  test("EN-14-T6 organiser's approved request", { tag: ["@D4", "@F2"] }, async ({ page, a11y }) => {
    const event = await approvedRequest({ name: "Visual Snapshot Symposium" });
    await signIn(page, "organiser");
    await page.goto(`/#/requests/${event.id}`);
    await expect(page.getByRole("heading", { name: "Visual Snapshot Symposium" })).toBeVisible();
    await expect(page.getByText("This request was approved")).toBeVisible();
    await a11y("request detail");
    await expect(page).toHaveScreenshot("request-detail.png", { ...VISUAL, mask: dynamic(page) });
  });

  test("EN-14-T6 coordinator's review of a request", { tag: ["@D1"] }, async ({ page, a11y }) => {
    const event = await submitRequest({ name: "Visual Review Symposium" });
    await assign(event.id, "coordinator");
    await signIn(page, "coordinator");
    await page.goto(`/#/review/${event.id}`);
    await expect(page.getByRole("heading", { name: "Visual Review Symposium" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Approve" })).toBeVisible();
    await a11y("review detail");
    await expect(page).toHaveScreenshot("review-detail.png", { ...VISUAL, mask: dynamic(page) });
  });

  test("EN-14-T6 venue detail", { tag: ["@H2"] }, async ({ page, a11y }) => {
    const venue = await createVenue({ name: "Visual Snapshot Auditorium" });
    await signIn(page, "coordinator");
    await page.goto(`/#/venues/${venue.id}`);
    await expect(page.getByRole("heading", { name: "Visual Snapshot Auditorium" })).toBeVisible();
    await a11y("venue detail");
    await expect(page).toHaveScreenshot("venue-detail.png", { ...VISUAL, mask: dynamic(page) });
  });

  test("EN-14-T6 venue availability week", { tag: ["@I1"] }, async ({ page, a11y }) => {
    const venue = await createVenue({ name: "Visual Calendar Auditorium" });
    await signIn(page, "coordinator");
    await page.goto(`/#/venues/${venue.id}/availability`);
    await expect(page.getByRole("heading", { name: "Visual Calendar Auditorium" })).toBeVisible();
    await page.getByLabel("From").fill("2027-03-01");
    await page.getByLabel("To").fill("2027-03-07");
    await page.getByRole("button", { name: "Show" }).click();
    await expect(page.locator("#day-2027-03-07")).toBeVisible();
    await a11y("venue availability");
    await expect(page).toHaveScreenshot("venue-availability.png", VISUAL);
  });
});
