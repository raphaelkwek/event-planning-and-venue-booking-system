import { request } from "./client.js";

/** H1, H2: the venue catalogue, served by planning-core's venue module. */

const VENUE = "/venue/api/v1";

export const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
export type Day = (typeof DAYS)[number];
export const DAY_LABELS: Record<Day, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

export interface VenueBody {
  name: string;
  building: string;
  maxCapacity: number | null;
  layouts: { name: string; capacity: number | null }[];
  facilities: string[];
  accessibilityFeatures: string[];
  operatingHours: Record<Day, { opensAt: string; closesAt: string } | null>;
  isActive: boolean;
}

export interface Venue extends VenueBody {
  id: string;
  maxCapacity: number;
  layouts: { name: string; capacity: number }[];
  createdAt: string;
  createdBy: string | null;
  updatedAt: string;
  updatedBy: string | null;
}

export interface VenueListItem {
  id: string;
  name: string;
  building: string;
  maxCapacity: number;
  isActive: boolean;
}

/** The form keeps what was typed; numbers become numbers only when sent. */
export interface VenueForm {
  name: string;
  building: string;
  maxCapacity: string;
  layouts: { name: string; capacity: string }[];
  facilities: string;
  accessibilityFeatures: string;
  hours: Record<Day, { closed: boolean; opensAt: string; closesAt: string }>;
  isActive: boolean;
}

export function emptyVenueForm(): VenueForm {
  return {
    name: "",
    building: "",
    maxCapacity: "",
    layouts: [{ name: "", capacity: "" }],
    facilities: "",
    accessibilityFeatures: "",
    hours: Object.fromEntries(DAYS.map((day) => [day, { closed: false, opensAt: "08:00", closesAt: "22:00" }])) as VenueForm["hours"],
    isActive: true,
  };
}

/** A number as typed, fractions included so the server can refuse them; null when blank or not a number. */
function toNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const number = Number(trimmed);
  return Number.isFinite(number) ? number : null;
}

const lines = (text: string) => text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

export function toVenueBody(form: VenueForm): VenueBody {
  return {
    name: form.name,
    building: form.building,
    maxCapacity: toNumber(form.maxCapacity),
    layouts: form.layouts.map((layout) => ({ name: layout.name, capacity: toNumber(layout.capacity) })),
    facilities: lines(form.facilities),
    accessibilityFeatures: lines(form.accessibilityFeatures),
    operatingHours: Object.fromEntries(
      DAYS.map((day) => {
        const hours = form.hours[day];
        return [day, hours.closed ? null : { opensAt: hours.opensAt, closesAt: hours.closesAt }];
      }),
    ) as VenueBody["operatingHours"],
    isActive: form.isActive,
  };
}

export function fromVenue(venue: VenueBody): VenueForm {
  return {
    name: venue.name,
    building: venue.building,
    maxCapacity: String(venue.maxCapacity ?? ""),
    layouts: venue.layouts.map((layout) => ({ name: layout.name, capacity: String(layout.capacity ?? "") })),
    facilities: venue.facilities.join("\n"),
    accessibilityFeatures: venue.accessibilityFeatures.join("\n"),
    hours: Object.fromEntries(
      DAYS.map((day) => {
        const hours = venue.operatingHours[day];
        return [day, hours ? { closed: false, ...hours } : { closed: true, opensAt: "", closesAt: "" }];
      }),
    ) as VenueForm["hours"],
    isActive: venue.isActive,
  };
}

export function listVenues(token: string) {
  return request<{ items: VenueListItem[] }>(`${VENUE}/venues`, { token });
}

export function getVenue(token: string, id: string) {
  return request<Venue>(`${VENUE}/venues/${id}`, { token });
}

export function createVenue(token: string, body: VenueBody) {
  return request<Venue>(`${VENUE}/venues`, { method: "POST", token, body });
}

export function updateVenue(token: string, id: string, body: VenueBody) {
  return request<Venue>(`${VENUE}/venues/${id}`, { method: "PUT", token, body });
}

/** I1: a venue's availability calendar. Times are UTC; the screen shows them in `timeZone`. */
export type CommittedKind = "OUTSIDE_HOURS" | "SETUP" | "BOOKING" | "TURNAROUND" | "UNAVAILABLE";
export type UnavailabilityReasonType = "MAINTENANCE" | "EQUIPMENT_FAILURE" | "RENOVATION" | "SAFETY" | "OTHER";

export interface CommittedPeriod {
  kind: CommittedKind;
  startsAt: string;
  endsAt: string;
  bookingStatus?: "CONFIRMED" | "PENDING";
  eventReference?: string | null;
  reasonType?: UnavailabilityReasonType;
  description?: string;
}

export interface AvailabilityDay {
  date: string;
  committed: CommittedPeriod[];
  free: { startsAt: string; endsAt: string }[];
}

export interface VenueAvailability {
  venueId: string;
  timeZone: string;
  from: string;
  to: string;
  days: AvailabilityDay[];
}

export function getVenueAvailability(token: string, id: string, from: string, to: string) {
  const query = new URLSearchParams({ from, to });
  return request<VenueAvailability>(`${VENUE}/venues/${id}/availability?${query}`, { token });
}

/** K1: whether a venue suits an event. Advisory: nothing is created or blocked. */
export type SuitabilityStatus = "SUITABLE" | "SUITABLE_WITH_WARNINGS" | "NOT_SUITABLE";

export interface SuitabilityCondition {
  condition: "LAYOUT_CAPACITY" | "FACILITIES" | "ACCESSIBILITY" | "OPERATING_HOURS";
  outcome: "MET" | "FAILED" | "NOT_ASSESSED";
  required: number | string | string[] | null;
  available: number | string | string[] | null;
  missing?: string[];
  message: string;
}

export interface VenueSuitability {
  venueId: string;
  venueName: string;
  eventId: string;
  eventReference: string | null;
  status: SuitabilityStatus;
  reasons: SuitabilityCondition[];
  warnings: SuitabilityCondition[];
}

export function getVenueSuitability(token: string, id: string, eventId: string) {
  const query = new URLSearchParams({ eventId });
  return request<VenueSuitability>(`${VENUE}/venues/${id}/suitability?${query}`, { token });
}
