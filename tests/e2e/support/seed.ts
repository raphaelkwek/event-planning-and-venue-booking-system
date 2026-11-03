import { ACCOUNTS, type AccountKey } from "./accounts.js";
import { must } from "./api.js";
import { uniqueName } from "./names.js";

/**
 * The setup procedures of tests/README.md (FX-SUBMITTED, FX-ASSIGNED, FX-UNDER-REVIEW,
 * FX-APPROVED, FX-VENUE), done through the API as the user who would do each step, so a journey
 * starts from a known state and spends its browser time on the story it is about.
 */

export interface EventRow {
  id: string;
  reference: string;
  name: string;
  status: string;
  [field: string]: unknown;
}

export interface VenueRow {
  id: string;
  name: string;
  [field: string]: unknown;
}

/**
 * 2 March 2027 is a Tuesday. 14:00 to 18:00 Singapore time sits inside the standard venue's
 * opening hours, and is far enough ahead never to be in the past.
 */
export const STANDARD_START = "2027-03-02T06:00:00.000Z";
export const STANDARD_END = "2027-03-02T10:00:00.000Z";

/** The standard request of tests/README.md, with a name no other test uses. */
export function standardRequest(overrides: Record<string, unknown> = {}) {
  return {
    name: uniqueName("Annual Research Symposium"),
    purpose: "Share faculty research",
    description: "A one-day symposium for the school of computing.",
    proposedStartAt: STANDARD_START,
    proposedEndAt: STANDARD_END,
    expectedAttendance: 150,
    accessibilityNeeds: "Step-free access to the stage",
    equipmentRequired: false,
    registrationRequired: false,
    ...overrides,
  };
}

/** FX-SUBMITTED: the organiser submits the standard request. Nobody is assigned yet (E3). */
export function submitRequest(overrides: Record<string, unknown> = {}, as: AccountKey = "organiser") {
  return must<EventRow>(as, "POST", "/api/v1/events", standardRequest(overrides));
}

/** FX-ASSIGNED: the Lead assigns the request to a coordinator (E3). */
export async function assign(eventId: string, coordinator: AccountKey = "coordinator") {
  await must("lead", "POST", `/api/v1/events/${eventId}/assignment`, { coordinatorId: ACCOUNTS[coordinator].id });
}

/** FX-UNDER-REVIEW: the assigned coordinator opens the request, which claims it for review (D1). */
export function openForReview(eventId: string, coordinator: AccountKey = "coordinator") {
  return must<EventRow>(coordinator, "GET", `/api/v1/events/${eventId}`);
}

/** FX-APPROVED: the assigned coordinator approves it (D4). */
export function approve(eventId: string, coordinator: AccountKey = "coordinator") {
  return must<EventRow>(coordinator, "POST", `/api/v1/events/${eventId}/approve`, {});
}

/** A request submitted, assigned and opened by the coordinator: Under Review. */
export async function underReviewRequest(overrides: Record<string, unknown> = {}, coordinator: AccountKey = "coordinator") {
  const event = await submitRequest(overrides);
  await assign(event.id, coordinator);
  return openForReview(event.id, coordinator);
}

/** A request taken all the way to Approved by its assigned coordinator. */
export async function approvedRequest(overrides: Record<string, unknown> = {}, coordinator: AccountKey = "coordinator") {
  const event = await underReviewRequest(overrides, coordinator);
  return approve(event.id, coordinator);
}

const OPEN_DAY = { opensAt: "08:00", closesAt: "22:00" };

/** The standard venue of tests/README.md, with a name no other test uses. */
export function standardVenue(overrides: Record<string, unknown> = {}) {
  return {
    name: uniqueName("Lee Kong Chian Auditorium"),
    building: "School of Computing, Level 1",
    maxCapacity: 300,
    layouts: [
      { name: "Theatre", capacity: 300 },
      { name: "Classroom", capacity: 120 },
      { name: "Banquet", capacity: 180 },
    ],
    facilities: ["Projector", "Wireless microphones", "Stage lighting"],
    accessibilityFeatures: ["Step-free access", "Hearing loop", "Accessible toilet"],
    operatingHours: {
      monday: OPEN_DAY,
      tuesday: OPEN_DAY,
      wednesday: OPEN_DAY,
      thursday: OPEN_DAY,
      friday: OPEN_DAY,
      saturday: { opensAt: "09:00", closesAt: "18:00" },
      sunday: null,
    },
    ...overrides,
  };
}

/** FX-VENUE: Venue Staff create the standard venue, which they then look after. */
export function createVenue(overrides: Record<string, unknown> = {}, as: AccountKey = "venuestaff") {
  return must<VenueRow>(as, "POST", "/api/v1/venues", standardVenue(overrides));
}
