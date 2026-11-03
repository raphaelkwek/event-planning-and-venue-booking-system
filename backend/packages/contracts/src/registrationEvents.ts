import { z } from "zod";

/**
 * R2 to R4 — an attendee's registration for an event, owned by the
 * registration service (ADR-0005). Nothing is deleted: a withdrawal (R4) and
 * the event's cancellation (R3, F4) are statuses.
 */
export const REGISTRATION_STATUSES = ["REGISTERED", "WITHDRAWN", "CANCELLED"] as const;
export type RegistrationStatus = (typeof REGISTRATION_STATUSES)[number];

/** How a status reads to an attendee (R3). */
export const REGISTRATION_STATUS_LABELS: Record<RegistrationStatus, string> = {
  REGISTERED: "Registered",
  WITHDRAWN: "Withdrawn",
  CANCELLED: "Cancelled",
};

/** A registration's own reference, which refusals and notifications name: REG- and six digits. */
const registrationReference = z.string().regex(/^REG-\d{6}$/, "registrationReference must be REG- and six digits");

/**
 * What every registration message carries: the registration, its event as the
 * notification names it, and the attendee to tell. Published to
 * `KAFKA_TOPICS.registration`, keyed by the registration's id.
 */
const registrationFields = {
  registrationId: z.string().uuid(),
  registrationReference,
  eventId: z.string().uuid(),
  eventReference: z.string().min(1),
  eventName: z.string().min(1),
  attendeeId: z.string().uuid(),
};

/** R2: a place is reserved for the attendee, who is sent a confirmation. */
export const registrationConfirmedPayloadSchema = z.object({
  ...registrationFields,
  registeredAt: z.string().datetime(),
  /** The event's times, for the confirmation; null only if the event has none recorded. */
  eventStartsAt: z.string().datetime().nullable(),
  eventEndsAt: z.string().datetime().nullable(),
});

/**
 * R4: the attendee withdrew and their place is free again. The attendee is sent
 * a confirmation; R6 reads the same message to tell waitlisted attendees that a
 * place is open.
 */
export const registrationWithdrawnPayloadSchema = z.object({
  ...registrationFields,
  registeredAt: z.string().datetime(),
  withdrawnAt: z.string().datetime(),
});

/** R3, F4: the event was cancelled, so the registration is Cancelled and the attendee is told. */
export const registrationCancelledPayloadSchema = z.object({
  ...registrationFields,
  cancelledAt: z.string().datetime(),
});

/** Validators keyed by message type, for producers and consumers alike. */
export const REGISTRATION_PAYLOAD_SCHEMAS = {
  "registration.confirmed": registrationConfirmedPayloadSchema,
  "registration.withdrawn": registrationWithdrawnPayloadSchema,
  "registration.cancelled": registrationCancelledPayloadSchema,
} as const;

export type RegistrationMessageType = keyof typeof REGISTRATION_PAYLOAD_SCHEMAS;
