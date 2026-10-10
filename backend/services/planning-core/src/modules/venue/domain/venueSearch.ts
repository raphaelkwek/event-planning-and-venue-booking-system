import type { ErrorField } from "@connectsphere/contracts";

/**
 * J1, J2 — the rules for a venue search, pure so that every one is unit-tested.
 * They read and check the query and word the "nothing matched" message.
 * Postgres decides what overlaps what and what contains what
 * (repo/venueSearch.ts, implementation.md §4.4); nothing here compares two
 * periods, two capacities or two lists of facilities.
 */

export const MAX_TEXT_LENGTH = 100;
export const MAX_WINDOW_DAYS = 31;
export const MAX_MINIMUM_CAPACITY = 1_000_000;

const DAY_MS = 24 * 60 * 60 * 1000;
const SINGAPORE_OFFSET_MS = 8 * 60 * 60 * 1000;

/** Every filter a coordinator can set. A filter left out is null (or an empty list). */
export interface SearchFilters {
  /** J2: part of a venue's name or building. */
  q: string | null;
  /** J1's date and time window, both ends as UTC instants; both null or both set. */
  from: string | null;
  to: string | null;
  minCapacity: number | null;
  /** Part of the building or location. */
  location: string | null;
  layout: string | null;
  facilities: string[];
  accessibility: string[];
}

export type SearchFiltersResult = { ok: true; filters: SearchFilters } | { ok: false; fields: ErrorField[] };

const INSTANT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

/**
 * A real RFC 3339 instant with an explicit offset, as epoch milliseconds; null
 * for anything else. Writing the date part back out and comparing it with the
 * input is what refuses 2026-02-30, which Date.parse would shift to March.
 */
function parseInstant(value: string): number | null {
  const match = INSTANT.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute, second = "0", zone] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (date.toISOString().slice(0, 10) !== `${year}-${month}-${day}`) return null;
  if (Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59) return null;
  if (zone !== "Z" && (Number(zone!.slice(1, 3)) > 23 || Number(zone!.slice(4, 6)) > 59)) return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : time;
}

function readText(value: unknown, field: string, label: string, fields: ErrorField[]): string | null {
  if (value === undefined) return null;
  if (typeof value !== "string") {
    fields.push({ field, message: `${label} must be text.` });
    return null;
  }
  const text = value.trim();
  if (text.length > MAX_TEXT_LENGTH) {
    fields.push({ field, message: `${label} can be at most ${MAX_TEXT_LENGTH} characters.` });
    return null;
  }
  return text === "" ? null : text;
}

/** A repeated query parameter: each entry trimmed, blanks dropped, repeats (in any case) removed. */
function readList(value: unknown, field: string, label: string, fields: ErrorField[]): string[] {
  if (value === undefined) return [];
  const entries = Array.isArray(value) ? value : [value];
  const seen = new Set<string>();
  const list: string[] = [];
  for (const entry of entries) {
    const text = readText(entry, field, label, fields);
    if (text === null || seen.has(text.toLowerCase())) continue;
    seen.add(text.toLowerCase());
    list.push(text);
  }
  return list;
}

function readCapacity(value: unknown, fields: ErrorField[]): number | null {
  const text = readText(value, "minCapacity", "Minimum capacity", fields);
  if (text === null) return null;
  const capacity = /^\d+$/.test(text) ? Number(text) : NaN;
  if (!(capacity >= 1 && capacity <= MAX_MINIMUM_CAPACITY)) {
    fields.push({ field: "minCapacity", message: `Minimum capacity must be a whole number from 1 to ${MAX_MINIMUM_CAPACITY}.` });
    return null;
  }
  return capacity;
}

function readEnd(value: unknown, field: "from" | "to", fields: ErrorField[]): number | null {
  const label = field === "from" ? "start" : "end";
  const text = readText(value, field, `The ${label} of the window`, fields);
  if (text === null) return null;
  const time = parseInstant(text);
  if (time === null) {
    fields.push({ field, message: `Enter the ${label} of the window as a date and time with its offset, for example 2026-12-07T10:00:00+08:00.` });
  }
  return time;
}

/** The window's two ends, or every field that is wrong with them; both null when neither is given. */
function readWindow(query: Record<string, unknown>, fields: ErrorField[]): { from: string | null; to: string | null } {
  const before = fields.length;
  const start = readEnd(query.from, "from", fields);
  const end = readEnd(query.to, "to", fields);
  if (fields.length > before) return { from: null, to: null };

  if (start === null && end === null) return { from: null, to: null };
  if (start === null) {
    fields.push({ field: "from", message: "Enter when the window starts, as well as when it ends." });
    return { from: null, to: null };
  }
  if (end === null) {
    fields.push({ field: "to", message: "Enter when the window ends, as well as when it starts." });
    return { from: null, to: null };
  }
  if (end <= start) {
    fields.push({ field: "to", message: "The window must end after it starts." });
    return { from: null, to: null };
  }
  if (end - start > MAX_WINDOW_DAYS * DAY_MS) {
    fields.push({ field: "to", message: `The window can be at most ${MAX_WINDOW_DAYS} days long.` });
    return { from: null, to: null };
  }
  return { from: new Date(start).toISOString(), to: new Date(end).toISOString() };
}

/** The query string's filters, or every field that is wrong with them at once. */
export function readSearchFilters(query: Record<string, unknown>): SearchFiltersResult {
  const fields: ErrorField[] = [];
  const filters: SearchFilters = {
    q: readText(query.q, "q", "The search", fields),
    ...readWindow(query, fields),
    minCapacity: readCapacity(query.minCapacity, fields),
    location: readText(query.location, "location", "The building or location", fields),
    layout: readText(query.layout, "layout", "The layout", fields),
    facilities: readList(query.facilities, "facilities", "A facility", fields),
    accessibility: readList(query.accessibility, "accessibility", "An accessibility feature", fields),
  };
  return fields.length > 0 ? { ok: false, fields } : { ok: true, filters };
}

/** A LIKE/ILIKE pattern matching `text` anywhere, with the pattern characters in it taken literally. */
export function containsPattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, "\\$&")}%`;
}

/** Singapore wall-clock time as "2026-12-14 12:00" (the venues' own time zone, as in I1). */
function singaporeTime(instant: string): string {
  return new Date(Date.parse(instant) + SINGAPORE_OFFSET_MS).toISOString().slice(0, 16).replace("T", " ");
}

/** Each filter that is set, in words, in the order the form shows them. */
export function describeFilters(filters: SearchFilters): string[] {
  const described: string[] = [];
  if (filters.q) described.push(`name or building containing "${filters.q}"`);
  if (filters.from && filters.to) {
    described.push(`available from ${singaporeTime(filters.from)} to ${singaporeTime(filters.to)} (Singapore time)`);
  }
  if (filters.minCapacity !== null) {
    described.push(`minimum capacity ${filters.minCapacity}${filters.layout ? ` (${filters.layout} layout)` : ""}`);
  }
  if (filters.location) described.push(`building or location containing "${filters.location}"`);
  if (filters.layout) described.push(`layout ${filters.layout}`);
  if (filters.facilities.length > 0) described.push(`facilities ${filters.facilities.join(", ")}`);
  if (filters.accessibility.length > 0) described.push(`accessibility features ${filters.accessibility.join(", ")}`);
  return described;
}

/** J1: an empty result is not an error; it says which filters were applied. */
export function emptyResultMessage(filters: SearchFilters): string {
  const described = describeFilters(filters);
  if (described.length === 0) return "No active venues are recorded.";
  return `No active venue matches all of these filters: ${described.join("; ")}.`;
}
