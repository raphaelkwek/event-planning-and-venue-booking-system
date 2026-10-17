import { z } from "zod";

/**
 * L1, L2, M1, M2 — venue booking requests. A request doesn't reserve the venue: it waits
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

/** Validators keyed by messageType, for producers and consumers alike. */
export const VENUE_BOOKING_PAYLOAD_SCHEMAS = {
  "venue-booking.request-submitted": bookingRequestSubmittedPayloadSchema,
  "venue-booking.request-approved": bookingRequestApprovedPayloadSchema,
  "venue-booking.request-rejected": bookingRequestRejectedPayloadSchema,
} as const;

export type VenueBookingMessageType = keyof typeof VENUE_BOOKING_PAYLOAD_SCHEMAS;
