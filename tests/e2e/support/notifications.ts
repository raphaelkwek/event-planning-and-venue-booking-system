import { expect, type Locator, type Page } from "@playwright/test";
import type { AccountKey } from "./accounts.js";
import { signIn } from "./fixtures.js";

/**
 * T2's Notifications screen, for the journeys whose card ends on a notification. CI's browser stack
 * runs without Kafka, so such a journey first hands the action's messages to the notification
 * service with deliverOutbox (deliver.ts), then reads them here as the recipient would.
 */

/** The notifications the screen lists, newest first (its first page). */
export const notificationItems = (page: Page) => page.getByRole("list", { name: "Notifications" }).getByRole("listitem");

/** Each item's message, without its time, its Unread label or its buttons. */
export const messageOf = (items: Locator) => items.locator("xpath=./div[1]/div[1]");

/**
 * Clicks "Notifications" in the navigation, signed in as `as` first when it is given, and returns
 * the listed items once the screen has loaded. The heading only appears then, so an empty list
 * ("You have no notifications.") is an answer, not a screen still loading.
 */
export async function openNotifications(page: Page, as?: AccountKey): Promise<Locator> {
  if (as) await signIn(page, as);
  // "Notifications", or "Notifications (n)" while some are unread.
  await page.getByRole("navigation").getByRole("link", { name: /^Notifications/ }).click();
  await expect(page.getByRole("heading", { name: "Notifications", level: 2, exact: true })).toBeVisible();
  return notificationItems(page);
}
