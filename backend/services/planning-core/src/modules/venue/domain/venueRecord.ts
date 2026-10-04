import type { ErrorField } from "@connectsphere/contracts";

/**
 * H1 — the rules for a venue record, pure so that every one is unit-tested.
 * The API checks the shape of a request; these check what it means.
 */

export const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
export type Day = (typeof DAYS)[number];

/** A day's opening hours, or null when the venue is closed that day. */
export type DayHours = { opensAt: string; closesAt: string } | null;

export interface VenueLayout {
  name: string;
  capacity: number;
}

/** Every catalogue attribute Venue Staff maintain (H1 AC1). */
export interface VenueInput {
  name: string;
  building: string;
  maxCapacity: number;
  layouts: VenueLayout[];
  facilities: string[];
  accessibilityFeatures: string[];
  operatingHours: Record<Day, DayHours>;
  /** H3 (CR-01): minutes the venue needs before an event, and after it, in whole minutes. */
  setupMinutes: number;
  turnaroundMinutes: number;
  isActive: boolean;
}

export type VenueValidation = { ok: true; venue: VenueInput } | { ok: false; fields: ErrorField[] };

const WHOLE_ABOVE_ZERO = (value: number) => Number.isInteger(value) && value > 0;
const WHOLE_FROM_ZERO = (value: number) => Number.isInteger(value) && value >= 0;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const CAPITALISED: Record<Day, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

/** Blank lines dropped, repeats removed, each entry trimmed. */
function cleanList(entries: string[]): string[] {
  return [...new Set(entries.map((entry) => entry.trim()).filter((entry) => entry.length > 0))];
}

/** Checks a venue against H1's rules and names every field at fault at once. */
export function validateVenue(input: VenueInput): VenueValidation {
  const fields: ErrorField[] = [];
  const name = input.name.trim();
  const building = input.building.trim();

  if (!name) fields.push({ field: "name", message: "Enter the venue's name." });
  if (!building) fields.push({ field: "building", message: "Enter the building or location." });
  if (!WHOLE_ABOVE_ZERO(input.maxCapacity)) {
    fields.push({ field: "maxCapacity", message: "Maximum capacity must be a whole number greater than zero." });
  }

  const layouts = input.layouts.map((layout) => ({ name: layout.name.trim(), capacity: layout.capacity }));
  if (layouts.length === 0) fields.push({ field: "layouts", message: "Record at least one layout." });
  const seen = new Set<string>();
  layouts.forEach((layout, i) => {
    const key = layout.name.toLowerCase();
    if (!layout.name) fields.push({ field: `layouts[${i}].name`, message: "Enter the layout's name." });
    else if (seen.has(key)) fields.push({ field: `layouts[${i}].name`, message: "Each layout can be recorded once." });
    seen.add(key);
    if (!WHOLE_ABOVE_ZERO(layout.capacity)) {
      fields.push({ field: `layouts[${i}].capacity`, message: "Layout capacity must be a whole number greater than zero." });
    }
  });

  for (const day of DAYS) {
    const hours = input.operatingHours[day];
    const field = `operatingHours.${day}`;
    if (hours === undefined) fields.push({ field, message: `Give ${CAPITALISED[day]}'s hours, or mark it closed.` });
    else if (hours === null) continue;
    else if (!TIME.test(hours.opensAt) || !TIME.test(hours.closesAt)) {
      fields.push({ field, message: "Enter times as HH:MM, for example 08:00." });
    } else if (hours.closesAt <= hours.opensAt) {
      fields.push({ field, message: "Closing time must be later than opening time." });
    }
  }

  if (!WHOLE_FROM_ZERO(input.setupMinutes)) {
    fields.push({ field: "setupMinutes", message: "Setup time must be a whole number of minutes, 0 or more." });
  }
  if (!WHOLE_FROM_ZERO(input.turnaroundMinutes)) {
    fields.push({ field: "turnaroundMinutes", message: "Turnaround time must be a whole number of minutes, 0 or more." });
  }

  if (fields.length > 0) return { ok: false, fields };
  return {
    ok: true,
    venue: {
      ...input,
      name,
      building,
      layouts,
      facilities: cleanList(input.facilities),
      accessibilityFeatures: cleanList(input.accessibilityFeatures),
    },
  };
}

const TRACKED = [
  "name",
  "building",
  "maxCapacity",
  "layouts",
  "facilities",
  "accessibilityFeatures",
  "operatingHours",
  "setupMinutes",
  "turnaroundMinutes",
  "isActive",
] as const;

/**
 * A value as text with object keys sorted, so two equal values compare equal
 * whatever order their keys arrived in: jsonb, for one, reorders them.
 */
function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, inner) =>
    inner && typeof inner === "object" && !Array.isArray(inner)
      ? Object.fromEntries(Object.entries(inner).sort(([a], [b]) => a.localeCompare(b)))
      : inner,
  );
}

/** H1 AC5: what an update changed, each field with its previous and new value. */
export function changedFields(
  before: VenueInput,
  after: VenueInput,
): Record<string, { previous: unknown; new: unknown }> {
  const changes: Record<string, { previous: unknown; new: unknown }> = {};
  for (const field of TRACKED) {
    if (canonical(before[field]) !== canonical(after[field])) {
      changes[field] = { previous: before[field], new: after[field] };
    }
  }
  return changes;
}
