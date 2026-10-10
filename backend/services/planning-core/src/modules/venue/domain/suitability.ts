import { venueRequirementsSchema, type VenueRequirements } from "@connectsphere/contracts";
import { calendarDays } from "./availabilityCalendar.js";
import type { VenueInput } from "./venueRecord.js";

/**
 * K1 — whether a venue suits an event. One pure rule per condition the story
 * names, each returning the two values it compared; `assessSuitability` runs
 * them all against a set of requirements.
 *
 * The requirements are a parameter, not read from the event inside the rules, so
 * that L1 can pass each booking request's own requirements when it lands (CR-03,
 * L4). Until then the caller builds them from the event (`requirementsFromEvent`).
 *
 * A condition is MET, FAILED, or NOT_ASSESSED. The story lists only failing
 * conditions, so a failure is the only thing that makes a venue Not suitable. The
 * one thing it supports as a warning is a condition that cannot be assessed
 * because the event or the catalogue holds no value to compare: that is neither
 * a pass nor a failure, so the result is Suitable with warnings.
 */

export type ConditionCode = "LAYOUT_CAPACITY" | "FACILITIES" | "ACCESSIBILITY" | "OPERATING_HOURS";
export type ConditionOutcome = "MET" | "FAILED" | "NOT_ASSESSED";
export type SuitabilityStatus = "SUITABLE" | "SUITABLE_WITH_WARNINGS" | "NOT_SUITABLE";

/** What one rule compared: the event's side (`required`) and the venue's (`available`). */
export interface ConditionResult {
  condition: ConditionCode;
  outcome: ConditionOutcome;
  required: number | string | string[] | null;
  available: number | string | string[] | null;
  /** Facilities and accessibility only: the required entries the venue lacks. */
  missing?: string[];
  message: string;
}

export interface RequestedPeriod {
  startsAt: string;
  endsAt: string;
}

/** What an event, or one booking request of it, needs from a venue. */
export interface SuitabilityRequirements {
  attendance: number | null;
  layout: string | null;
  facilities: string[];
  accessibilityFeatures: string[];
  period: RequestedPeriod | null;
}

/** The catalogue attributes the rules read (H1). */
export type SuitabilityVenue = Pick<VenueInput, "layouts" | "facilities" | "accessibilityFeatures" | "operatingHours">;

export interface SuitabilityAssessment {
  status: SuitabilityStatus;
  /** Failing conditions only (story: "Every failing condition is listed separately"). */
  reasons: ConditionResult[];
  /** Conditions that could not be assessed. */
  warnings: ConditionResult[];
}

const normalise = (text: string) => text.trim().toLowerCase();

/** Trimmed, blanks dropped, and each entry once whatever its case. */
function cleanList(entries: readonly string[]): string[] {
  const seen = new Set<string>();
  return entries.map((entry) => entry.trim()).filter((entry) => {
    const key = normalise(entry);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function checkLayoutCapacity(
  layout: string | null,
  attendance: number | null,
  layouts: SuitabilityVenue["layouts"],
): ConditionResult {
  const name = layout?.trim() ?? "";
  if (!name) {
    return {
      condition: "LAYOUT_CAPACITY",
      outcome: "NOT_ASSESSED",
      required: attendance,
      available: null,
      message: "The event records no room layout, so attendance was not compared with a layout capacity.",
    };
  }
  const offered = layouts.find((candidate) => normalise(candidate.name) === normalise(name));
  if (!offered) {
    return {
      condition: "LAYOUT_CAPACITY",
      outcome: "NOT_ASSESSED",
      required: attendance,
      available: null,
      message: `The venue does not offer the ${name} layout, so attendance was not compared with a layout capacity.`,
    };
  }
  if (attendance === null) {
    return {
      condition: "LAYOUT_CAPACITY",
      outcome: "NOT_ASSESSED",
      required: null,
      available: offered.capacity,
      message: `The event records no expected attendance, so it was not compared with the ${offered.name} layout's capacity.`,
    };
  }
  const failed = attendance > offered.capacity;
  return {
    condition: "LAYOUT_CAPACITY",
    outcome: failed ? "FAILED" : "MET",
    required: attendance,
    available: offered.capacity,
    message: failed
      ? `Expected attendance ${attendance} against layout capacity ${offered.capacity} (${offered.name}).`
      : `Expected attendance ${attendance} fits the ${offered.name} layout's capacity of ${offered.capacity}.`,
  };
}

/** Facilities and accessibility features share one rule: every required entry must be offered. */
function checkOffered(
  condition: "FACILITIES" | "ACCESSIBILITY",
  noun: { singular: string; plural: string },
  required: readonly string[],
  offered: readonly string[],
): ConditionResult {
  const wanted = cleanList(required);
  const available = [...offered];
  const have = new Set(offered.map(normalise));
  const missing = wanted.filter((entry) => !have.has(normalise(entry)));
  if (missing.length === 0) {
    return {
      condition,
      outcome: "MET",
      required: wanted,
      available,
      missing,
      message: `The venue offers every required ${noun.singular}.`,
    };
  }
  const offers = available.length > 0 ? `offers: ${available.join(", ")}` : `offers no ${noun.plural}`;
  return {
    condition,
    outcome: "FAILED",
    required: wanted,
    available,
    missing,
    message: `Required ${noun.singular} absent: ${missing.join(", ")}. The venue ${offers}.`,
  };
}

export function checkFacilities(required: readonly string[], offered: readonly string[]): ConditionResult {
  return checkOffered("FACILITIES", { singular: "facility", plural: "facilities" }, required, offered);
}

export function checkAccessibility(required: readonly string[], offered: readonly string[]): ConditionResult {
  return checkOffered(
    "ACCESSIBILITY",
    { singular: "accessibility feature", plural: "accessibility features" },
    required,
    offered,
  );
}

/** The venues are in Singapore (UTC+8, no daylight saving), as the I1 calendar assumes. */
const SINGAPORE_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

/** A Singapore wall-clock reading shifted into UTC fields, so getUTC* gives Singapore time. */
const local = (instantMs: number) => new Date(instantMs + SINGAPORE_OFFSET_MS);
const two = (n: number) => String(n).padStart(2, "0");
const dateOf = (shifted: Date) => shifted.toISOString().slice(0, 10);
const clockOf = (shifted: Date) => `${two(shifted.getUTCHours())}:${two(shifted.getUTCMinutes())}`;
const clockMs = (hhmm: string) => (Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))) * 60 * 1000;

/** The instant the Singapore day containing `instantMs` begins. */
const dayStart = (instantMs: number) => Math.floor((instantMs + SINGAPORE_OFFSET_MS) / DAY_MS) * DAY_MS - SINGAPORE_OFFSET_MS;

/** "2026-12-07 10:00–12:00" on one day (a period ending at midnight reads 24:00), "… to …" across days. */
function describePeriod(startMs: number, endMs: number): string {
  const start = local(startMs);
  const end = local(endMs);
  const midnight = dayStart(startMs) + DAY_MS;
  if (endMs > midnight) return `${dateOf(start)} ${clockOf(start)} to ${dateOf(end)} ${clockOf(end)}`;
  return `${dateOf(start)} ${clockOf(start)}–${endMs === midnight ? "24:00" : clockOf(end)}`;
}

const notAssessed = (message: string): ConditionResult => ({
  condition: "OPERATING_HOURS",
  outcome: "NOT_ASSESSED",
  required: null,
  available: null,
  message,
});

export function checkOperatingHours(
  period: RequestedPeriod | null,
  operatingHours: SuitabilityVenue["operatingHours"],
): ConditionResult {
  if (!period) {
    return notAssessed("The event records no proposed period, so it was not compared with the venue's operating hours.");
  }
  const startMs = Date.parse(period.startsAt);
  const endMs = Date.parse(period.endsAt);
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) {
    return notAssessed(
      "The event's proposed period is not a valid start and end, so it was not compared with the venue's operating hours.",
    );
  }

  // Only the first day is compared. A period that runs past midnight cannot sit
  // inside one day's hours, because no venue closes later than 23:59, so it fails there.
  const start = local(startMs);
  const begins = dayStart(startMs);
  const [day] = calendarDays([dateOf(start)], operatingHours);
  const weekday = WEEKDAY_NAMES[start.getUTCDay()]!;
  const requested = describePeriod(startMs, endMs);

  if (day!.opensAt === null || day!.closesAt === null) {
    return {
      condition: "OPERATING_HOURS",
      outcome: "FAILED",
      required: requested,
      available: `${weekday} closed`,
      message: `The requested period ${requested} is outside ${weekday}'s operating hours: the venue is closed.`,
    };
  }
  const hours = `${day!.opensAt}–${day!.closesAt}`;
  const within =
    startMs - begins >= clockMs(day!.opensAt) && Math.min(endMs - begins, DAY_MS) <= clockMs(day!.closesAt);
  return {
    condition: "OPERATING_HOURS",
    outcome: within ? "MET" : "FAILED",
    required: requested,
    available: `${weekday} ${hours}`,
    message: `The requested period ${requested} is ${within ? "within" : "outside"} ${weekday}'s operating hours ${hours}.`,
  };
}

/** Runs every condition. Reasons are the failures, warnings the conditions that could not be assessed. */
export function assessSuitability(requirements: SuitabilityRequirements, venue: SuitabilityVenue): SuitabilityAssessment {
  const results = [
    checkLayoutCapacity(requirements.layout, requirements.attendance, venue.layouts),
    checkFacilities(requirements.facilities, venue.facilities),
    checkAccessibility(requirements.accessibilityFeatures, venue.accessibilityFeatures),
    checkOperatingHours(requirements.period, venue.operatingHours),
  ];
  const reasons = results.filter((result) => result.outcome === "FAILED");
  const warnings = results.filter((result) => result.outcome === "NOT_ASSESSED");
  const status = reasons.length > 0 ? "NOT_SUITABLE" : warnings.length > 0 ? "SUITABLE_WITH_WARNINGS" : "SUITABLE";
  return { status, reasons, warnings };
}

/** The event fields requirements are built from, as `findEventForPlanning` returns them. */
export interface EventRequirementSource {
  expectedAttendance: number | null;
  venueRequirements: unknown;
  accessibilityNeeds: string | null;
  proposedStartAt: string | null;
  proposedEndAt: string | null;
}

/**
 * What an event asks of a venue. Accessibility needs are free text on the event
 * (B1), so each line, or each entry separated by a comma or semicolon, is one
 * required feature. Venue requirements that aren't in the recorded shape
 * require nothing.
 */
export function requirementsFromEvent(event: EventRequirementSource): SuitabilityRequirements {
  const venue = venueRequirementsSchema.safeParse(event.venueRequirements);
  const recorded: VenueRequirements = venue.success ? venue.data : {};
  return {
    attendance: event.expectedAttendance,
    layout: recorded.layout ?? null,
    facilities: recorded.facilities ?? [],
    accessibilityFeatures: cleanList((event.accessibilityNeeds ?? "").split(/[\r\n,;]+/)),
    period:
      event.proposedStartAt && event.proposedEndAt
        ? { startsAt: event.proposedStartAt, endsAt: event.proposedEndAt }
        : null,
  };
}
