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

/** I2: the block was removed. The flag is cleared unless another active block still disrupts it. */
export const disruptionClearedPayloadSchema = z.object({ ...disruptionFields, stillDisrupted: z.boolean() });

/** Validators keyed by messageType, for producers and consumers alike. */
export const VENUE_BOOKING_PAYLOAD_SCHEMAS = {
  "venue-booking.request-submitted": bookingRequestSubmittedPayloadSchema,
  "venue-booking.request-approved": bookingRequestApprovedPayloadSchema,
  "venue-booking.request-rejected": bookingRequestRejectedPayloadSchema,
  "venue-booking.booking-disrupted": bookingDisruptedPayloadSchema,
  "venue-booking.disruption-cleared": disruptionClearedPayloadSchema,
} as const;

export type VenueBookingMessageType = keyof typeof VENUE_BOOKING_PAYLOAD_SCHEMAS;
