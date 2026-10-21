import { z } from "zod";
import { UNAVAILABILITY_REASON_TYPES } from "./venueSlots.js";

/**
 * L1, L2, M1, M2, I2 — venue booking requests, and the bookings a block disrupts. A request doesn't reserve the venue: it waits
 * for Venue Staff to approve it (M1) or reject it (M2), and the coordinator may
 * withdraw it while it is Pending (L2). Only an approval creates a confirmed
 * booking, in venue_slots.
 */
export const BOOKING_REQUEST_STATUSES = ["PENDING", "APPROVED", "REJECTED", "WITHDRAWN"] as const;
export type BookingRequestStatus = (typeof BOOKING_REQUEST_STATUSES)[number];

export const BOOKING_REQUEST_STATUS_LABELS: Record<BookingRequestStatus, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
};

/**
 * K1, K2 — whether a venue suits an event or one of its booking requests. K2
 * records the result on each request when it is submitted (null on requests
 * made before K2: not assessed).
 */
export const SUITABILITY_STATUSES = ["SUITABLE", "SUITABLE_WITH_WARNINGS", "NOT_SUITABLE"] as const;
export type SuitabilityStatus = (typeof SUITABILITY_STATUSES)[number];

/**
 * Domain events the venue module publishes to the venue-booking aggregate's
 * topic, `KAFKA_TOPICS.venueBooking`. The payload carries what the notification
 * needs, its recipients included (ADR-0008), never a whole aggregate.
 */
export const bookingRequestSubmittedPayloadSchema = z.object({
  bookingRequestId: z.string().uuid(),
  reference: z.string().regex(/^BKR-\d{6}$/, "reference must be BKR- and six digits"),
  eventId: z.string().uuid(),
  eventReference: z.string().min(1),
  eventName: z.string().min(1),
  venueId: z.string().uuid(),
  venueName: z.string().min(1),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  /** The venue's Venue Staff when the request was submitted: the ones to notify (L1). */
  staffIds: z.array(z.string().uuid()).min(1),
  requestedBy: z.string().uuid(),
  requestedAt: z.string().datetime(),
});

/** What M1's approval and M2's rejection both carry: the request, and the two people told of the decision. */
const bookingRequestDecidedFields = {
  bookingRequestId: z.string().uuid(),
  reference: z.string().regex(/^BKR-\d{6}$/, "reference must be BKR- and six digits"),
  eventId: z.string().uuid(),
  eventReference: z.string().min(1),
  eventName: z.string().min(1),
  venueId: z.string().uuid(),
  venueName: z.string().min(1),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  /** The coordinator who requested the venue, and the event's owning organiser (M1, M2). */
  coordinatorId: z.string().uuid(),
  ownerId: z.string().uuid(),
  decidedBy: z.string().uuid(),
  decidedAt: z.string().datetime(),
};

/** M1: the request is Approved and its booking confirmed. */
export const bookingRequestApprovedPayloadSchema = z.object({
  ...bookingRequestDecidedFields,
  bookingId: z.string().uuid(),
  /** CR-02: the disrupted booking the approval released, if the request replaced one. */
  replacedBookingId: z.string().uuid().nullable(),
});

/** M2: the request is Rejected, with its reason and any suggested alternative. */
export const bookingRequestRejectedPayloadSchema = z.object({
  ...bookingRequestDecidedFields,
  reason: z.string().refine((s) => s.trim().length > 0, "reason must not be blank"),
  suggestion: z.string().min(1).nullable(),
});

/** What a block can disrupt (I2): a confirmed booking, a tentative hold (L3), or a pending request. */
export const DISRUPTED_KINDS = ["BOOKING", "HOLD", "REQUEST"] as const;
export type DisruptedKind = (typeof DISRUPTED_KINDS)[number];

/** One booking, hold or request a block disrupts, and the coordinator to tell (I2, CR-02). */
const disruptionFields = {
  blockId: z.string().uuid(),
  venueId: z.string().uuid(),
  venueName: z.string().min(1),
  kind: z.enum(DISRUPTED_KINDS),
  /** The booking's, hold's or request's own reference. */
  reference: z.string().min(1),
  eventId: z.string().uuid(),
  eventReference: z.string().min(1),
  eventName: z.string().min(1),
  /** A booking's or hold's event's assigned coordinator; a request's requesting coordinator. */
  coordinatorId: z.string().uuid(),
  blockStartsAt: z.string().datetime(),
  blockEndsAt: z.string().datetime(),
  reasonType: z.enum(UNAVAILABILITY_REASON_TYPES),
  description: z.string().min(1),
  /** The Venue Staff member who recorded or removed the block, and when. */
  actedBy: z.string().uuid(),
  actedAt: z.string().datetime(),
};

/** I2: a block was recorded over this booking, hold or request, which now requires reconfirmation. */
export const bookingDisruptedPayloadSchema = z.object(disruptionFields);

/** Why a flag stays when a block is removed: another active block (I2), or the venue's setup and turnaround time (H3). */
export const STILL_FLAGGED_CAUSES = ["UNAVAILABILITY", "BUFFER_CONFLICT"] as const;
export type StillFlaggedCause = (typeof STILL_FLAGGED_CAUSES)[number];

/**
 * I2: the block was removed. The flag is cleared unless another active block
 * still disrupts it, or H3-T14 the venue's times still make it overlap another.
 * `stillCause` says which; messages written before H3-T14 don't carry it.
 */
export const disruptionClearedPayloadSchema = z.object({
  ...disruptionFields,
  stillDisrupted: z.boolean(),
  stillCause: z.enum(STILL_FLAGGED_CAUSES).nullable().optional(),
});

/**
 * L6 — hold expiry. `hold-placed` and `hold-expiry-changed` are for the hold-expiry
 * workflow's consumer (nobody is notified); `hold-expiring` and `hold-expired`
 * tell the holding coordinator, named in `coordinatorId`.
 */
const holdReference = z.string().regex(/^HLD-\d{6}$/, "holdReference must be HLD- and six digits");

/** L3 placed the hold: schedule its reminder and expiry (L6). */
export const holdPlacedPayloadSchema = z.object({
  holdId: z.string().uuid(),
  holdReference,
  venueId: z.string().uuid(),
  eventId: z.string().uuid(),
  expiresAt: z.string().datetime(),
  reminderLeadMinutes: z.number().int().min(1),
});

/** L6: Venue Staff moved a held hold's expiry; reschedule its reminder and expiry. */
export const holdExpiryChangedPayloadSchema = z.object({
  holdId: z.string().uuid(),
  holdReference,
  venueId: z.string().uuid(),
  expiresAt: z.string().datetime(),
  /** The hold's reminder lead, so the workflow can restart the reminder without asking the database. */
  reminderLeadMinutes: z.number().int().min(1),
  changedBy: z.string().uuid(),
});

/** What the reminder and the expiry notice both carry: the hold, its event and period, and who to tell. */
const holdNoticeFields = {
  holdId: z.string().uuid(),
  holdReference,
  venueId: z.string().uuid(),
  venueName: z.string().min(1),
  eventId: z.string().uuid(),
  eventReference: z.string().min(1),
  eventName: z.string().min(1),
  /** The coordinator who requested the hold (CQ-06). */
  coordinatorId: z.string().uuid(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
};

/** L6: the hold expires soon (AC4). */
export const holdExpiringPayloadSchema = z.object(holdNoticeFields);

/** L6: the hold expired and its period is free (AC2, AC4). */
export const holdExpiredPayloadSchema = z.object(holdNoticeFields);

/**
 * H3-T10, H3-T11 (CR-01): Venue Staff changed the venue's setup or turnaround
 * time, and this booking, hold or pending request now overlaps the others
 * named, so it requires reconfirmation. Nothing is removed, released or moved.
 */
export const bufferConflictFlaggedPayloadSchema = z.object({
  venueId: z.string().uuid(),
  venueName: z.string().min(1),
  kind: z.enum(DISRUPTED_KINDS),
  reference: z.string().min(1),
  eventId: z.string().uuid(),
  eventReference: z.string().min(1),
  eventName: z.string().min(1),
  /** A booking's or hold's event's assigned coordinator; a request's requesting coordinator. */
  coordinatorId: z.string().uuid(),
  /** The other bookings', holds' and requests' references it now overlaps. */
  overlapsReferences: z.array(z.string().min(1)).min(1),
  /** The venue's times after the change. */
  setupMinutes: z.number().int().min(0),
  turnaroundMinutes: z.number().int().min(0),
  actedBy: z.string().uuid(),
  actedAt: z.string().datetime(),
});

/** Validators keyed by messageType, for producers and consumers alike. */
export const VENUE_BOOKING_PAYLOAD_SCHEMAS = {
  "venue-booking.request-submitted": bookingRequestSubmittedPayloadSchema,
  "venue-booking.request-approved": bookingRequestApprovedPayloadSchema,
  "venue-booking.request-rejected": bookingRequestRejectedPayloadSchema,
  "venue-booking.booking-disrupted": bookingDisruptedPayloadSchema,
  "venue-booking.disruption-cleared": disruptionClearedPayloadSchema,
  "venue-booking.hold-placed": holdPlacedPayloadSchema,
  "venue-booking.hold-expiry-changed": holdExpiryChangedPayloadSchema,
  "venue-booking.hold-expiring": holdExpiringPayloadSchema,
  "venue-booking.hold-expired": holdExpiredPayloadSchema,
  "venue-booking.buffer-conflict-flagged": bufferConflictFlaggedPayloadSchema,
} as const;

export type VenueBookingMessageType = keyof typeof VENUE_BOOKING_PAYLOAD_SCHEMAS;
