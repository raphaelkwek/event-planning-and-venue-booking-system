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

/**
 * R7 — the owning organiser or the assigned coordinator added the attendee
 * (perhaps above capacity, D-01). The attendee is told, and can withdraw under
 * R4's terms. The reason for the addition stays on the organiser's list: it is
 * not sent to the attendee.
 */
export const registrationAddedPayloadSchema = z.object({
  ...registrationFields,
  registeredAt: z.string().datetime(),
  eventStartsAt: z.string().datetime().nullable(),
  eventEndsAt: z.string().datetime().nullable(),
  /** identity.users.id of the organiser or coordinator who added them. */
  addedBy: z.string().uuid(),
  /** The adder's name as identity gave it, so the notice can say who; null if identity didn't say. */
  addedByName: z.string().min(1).nullable(),
  addedOverCapacity: z.boolean(),
});

/**
 * R6 — an attendee's place on an event's waitlist. Nothing is deleted: leaving
 * (WITHDRAWN), the event's cancellation (CANCELLED) and registering, which ends
 * the entry (REGISTERED), are statuses. Only WAITLISTED is active.
 */
export const WAITLIST_STATUSES = ["WAITLISTED", "REGISTERED", "WITHDRAWN", "CANCELLED"] as const;
export type WaitlistStatus = (typeof WAITLIST_STATUSES)[number];

/** How a waitlist status reads to the attendee and the organiser (R6). */
export const WAITLIST_STATUS_LABELS: Record<WaitlistStatus, string> = {
  WAITLISTED: "Waitlisted",
  REGISTERED: "Registered",
  WITHDRAWN: "Left the waitlist",
  CANCELLED: "Cancelled",
};

/** A waitlist entry's own reference: WL- and six digits. */
const waitlistReference = z.string().regex(/^WL-\d{6}$/, "waitlistReference must be WL- and six digits");

/** What every waitlist message carries. Published to `KAFKA_TOPICS.registration`, keyed by the entry's id. */
const waitlistFields = {
  waitlistEntryId: z.string().uuid(),
  waitlistReference,
  eventId: z.string().uuid(),
  eventReference: z.string().min(1),
  eventName: z.string().min(1),
  attendeeId: z.string().uuid(),
};

/**
 * R6 — a place opened (a withdrawal, or a further confirmed booking), so the
 * waiting attendee is invited to register. Nobody is registered for them:
 * places go to whoever registers first.
 */
export const waitlistPlaceOpenedPayloadSchema = z.object({
  ...waitlistFields,
  placesRemaining: z.number().int().positive(),
  openedAt: z.string().datetime(),
});

/** R6 — the event was cancelled, so the attendee's place on its waitlist is too. */
export const waitlistCancelledPayloadSchema = z.object({
  ...waitlistFields,
  cancelledAt: z.string().datetime(),
});

/** Validators keyed by message type, for producers and consumers alike. */
export const REGISTRATION_PAYLOAD_SCHEMAS = {
  "registration.confirmed": registrationConfirmedPayloadSchema,
  "registration.withdrawn": registrationWithdrawnPayloadSchema,
  "registration.cancelled": registrationCancelledPayloadSchema,
  "registration.added": registrationAddedPayloadSchema,
  "waitlist.place-opened": waitlistPlaceOpenedPayloadSchema,
  "waitlist.cancelled": waitlistCancelledPayloadSchema,
} as const;

export type RegistrationMessageType = keyof typeof REGISTRATION_PAYLOAD_SCHEMAS;
