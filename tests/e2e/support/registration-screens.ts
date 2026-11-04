import { expect, type Locator, type Page } from "@playwright/test";
import { captureResponse, singaporeMoment, type Envelope, type FxEvent, type RegistrationBody } from "./seed-registration.js";

/** The attendee's screens (R1 to R4), shared by the registration journeys (r-registration.spec.ts, r-management.spec.ts). */

export const attendeeNav = (page: Page) => page.getByRole("navigation", { name: "Attendee" });
export const eventCard = (page: Page, name: string) => page.getByRole("article", { name, exact: true });
export const eventPage = (page: Page) => page.getByRole("main").getByRole("article");
export const registerButton = (page: Page) => page.getByRole("button", { name: "Register", exact: true });
export const registrationList = (page: Page) => page.getByRole("list", { name: "My registrations" });
export const registrationRow = (page: Page, name: string) =>
  registrationList(page)
    .getByRole("listitem")
    .filter({ has: page.getByRole("heading", { name, exact: true }) });
export const withdrawButton = (row: Locator) => row.getByRole("button", { name: "Withdraw", exact: true });

export async function openEvents(page: Page) {
  await attendeeNav(page).getByRole("link", { name: "Events", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Events", level: 1, exact: true })).toBeVisible();
}

export async function openMyRegistrations(page: Page) {
  await attendeeNav(page).getByRole("link", { name: "My registrations", exact: true }).click();
  await expect(page.getByRole("heading", { name: "My registrations", level: 1, exact: true })).toBeVisible();
}

/** "Find the card for <name>" and "Click View event". */
export async function viewEvent(page: Page, name: string) {
  await expect(eventCard(page, name)).toBeVisible();
  await eventCard(page, name).getByRole("link", { name: "View event" }).click();
  await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
}

/** "Click Events, find <name> and click View event". */
export async function openEventFromEvents(page: Page, name: string) {
  await openEvents(page);
  await viewEvent(page, name);
}

/** R2-T1 steps 1 and 2: open the event from Events and click Register. */
export async function registerFromEventPage(page: Page, event: FxEvent) {
  await openEventFromEvents(page, event.name);
  const created = await captureResponse<RegistrationBody & Envelope>(page, "POST", "/registrations", () => registerButton(page).click());
  expect(created.status).toBe(201);
  await expect(page.getByText("You are registered")).toBeVisible();
  await expect(page.getByRole("main")).toContainText(`Registration ${created.body.reference} for ${event.name} is confirmed.`);
  return created.body;
}

/**
 * The browse routes may be cached for a few seconds (EN-12: max-age 5, stale-while-revalidate 30), so
 * the places remaining shown right after a registration can be the previous count. A person reloads;
 * so does this, until the page shows the count, and fails if it never does.
 */
export async function expectPlaces(page: Page, text: string) {
  await expect(async () => {
    await page.reload();
    await expect(eventPage(page)).toContainText(text, { timeout: 4_000 });
  }).toPass({ timeout: 60_000, intervals: [1_000, 2_000, 3_000] });
}

/** The text of a registration's row: `REG-… · Registered <day>, <time>`. */
export const registeredAs = (registeredAt: Date) => `Registered ${singaporeMoment(registeredAt)}`;
export const withdrawnAs = (withdrawnAt: Date) => `Withdrawn ${singaporeMoment(withdrawnAt)}`;
