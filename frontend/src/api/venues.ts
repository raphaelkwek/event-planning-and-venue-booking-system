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

/** J1, J2: search the venue catalogue against an event's requirements, by name or building. */
export interface VenueSearchItem {
  id: string;
  name: string;
  building: string;
  maxCapacity: number;
  /** The chosen layout's capacity when a layout filter was set; otherwise null. */
  layoutCapacity: number | null;
  facilities: string[];
  accessibilityFeatures: string[];
}

export interface VenueSearchFilters {
  q: string | null;
  from: string | null;
  to: string | null;
  minCapacity: number | null;
  location: string | null;
  layout: string | null;
  facilities: string[];
  accessibility: string[];
}

export interface VenueSearchResult {
  items: VenueSearchItem[];
  filters: VenueSearchFilters;
  appliedFilters: string[];
  /** Set when nothing matched: a sentence restating the filters applied. */
  message: string | null;
}

export interface VenueSearchOptions {
  layouts: string[];
  facilities: string[];
  accessibilityFeatures: string[];
}

export interface VenueSearchPrefill {
  eventId: string;
  reference: string | null;
  filters: Omit<VenueSearchFilters, "q" | "location">;
  unmatchedAccessibility: string[];
}

/** What the search form holds. Times are Singapore time as a browser's datetime-local input gives them. */
export interface VenueSearchForm {
  q: string;
  from: string;
  to: string;
  minCapacity: string;
  location: string;
  layout: string;
  facilities: string[];
  accessibility: string[];
}

export function emptySearchForm(): VenueSearchForm {
  return { q: "", from: "", to: "", minCapacity: "", location: "", layout: "", facilities: [], accessibility: [] };
}

/** The venues are in Singapore (UTC+8, no daylight saving), as in the availability calendar (I1). */
const SINGAPORE_OFFSET = "+08:00";
const SINGAPORE_OFFSET_MS = 8 * 60 * 60 * 1000;

/** "2026-12-14T12:00" as typed, to the instant the server reads. */
export function toInstant(local: string): string {
  return `${local}:00${SINGAPORE_OFFSET}`;
}

/** An instant from the server, to the "2026-12-14T12:00" a datetime-local input shows. */
export function toLocalInput(instant: string | null): string {
  return instant ? new Date(Date.parse(instant) + SINGAPORE_OFFSET_MS).toISOString().slice(0, 16) : "";
}

/** The query string for a form: only what was filled in, and a repeated parameter per facility. */
export function toSearchQuery(form: VenueSearchForm): URLSearchParams {
  const query = new URLSearchParams();
  const add = (key: string, value: string) => {
    if (value.trim() !== "") query.append(key, value.trim());
  };
  add("q", form.q);
  if (form.from) query.append("from", toInstant(form.from));
  if (form.to) query.append("to", toInstant(form.to));
  add("minCapacity", form.minCapacity);
  add("location", form.location);
  add("layout", form.layout);
  form.facilities.forEach((name) => query.append("facilities", name));
  form.accessibility.forEach((name) => query.append("accessibility", name));
  return query;
}

/** The form a prefill gives: the event's requirements in the fields, the rest left as they were. */
export function formFromPrefill(prefill: VenueSearchPrefill): VenueSearchForm {
  const { filters } = prefill;
  return {
    ...emptySearchForm(),
    from: toLocalInput(filters.from),
    to: toLocalInput(filters.to),
    minCapacity: filters.minCapacity === null ? "" : String(filters.minCapacity),
    layout: filters.layout ?? "",
    facilities: filters.facilities,
    accessibility: filters.accessibility,
  };
}

export function searchVenues(token: string, form: VenueSearchForm) {
  return request<VenueSearchResult>(`${VENUE}/venues/search?${toSearchQuery(form)}`, { token });
}

export function getSearchOptions(token: string) {
  return request<VenueSearchOptions>(`${VENUE}/venues/search/options`, { token });
}

export function getSearchPrefill(token: string, eventId: string) {
  return request<VenueSearchPrefill>(`${VENUE}/venues/search/prefill?${new URLSearchParams({ eventId })}`, { token });
}
