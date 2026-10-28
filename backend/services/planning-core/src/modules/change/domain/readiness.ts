import { EQUIPMENT_LINE_STATUS_LABELS, type EquipmentRequestLineStatus } from "@connectsphere/contracts";

/**
 * F5 — whether an event's venue and equipment are ready for it to be confirmed,
 * and, when they are not, exactly what is outstanding (AC2, AC3, AC6, AC7). Pure:
 * the change module reads the arrangements live, inside the confirmation's
 * transaction, and passes them in (AC4). Nothing here is stored.
 */

/**
 * The flags that hold confirmation back (AC7). I2, H3 and S3 set Requires
 * Reconfirmation; S3 sets Unsuitable on a booking and Flagged for review on a
 * reservation. The venue and equipment reads report all three.
 */
export type ArrangementFlag = "REQUIRES_RECONFIRMATION" | "UNSUITABLE" | "FLAGGED_FOR_REVIEW";

export interface ReadinessBooking {
  reference: string;
  venueName: string;
  status: "HELD" | "CONFIRMED";
  flags: readonly ArrangementFlag[];
}

export interface ReadinessRequest {
  reference: string;
  venueName: string;
  flags: readonly ArrangementFlag[];
}

export interface ReadinessLine {
  id: string;
  equipmentTypeName: string;
  quantity: number;
  status: EquipmentRequestLineStatus;
  reservation: { requestedQuantity: number; reservedQuantity: number } | null;
  flags?: readonly ArrangementFlag[];
}

export interface ReadinessInput {
  /** The event's own answer to "is equipment required?"; false means it needs none (AC3). */
  equipmentRequired: boolean | null;
  bookings: readonly ReadinessBooking[];
  requests: readonly ReadinessRequest[];
  lines: readonly ReadinessLine[];
}

export type VenueOutstanding =
  | { kind: "NO_CONFIRMED_BOOKING" }
  | { kind: "HOLD"; reference: string; venueName: string }
  | { kind: "PENDING_REQUEST"; reference: string; venueName: string };

export type EquipmentOutstanding =
  | { kind: "NONE_REQUESTED" }
  | {
      kind: "LINE";
      lineId: string;
      equipmentTypeName: string;
      quantity: number;
      status: EquipmentRequestLineStatus;
      requestedQuantity: number | null;
      reservedQuantity: number | null;
    };

export interface FlagOutstanding {
  arrangement: "BOOKING" | "HOLD" | "BOOKING_REQUEST" | "EQUIPMENT_LINE";
  /** The booking's, hold's or request's reference, or the equipment line's id. */
  reference: string;
  /** The venue's name, or the line as "<type> × <quantity>". */
  name: string;
  flag: ArrangementFlag;
}

export type Readiness =
  | { ready: true }
  | {
      ready: false;
      message: string;
      venue: VenueOutstanding[];
      equipment: EquipmentOutstanding[];
      flags: FlagOutstanding[];
    };

/**
 * AC2 — at least one confirmed booking, and every active arrangement confirmed.
 * CQ-05 asks the customer whether every one must be; until it is answered this
 * follows AC2 as written. "One is enough" would drop the HOLD and PENDING_REQUEST
 * entries whenever a confirmed booking exists.
 */
export function venueOutstanding(bookings: readonly ReadinessBooking[], requests: readonly ReadinessRequest[]): VenueOutstanding[] {
  const outstanding: VenueOutstanding[] = [];
  if (!bookings.some((booking) => booking.status === "CONFIRMED")) outstanding.push({ kind: "NO_CONFIRMED_BOOKING" });
  for (const booking of bookings) {
    if (booking.status === "HELD") outstanding.push({ kind: "HOLD", reference: booking.reference, venueName: booking.venueName });
  }
  for (const request of requests) {
    outstanding.push({ kind: "PENDING_REQUEST", reference: request.reference, venueName: request.venueName });
  }
  return outstanding;
}

/** AC3 — reserved in full means a Reserved line whose reservation holds everything it set out to. */
export function isReservedInFull(line: ReadinessLine): boolean {
  return (
    line.status === "RESERVED" &&
    line.reservation !== null &&
    line.reservation.reservedQuantity === line.reservation.requestedQuantity
  );
}

/**
 * AC3 — complete when the event is marked as needing no equipment, or when it
 * has lines and every one is reserved in full. An event that needs equipment and
 * has no line has nothing arranged, so it is not complete.
 */
export function equipmentOutstanding(equipmentRequired: boolean | null, lines: readonly ReadinessLine[]): EquipmentOutstanding[] {
  if (equipmentRequired === false) return [];
  if (lines.length === 0) return [{ kind: "NONE_REQUESTED" }];
  return lines
    .filter((line) => !isReservedInFull(line))
    .map((line) => ({
      kind: "LINE",
      lineId: line.id,
      equipmentTypeName: line.equipmentTypeName,
      quantity: line.quantity,
      status: line.status,
      requestedQuantity: line.reservation?.requestedQuantity ?? null,
      reservedQuantity: line.reservation?.reservedQuantity ?? null,
    }));
}

const lineName = (line: { equipmentTypeName: string; quantity: number }) => `${line.equipmentTypeName} × ${line.quantity}`;

/** AC7 — every flag on every active arrangement, in the order the arrangements were read. */
export function flagsOutstanding(input: ReadinessInput): FlagOutstanding[] {
  const flags: FlagOutstanding[] = [];
  for (const booking of input.bookings) {
    for (const flag of booking.flags) {
      flags.push({ arrangement: booking.status === "HELD" ? "HOLD" : "BOOKING", reference: booking.reference, name: booking.venueName, flag });
    }
  }
  for (const request of input.requests) {
    for (const flag of request.flags) {
      flags.push({ arrangement: "BOOKING_REQUEST", reference: request.reference, name: request.venueName, flag });
    }
  }
  for (const line of input.lines) {
    for (const flag of line.flags ?? []) {
      flags.push({ arrangement: "EQUIPMENT_LINE", reference: line.id, name: lineName(line), flag });
    }
  }
  return flags;
}

function describeVenue(item: VenueOutstanding): string {
  switch (item.kind) {
    case "NO_CONFIRMED_BOOKING":
      return "no venue booking is confirmed";
    case "HOLD":
      return `hold ${item.reference} at ${item.venueName} is only a tentative hold`;
    case "PENDING_REQUEST":
      return `booking request ${item.reference} at ${item.venueName} is still pending`;
  }
}

function describeEquipment(item: EquipmentOutstanding): string {
  if (item.kind === "NONE_REQUESTED") return "no equipment has been requested, and the event is not marked as needing none";
  if (item.reservedQuantity !== null && item.requestedQuantity !== null && item.reservedQuantity < item.requestedQuantity) {
    return `${lineName(item)} has ${item.reservedQuantity} of ${item.requestedQuantity} reserved`;
  }
  return `${lineName(item)} is ${EQUIPMENT_LINE_STATUS_LABELS[item.status]}`;
}

const ARRANGEMENT_WORDS: Record<FlagOutstanding["arrangement"], string> = {
  BOOKING: "booking",
  HOLD: "hold",
  BOOKING_REQUEST: "booking request",
  EQUIPMENT_LINE: "equipment",
};

const FLAG_WORDS: Record<ArrangementFlag, string> = {
  REQUIRES_RECONFIRMATION: "requires reconfirmation",
  UNSUITABLE: "is flagged unsuitable",
  FLAGGED_FOR_REVIEW: "is flagged for review",
};

function describeFlag(item: FlagOutstanding): string {
  const what =
    item.arrangement === "EQUIPMENT_LINE"
      ? `${ARRANGEMENT_WORDS[item.arrangement]} ${item.name}`
      : `${ARRANGEMENT_WORDS[item.arrangement]} ${item.reference} at ${item.name}`;
  return `${what} ${FLAG_WORDS[item.flag]}`;
}

/** AC6, AC7 — one sentence per outstanding arrangement, naming each item. */
export function refusalMessage(venue: readonly VenueOutstanding[], equipment: readonly EquipmentOutstanding[], flags: readonly FlagOutstanding[]): string {
  const parts = ["This event can't be confirmed yet."];
  if (venue.length > 0) parts.push(`Venue: ${venue.map(describeVenue).join("; ")}.`);
  if (equipment.length > 0) parts.push(`Equipment: ${equipment.map(describeEquipment).join("; ")}.`);
  if (flags.length > 0) parts.push(`Outstanding flags: ${flags.map(describeFlag).join("; ")}.`);
  return parts.join(" ");
}

export function assessReadiness(input: ReadinessInput): Readiness {
  const venue = venueOutstanding(input.bookings, input.requests);
  const equipment = equipmentOutstanding(input.equipmentRequired, input.lines);
  const flags = flagsOutstanding(input);
  if (venue.length === 0 && equipment.length === 0 && flags.length === 0) return { ready: true };
  return { ready: false, message: refusalMessage(venue, equipment, flags), venue, equipment, flags };
}

/** AC5 — what the coordinator is told when the arrangements could not be read. */
export const ARRANGEMENTS_UNAVAILABLE_MESSAGE =
  "The venue and equipment arrangements could not be checked, so the event was not confirmed. Nothing was changed. Try again.";

/** AC1 — the refusal for a coordinator who is not the event's assigned one. */
export const NOT_ASSIGNED_MESSAGE = "Only the event's assigned coordinator can confirm its arrangements.";
