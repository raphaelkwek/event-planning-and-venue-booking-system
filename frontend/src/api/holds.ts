import { request } from "./client.js";
import type { BookingRequest } from "./bookingRequests.js";

/**
 * L3: tentative holds, served by planning-core's venue module. The event's
 * assigned coordinator requests a hold; Venue Staff of the venue place it,
 * setting its expiry (the customer's Week 9 answer, CQ-06).
 */

const VENUE = "/venue/api/v1";

export type HoldStatus = "REQUESTED" | "HELD" | "CONVERTED" | "RELEASED" | "EXPIRED";

export interface Hold {
  id: string;
  reference: string;
  eventId: string;
  eventReference: string | null;
  venueId: string;
  venueName: string;
  startsAt: string;
  endsAt: string;
  reminderLeadMinutes: number;
  status: HoldStatus;
  requestedBy: string;
  requestedAt: string;
  placedBy: string | null;
  placedAt: string | null;
  expiresAt: string | null;
  slotId: string | null;
  convertedRequestId: string | null;
  convertedBy: string | null;
  convertedAt: string | null;
  releasedBy: string | null;
  releasedAt: string | null;
}

export interface HoldInput {
  eventId: string;
  venueId: string;
  startsAt: string;
  endsAt: string;
  reminderLeadMinutes: number | null;
}

export interface ConversionInput {
  layout: string;
  expectedAttendance: number | null;
  facilities: string[];
  accessibilityFeatures: string[];
  /** K2: required when the hold's venue isn't suitable for the request; the server says when. */
  justification?: string;
}

/** A hold can be requested for any event that isn't over or turned down (L3). */
export const NOT_HOLDABLE_STATUSES = ["COMPLETED", "CANCELLED", "REJECTED"] as const;

export function listEventHolds(token: string, eventId: string) {
  return request<{ items: Hold[] }>(`${VENUE}/holds?${new URLSearchParams({ eventId })}`, { token });
}

export function requestHold(token: string, body: HoldInput) {
  return request<Hold>(`${VENUE}/holds`, { method: "POST", token, body });
}

export function listHoldQueue(token: string) {
  return request<{ items: Hold[] }>(`${VENUE}/holds/queue`, { token });
}

export function placeHold(token: string, id: string, expiresAt: string) {
  return request<Hold>(`${VENUE}/holds/${id}/place`, { method: "POST", token, body: { expiresAt } });
}

export function releaseHold(token: string, id: string) {
  return request<Hold>(`${VENUE}/holds/${id}/release`, { method: "POST", token });
}

export function convertHold(token: string, id: string, body: ConversionInput) {
  return request<{ request: BookingRequest; hold: Hold }>(`${VENUE}/holds/${id}/convert`, { method: "POST", token, body });
}

/** "1 day", "90 minutes": how long before the expiry the coordinator is reminded. */
export function reminderText(minutes: number): string {
  if (minutes % 1440 === 0) return minutes === 1440 ? "1 day" : `${minutes / 1440} days`;
  if (minutes % 60 === 0) return minutes === 60 ? "1 hour" : `${minutes / 60} hours`;
  return minutes === 1 ? "1 minute" : `${minutes} minutes`;
}
