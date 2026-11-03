/**
 * Error codes returned in the `error.code` field of the envelope defined in
 * implementation.md §5. Codes are shared so that a consumer can branch on
 * them; a service returning a code absent from this list is a failed review.
 *
 * Keep the list in alphabetical order and put a new code in its place, not at the end, so that
 * pull requests adding codes touch different lines. The contracts tests and `npm run lint:api`
 * check the order, and that planning-core's OpenAPI `ErrorCode` enum holds the same codes.
 */
export const ERROR_CODES = [
  "ACCOUNT_DEACTIVATED",
  "ADMISSION_EXPIRED", // EN-19: the waiting room. A high-demand event takes registrations only with an admission token.
  "ADMISSION_REQUIRED",
  "ALREADY_ASSIGNED", // E3: the Lead assigns only an active Event Coordinator, once, to a submitted event.
  "ARRANGEMENTS_NOT_READY",
  "ARRANGEMENTS_UNAVAILABLE",
  "ARRANGEMENT_FLAGS_OUTSTANDING", // U1: the Safety Officer's decision, and the coordinator's Mark Confirmed that only a passed check allows.
  "ATTENDEE_NOT_FOUND", // R7: manual additions.
  "BLOCK_ALREADY_REMOVED",
  "BLOCK_NOT_FOUND",
  "BOOKING_REQUEST_DUPLICATE",
  "BOOKING_REQUEST_NOT_FOUND",
  "BOOKING_REQUEST_NOT_PENDING",
  "CANCELLATION_CONTENDED", // F4: every attempt found the event's venue arrangements changing under it, so nothing was cancelled.
  "CANCELLATION_FAILED", // F3: a cancelled event refuses new equipment; a cancellation that fails changes nothing.
  "CHANGE_REQUEST_ALREADY_DECIDED",
  "CHANGE_REQUEST_ALREADY_PENDING",
  "CHANGE_REQUEST_NOT_FOUND",
  "CHANGE_REQUEST_NO_LONGER_VALID",
  "CHANGE_REQUEST_REQUIRED",
  "DRAFT_ALREADY_SUBMITTED",
  "DRAFT_NOT_FOUND",
  "EQUIPMENT_LINE_NOT_EDITABLE",
  "EQUIPMENT_LINE_NOT_FOUND",
  "EQUIPMENT_TYPE_NOT_FOUND",
  "EVENT_ALREADY_DECIDED",
  "EVENT_CANCELLED", // F3: a cancelled event refuses new equipment; a cancellation that fails changes nothing.
  "EVENT_NOT_ASSIGNED", // E4: the Lead reassigns only an event that has a coordinator; E2's proposals are retired.
  "EVENT_NOT_BOOKABLE",
  "EVENT_NOT_CHANGEABLE",
  "EVENT_NOT_EDITABLE",
  "EVENT_NOT_FOUND",
  "EVENT_NOT_HOLDABLE",
  "EVENT_VERSION_MISMATCH",
  "EVENT_VERSION_REQUIRED",
  "FEATURE_DISABLED",
  "HOLD_DUPLICATE",
  "HOLD_NOT_FOUND",
  "HOLD_NOT_HELD",
  "HOLD_NOT_REQUESTED",
  "IDENTITY_UNAVAILABLE",
  "INSUFFICIENT_EQUIPMENT",
  "INTERNAL_ERROR", // Anything a route did not expect: a 500 with a generic message, the detail only in the log.
  "INVALID_CREDENTIALS",
  "JUSTIFICATION_REQUIRED",
  "LINE_NOT_RELEASABLE",
  "LINE_NOT_RESERVABLE",
  "NOMINEE_NOT_ELIGIBLE",
  "NOTIFICATION_NOT_FOUND",
  "NOT_AN_ACTIVE_COORDINATOR", // E3: the Lead assigns only an active Event Coordinator, once, to a submitted event.
  "NO_OPEN_CLARIFICATION",
  "NO_ROLE_ASSIGNED",
  "PARTIAL_NOT_CONFIRMED",
  "RATE_LIMITED",
  "REASSIGNMENT_ALREADY_PENDING",
  "REASSIGNMENT_NOT_PERMITTED",
  "REASSIGNMENT_PROPOSAL_NOT_FOUND",
  "REASSIGNMENT_RETIRED", // E4: the Lead reassigns only an event that has a coordinator; E2's proposals are retired.
  "REGISTRATION_DUPLICATE", // R2 to R4: the registration service's refusals.
  "REGISTRATION_EVENT_CLOSED",
  "REGISTRATION_FULL", // R2 to R4: the registration service's refusals.
  "REGISTRATION_NOT_ACTIVE", // R2 to R4: the registration service's refusals.
  "REGISTRATION_NOT_FOUND", // R2 to R4: the registration service's refusals.
  "REGISTRATION_NO_CONFIRMED_BOOKING",
  "REGISTRATION_OUTSIDE_WINDOW", // R2 to R4: the registration service's refusals.
  "REGISTRATION_OVER_CAPACITY_UNCONFIRMED",
  "REPLACEMENT_NOT_VALID",
  "RESERVATION_ALREADY_RELEASED",
  "ROLE_NOT_AUTHORISED",
  "SAFETY_CHECK_NOT_PASSED", // U1: the Safety Officer's decision, and the coordinator's Mark Confirmed that only a passed check allows.
  "SAFETY_DECISION_ALREADY_RECORDED", // U1: the Safety Officer's decision, and the coordinator's Mark Confirmed that only a passed check allows.
  "SELF_NOMINATION_NOT_PERMITTED",
  "STATUS_NOT_ASSIGNABLE", // E3: the Lead assigns only an active Event Coordinator, once, to a submitted event.
  "STATUS_TRANSITION_NOT_PERMITTED",
  "UNAUTHENTICATED",
  "UNKNOWN_RESOURCE",
  "VALIDATION_FAILED",
  "VENUE_INACTIVE",
  "VENUE_NOT_FOUND",
  "VENUE_SLOT_CONFLICT",
  "VENUE_UNAVAILABLE",
  "WAITING_ROOM_ENTRY_NOT_FOUND",
  "WAITING_ROOM_NOT_REQUIRED",
  "WAITING_ROOM_UNAVAILABLE",
  "WAITLIST_DUPLICATE", // R6: the waitlist.
  "WAITLIST_ENTRY_NOT_ACTIVE",
  "WAITLIST_ENTRY_NOT_FOUND",
  "WAITLIST_PLACES_AVAILABLE",
  "WITHDRAWAL_DEADLINE_PASSED", // R2 to R4: the registration service's refusals.
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export interface ErrorField {
  field: string;
  message: string;
}

export interface ErrorEnvelope {
  error: {
    code: ErrorCode;
    message: string;
    details?: Record<string, unknown>;
    fields?: ErrorField[];
    correlationId: string | null;
  };
}
