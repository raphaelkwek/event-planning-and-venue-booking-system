/**
 * G1 — an event's significant fields: the ones arrangements already depend on,
 * so once an event is approved they change only through a change request (S1,
 * S2), never through G1's edit of descriptive details. G2, S1 and S2 reuse this
 * list, so it is kept here, once. Names are the event API's field names.
 */
export const SIGNIFICANT_EVENT_FIELDS = [
  "proposedStartAt",
  "proposedEndAt",
  "expectedAttendance",
  "venueRequirements",
  "equipmentRequired",
  "equipmentRequirements",
] as const;

export type SignificantEventField = (typeof SIGNIFICANT_EVENT_FIELDS)[number];

export function isSignificantEventField(field: string): field is SignificantEventField {
  return (SIGNIFICANT_EVENT_FIELDS as readonly string[]).includes(field);
}
