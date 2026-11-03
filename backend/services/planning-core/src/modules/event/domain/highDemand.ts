import type { ErrorField } from "@connectsphere/contracts";

/**
 * EN-19 — the organiser's high-demand flag on an event. Whether registering
 * for the event needs a place in the waiting room is the registration
 * service's business; the event only holds the flag and publishes it. Pure: no I/O.
 */

type FlagRead = { ok: true; highDemand: boolean } | { ok: false; fields: ErrorField[] };

/** The flag in a request body: exactly `{ "highDemand": true | false }`, nothing else. */
export function readHighDemand(body: unknown): FlagRead {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, fields: [{ field: "body", message: 'Send {"highDemand": true} or {"highDemand": false}.' }] };
  }
  const input = body as Record<string, unknown>;
  const fields: ErrorField[] = Object.keys(input)
    .filter((field) => field !== "highDemand")
    .map((field) => ({ field, message: "This field can't be set here." }));
  if (typeof input.highDemand !== "boolean") {
    fields.push({ field: "highDemand", message: "Say whether this is a high-demand event: true or false." });
  }
  if (fields.length > 0) return { ok: false, fields };
  return { ok: true, highDemand: input.highDemand as boolean };
}

/** The history entry for a change of the flag, or null when the value is the one already set. */
export function highDemandChange(
  current: boolean,
  next: boolean,
): { fieldName: "highDemand"; previousValue: string; newValue: string } | null {
  if (current === next) return null;
  return { fieldName: "highDemand", previousValue: String(current), newValue: String(next) };
}
