import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { expect, type Page } from "@playwright/test";
import type { AccountKey } from "./accounts.js";
import { must } from "./api.js";
import type { Delivery } from "./deliver.js";
import { standardVenue, type EventRow, type VenueRow } from "./seed.js";
import { PERIOD, type HoldRow } from "./seed-venues.js";
import { ANON_KEY, AUTH_URL } from "./stack.js";

/**
 * Setup and screen helpers for the venue journeys whose cards end on a notification: H3's change
 * of setup or turnaround time (H3-T11 to H3-T14) and L6's hold expiry (L6-T12). The bookings,
 * requests, blocks and holds are made through the API as the user who would make each, and the
 * screens are read as the card's user reads them.
 */

/**
 * A Singapore time on Tuesday 2 March 2027, as an instant. The cards' Wednesday 2 December 2026
 * moved into 2027, as l-bookings.spec.ts moves its period, so the journeys never fall into the past.
 */
export const at = (hhmm: string) => new Date(`2027-03-02T${hhmm}:00+08:00`).toISOString();
export const DAY_TEXT = "Tuesday 2 March 2027";

/** An instant as the app and the notices show one: "Monday 1 March 2027, 20:00", in Singapore time. */
export function singaporeMoment(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Singapore",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part("weekday")} ${part("day")} ${part("month")} ${part("year")}, ${part("hour")}:${part("minute")}`;
}

/** The parts of a venue's PUT answer H3 adds: what the new times made overlap (H3-T10, H3-T11). */
export interface FlaggedBooking {
  kind: "BOOKING" | "HOLD" | "REQUEST";
  reference: string;
  eventReference: string | null;
  overlapsReferences: string[];
}

/** H3: Venue Staff save the standard venue with new setup and turnaround times, through the API. */
export function setVenueTimes(venue: VenueRow, setupMinutes: number, turnaroundMinutes: number) {
  return must<VenueRow & { flaggedBookings: FlaggedBooking[] }>(
    "venuestaff",
    "PUT",
    `/api/v1/venues/${venue.id}`,
    standardVenue({ name: venue.name, setupMinutes, turnaroundMinutes }),
  );
}

/** I2: Venue Staff record a block of unavailability, Maintenance, through the API. Returns the block's id. */
export async function recordBlock(venueId: string, startsAt: string, endsAt: string, description: string) {
  const recorded = await must<{ block: { id: string } }>("venuestaff", "POST", `/api/v1/venues/${venueId}/unavailability`, {
    startsAt,
    endsAt,
    reasonType: "MAINTENANCE",
    description,
  });
  return recorded.block.id;
}

/** A hold as the event's holds list and the Venue Staff list return it, with L6's expiry fields. */
export interface PlacedHold extends HoldRow {
  expiredAt: string | null;
  remindedAt?: string | null;
}

/**
 * L3-T5: the assigned coordinator requests a hold of the venue for the period (with L6's reminder
 * lead), and the venue's Venue Staff place it with the expiry given.
 */
export async function placedHold(
  eventId: string,
  venueId: string,
  expiresAt: string,
  options: { reminderLeadMinutes?: number; coordinator?: AccountKey } = {},
) {
  const requested = await must<HoldRow>(options.coordinator ?? "coordinator", "POST", "/api/v1/holds", {
    eventId,
    venueId,
    ...PERIOD,
    reminderLeadMinutes: options.reminderLeadMinutes ?? 60,
  });
  return must<PlacedHold>("venuestaff", "POST", `/api/v1/holds/${requested.id}/place`, { expiresAt });
}

export async function holdsOf(eventId: string, as: AccountKey = "coordinator") {
  return (await must<{ items: PlacedHold[] }>(as, "GET", `/api/v1/holds?eventId=${eventId}`)).items;
}

const run = promisify(execFile);
const TSX_CLI = createRequire(import.meta.url).resolve("tsx/cli");
const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const SWEEP = fileURLToPath(new URL("../../../backend/services/planning-core/src/modules/venue/jobs/runExpireHolds.ts", import.meta.url));

/**
 * L6: expires every Held hold whose expiry has passed, with `npm run jobs:expire-holds`'s own script
 * (M4, the fallback for when the HoldExpiry workflow can't run). CI's browser stack runs without
 * Temporal, so a journey that watches an expiry happen runs the sweep once the expiry has passed, as
 * the scheduler would. It writes the same `venue-booking.hold-expired` message the workflow does.
 * The npm script reads .env, which CI has none of, so the script is run with the stack's settings.
 */
export async function runHoldExpirySweep(): Promise<void> {
  const url = process.env.DATABASE_URL ?? "";
  if (!/^postgres(ql)?:\/\/[^@]*@(127\.0\.0\.1|localhost)(:\d+)?\//.test(url)) {
    throw new Error("DATABASE_URL must be this machine's throwaway Postgres; the expiry sweep never runs against a shared database");
  }
  await run(process.execPath, [TSX_CLI, SWEEP], {
    cwd: ROOT,
    env: {
      ...process.env,
      DATABASE_URL: url,
      SUPABASE_URL: AUTH_URL,
      SUPABASE_ANON_KEY: ANON_KEY,
      SUPABASE_JWKS_URL: `${AUTH_URL}/auth/v1/.well-known/jwks.json`,
      KAFKA_BROKERS: "",
      LOG_LEVEL: "warn",
    },
    timeout: 60_000,
    maxBuffer: 4 * 1024 * 1024,
  });
}

/** How many of the deliveries the notification service stored, of the message type given (or of any). */
export function storedNotices(deliveries: Delivery[], type?: string): number {
  return deliveries.filter((d) => d.consumer === "notification" && d.outcome === "stored" && (!type || d.type === type)).length;
}

/** The navigation link a role follows, and the screen's own heading. */
export async function openNav(page: Page, label: string) {
  await page.getByRole("navigation").getByRole("link", { name: label, exact: true }).click();
  await expect(page.getByRole("heading", { name: label, level: 2 })).toBeVisible();
}

/** The coordinator's way to an event's venue requests: "All events" → the event → "Venue requests". */
export async function openVenueRequests(page: Page, event: EventRow) {
  await page.getByRole("navigation").getByRole("link", { name: "All events" }).click();
  await page.getByRole("row").filter({ hasText: event.name }).getByRole("link", { name: "Open" }).click();
  await expect(page.getByRole("heading", { name: event.name, level: 2 })).toBeVisible();
  await page.getByRole("link", { name: "Venue requests" }).click();
  await expect(page.getByRole("heading", { name: "Venue requests" })).toBeVisible();
}

/** Venue Staff's way to a venue's record: "Venues" → "Edit" on its row. */
export async function openVenueEditor(page: Page, venue: VenueRow) {
  await openNav(page, "Venues");
  await page.getByRole("row").filter({ hasText: venue.name }).getByRole("link", { name: "Edit" }).click();
  await expect(page.getByRole("heading", { name: "Edit venue" })).toBeVisible();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(venue.name);
}

/**
 * H3: enters new setup and turnaround times in the venue editor and clicks "Save venue", waiting for
 * the server's answer so that what the editor then shows is that save's.
 */
export async function saveVenueTimes(page: Page, venue: VenueRow, times: { setup?: number; turnaround?: number }) {
  if (times.setup !== undefined) await page.getByLabel("Setup time (minutes)").fill(String(times.setup));
  if (times.turnaround !== undefined) await page.getByLabel("Turnaround time (minutes)").fill(String(times.turnaround));
  const saved = page.waitForResponse(
    (response) => response.request().method() === "PUT" && new URL(response.url()).pathname.endsWith(`/api/v1/venues/${venue.id}`),
  );
  await page.getByRole("button", { name: "Save venue" }).click();
  expect((await saved).status()).toBe(200);
}

/** The editor's list of what the new times made overlap, as its items read. */
export const flaggedList = (page: Page) => page.getByRole("region", { name: "Bookings that now overlap" });
