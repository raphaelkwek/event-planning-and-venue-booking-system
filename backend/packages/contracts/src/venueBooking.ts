import { z } from "zod";

/**
 * L1, L2 — venue booking requests. A request doesn't reserve the venue: it waits
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

/** Validators keyed by messageType, for producers and consumers alike. */
export const VENUE_BOOKING_PAYLOAD_SCHEMAS = {
  "venue-booking.request-submitted": bookingRequestSubmittedPayloadSchema,
} as const;

export type VenueBookingMessageType = keyof typeof VENUE_BOOKING_PAYLOAD_SCHEMAS;
