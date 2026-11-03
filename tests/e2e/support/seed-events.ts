import postgres from "postgres";
import { expect, type Locator, type Page } from "@playwright/test";
import type { AccountKey } from "./accounts.js";
import { must } from "./api.js";
import { assign, submitRequest, underReviewRequest, type EventRow } from "./seed.js";

/**
 * Extra setup procedures and screen helpers for the sign-in, request and review journeys
 * (A1-A3, B1, B2, C1, C2, D1, D2, D4, D5).
 */

/** The standard request's own date (tests/README.md): 2 December 2026, 14:00 to 18:00 in Singapore. */
export const CARD_START = "2026-12-02T06:00:00.000Z";
export const CARD_END = "2026-12-02T10:00:00.000Z";
/** The same, as a datetime-local field takes it in the browser's Singapore time zone. */
export const CARD_START_LOCAL = "2026-12-02T14:00";
export const CARD_END_LOCAL = "2026-12-02T18:00";

/** FX-AWAITING: the assigned coordinator asks the organiser for clarification (D2). */
export async function awaitingRequest(overrides: Record<string, unknown> = {}, message = "Please confirm the expected attendance.") {
  const event = await underReviewRequest(overrides);
  await must("coordinator", "POST", `/api/v1/events/${event.id}/clarifications`, { message });
  return event;
}

/** FX-REJECTED: the assigned coordinator rejects it with the README's reason (D5). */
export async function rejectedRequest(overrides: Record<string, unknown> = {}, reason = "No suitable venue is available.") {
  const event = await underReviewRequest(overrides);
  return must<EventRow>("coordinator", "POST", `/api/v1/events/${event.id}/reject`, { reason });
}

/** FX-SUBMITTED then FX-ASSIGNED, without the coordinator opening it. */
export async function assignedRequest(overrides: Record<string, unknown> = {}, coordinator: AccountKey = "coordinator") {
  const event = await submitRequest(overrides);
  await assign(event.id, coordinator);
  return event;
}

/** FX-DRAFT: the organiser saves a draft with the fields given (C1). */
export function saveDraft(fields: Record<string, unknown>, as: AccountKey = "organiser") {
  return must<EventRow>(as, "POST", "/api/v1/event-drafts", fields);
}

/**
 * The cards' SQL-editor steps, run against the job's own throwaway database. The Playwright
 * config has already refused any DATABASE_URL that is not on this machine.
 */
export async function query<T extends Record<string, unknown>>(text: string, params: (string | number)[] = []): Promise<T[]> {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => undefined });
  try {
    return (await sql.unsafe(text, params)) as unknown as T[];
  } finally {
    await sql.end();
  }
}

/** The value beside a label in a detail screen's side panel (`<dt>` then `<dd>`). */
export function sideValue(page: Page, label: string): Locator {
  return page
    .locator("aside dt")
    .filter({ hasText: new RegExp(`^${label}$`) })
    .locator("xpath=following-sibling::dd[1]");
}

/** The status lozenge under "Status" in a detail screen's side panel. */
export function sideStatus(page: Page): Locator {
  return page.locator("aside h3 + *").first();
}

/** A table row found by the unique text it contains. */
export function rowWith(page: Page, text: string): Locator {
  return page.getByRole("row").filter({ hasText: text });
}

/** How the app shows an instant: the browser's own toLocaleString, in its Singapore time zone. */
export function shownAs(page: Page, iso: string): Promise<string> {
  return page.evaluate((value) => new Date(value).toLocaleString(), iso);
}

/** Sends a request from the API console (the cards' "Click API console. Set Method…" steps). */
export async function sendFromConsole(page: Page, method: string, path: string, body = "") {
  await page.getByRole("link", { name: "API console" }).click();
  await expect(page.getByRole("heading", { name: "Direct API console" })).toBeVisible();
  await page.getByLabel("Method").fill(method);
  await page.getByLabel("Path").fill(path);
  await page.getByLabel("Body (JSON, optional)").fill(body);
  await page.getByRole("button", { name: "Send", exact: true }).click();
  const result = page.locator("pre");
  await expect(result).toBeVisible();
  return { status: page.locator("h3").first(), body: result };
}
