import type { Sql } from "postgres";
import { signAdmission } from "../domain/admissionToken.js";
import { takesRegistrations, windowState, type WindowState } from "../domain/registrationRules.js";
import {
  admissionExpiresAt,
  entryState,
  estimatedWaitSeconds,
  keepsPlace,
  queuePosition,
  slotIntervalMs,
  type EntryState,
  type WaitingRoomSettings,
} from "../domain/waitingRoom.js";
import { findListing, type Listing } from "../repo/listings.js";
import { findEntry, lockGate, takeSlot, waitingAhead, type WaitingRoomEntry } from "../repo/waitingRoom.js";

/**
 * EN-19 — joining the waiting room of a high-demand event, and reading one's
 * place. The rules are in domain/waitingRoom.ts; this is the transaction and
 * the token. Joining holds the event's gate for a few statements and nothing
 * else; reading a place is a plain read, so a thousand attendees polling do
 * not queue behind each other.
 */

export interface WaitingRoomConfig extends WaitingRoomSettings {
  signingKey: string;
}

export interface PlaceView {
  entryId: string;
  eventId: string;
  status: EntryState;
  /** 1 for the next to be admitted; 0 once admitted (or expired or used). */
  position: number;
  /** Whole seconds until admission; 0 once admitted. */
  estimatedWaitSeconds: number;
  admitAt: string;
  /** When the admission token stops being accepted. */
  expiresAt: string;
  /** Present only while the attendee is admitted: send it as X-Admission-Token to register. */
  admissionToken: string | null;
}

export type JoinOutcome =
  | { ok: true; created: boolean; place: PlaceView }
  | { ok: false; code: "EVENT_NOT_FOUND" }
  | { ok: false; code: "NOT_REQUIRED"; listing: Listing }
  | { ok: false; code: "OUTSIDE_WINDOW"; listing: Listing; state: Exclude<WindowState, "OPEN"> }
  | { ok: false; code: "UNAVAILABLE" };

/** A place as the attendee is shown it, with the token only while it is good. */
export async function viewPlace(db: Sql, entry: WaitingRoomEntry, now: Date, config: WaitingRoomConfig): Promise<PlaceView> {
  const state = entryState(entry, now, config.tokenTtlSeconds);
  const expiresAt = admissionExpiresAt(entry.admitAt, config.tokenTtlSeconds);
  const ahead = state === "WAITING" ? await waitingAhead(db, entry.eventId, entry.admitAt, now) : 0;
  return {
    entryId: entry.id,
    eventId: entry.eventId,
    status: state,
    position: queuePosition(state, ahead),
    estimatedWaitSeconds: estimatedWaitSeconds(entry.admitAt, now),
    admitAt: entry.admitAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    admissionToken:
      state === "ADMITTED" && config.signingKey !== ""
        ? signAdmission({ entryId: entry.id, eventId: entry.eventId, attendeeId: entry.attendeeId, expiresAtMs: expiresAt.getTime() }, config.signingKey)
        : null,
  };
}

/**
 * Joins the waiting room of an event. Only a flagged event that is taking
 * registrations has one. An attendee who is already waiting or admitted keeps
 * their place; one whose turn expired, or who has registered, queues again at
 * the back.
 */
export async function joinWaitingRoom(
  sql: Sql,
  input: { eventId: string; attendeeId: string; now: Date },
  config: WaitingRoomConfig,
): Promise<JoinOutcome> {
  const listing = await findListing(sql, input.eventId);
  if (!listing || !takesRegistrations(listing)) return { ok: false, code: "EVENT_NOT_FOUND" };
  if (!listing.highDemand) return { ok: false, code: "NOT_REQUIRED", listing };
  if (config.signingKey === "") return { ok: false, code: "UNAVAILABLE" };
  const state = windowState(listing, input.now);
  if (state !== "OPEN") return { ok: false, code: "OUTSIDE_WINDOW", listing, state };

  const { entry, created } = await sql.begin(async (tx) => {
    const gate = await lockGate(tx, input.eventId, input.now, input.attendeeId);
    if (gate.latest && keepsPlace(entryState(gate.latest, input.now, config.tokenTtlSeconds))) return { entry: gate.latest, created: false };
    const taken = await takeSlot(tx, {
      eventId: input.eventId,
      attendeeId: input.attendeeId,
      now: input.now,
      gateNextSlotAt: gate.nextSlotAt,
      intervalMs: slotIntervalMs(config.admitPerSecond),
    });
    return { entry: taken, created: true };
  });
  return { ok: true, created, place: await viewPlace(sql, entry, input.now, config) };
}

/** An attendee's place by its id, or null when there is no such entry. */
export async function placeById(sql: Sql, entryId: string, now: Date, config: WaitingRoomConfig): Promise<PlaceView | null> {
  const entry = await findEntry(sql, entryId);
  return entry ? viewPlace(sql, entry, now, config) : null;
}
