import { venueRequirementsSchema } from "@connectsphere/contracts";

/**
 * J1 — what the search is pre-filled with when it is opened from an event: the
 * event's window, expected attendance, layout, facilities and accessibility
 * needs (AC8). The coordinator can change every one of them.
 *
 * B1 records layout and facilities as lists of names and accessibility as free
 * text, so the values are matched to the catalogue's own spellings where they
 * can be, to keep the form's ticks in step with what the search compares. An
 * accessibility need that matches no catalogue feature is not turned into a
 * filter, which would only empty the results; it is handed back for the screen
 * to show.
 */

export interface CatalogueOptions {
  layouts: string[];
  facilities: string[];
  accessibilityFeatures: string[];
}

export interface EventForPrefill {
  proposedStartAt: string | null;
  proposedEndAt: string | null;
  expectedAttendance: number | null;
  venueRequirements: unknown;
  accessibilityNeeds: string | null;
}

export interface SearchPrefill {
  filters: {
    from: string | null;
    to: string | null;
    minCapacity: number | null;
    layout: string | null;
    facilities: string[];
    accessibility: string[];
  };
  /** Accessibility needs on the event that match no catalogue feature. */
  unmatchedAccessibility: string[];
}

/** The catalogue's spelling of `name` when it has one (ignoring case), otherwise `name` as given. */
function inCatalogue(name: string, options: readonly string[]): string {
  return options.find((option) => option.toLowerCase() === name.toLowerCase()) ?? name;
}

function cleanNames(names: readonly string[]): string[] {
  return [...new Set(names.map((name) => name.trim()).filter((name) => name !== ""))];
}

export function prefillFromEvent(event: EventForPrefill, options: CatalogueOptions): SearchPrefill {
  const hasWindow = event.proposedStartAt !== null && event.proposedEndAt !== null;
  const requirements = venueRequirementsSchema.safeParse(event.venueRequirements);
  const required = requirements.success ? requirements.data : {};
  const layout = required.layout?.trim() ?? "";

  const needs = cleanNames((event.accessibilityNeeds ?? "").split(/[,;\n]/));
  const known = needs.map((need) => inCatalogue(need, options.accessibilityFeatures));
  const isKnown = (need: string) => options.accessibilityFeatures.includes(need);

  return {
    filters: {
      from: hasWindow ? event.proposedStartAt : null,
      to: hasWindow ? event.proposedEndAt : null,
      minCapacity: event.expectedAttendance !== null && event.expectedAttendance > 0 ? event.expectedAttendance : null,
      layout: layout === "" ? null : inCatalogue(layout, options.layouts),
      facilities: [...new Set(cleanNames(required.facilities ?? []).map((name) => inCatalogue(name, options.facilities)))],
      accessibility: [...new Set(known.filter(isKnown))],
    },
    unmatchedAccessibility: [...new Set(known.filter((need) => !isKnown(need)))],
  };
}
