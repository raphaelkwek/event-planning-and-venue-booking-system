/**
 * Error codes returned in the `error.code` field of the envelope defined in
 * implementation.md §5. Codes are shared so that a consumer can branch on
 * them; a service returning a code absent from this list is a failed review.
 */
export const ERROR_CODES = [
  "UNAUTHENTICATED",
  "NO_ROLE_ASSIGNED",
  "UNKNOWN_RESOURCE",
  "INVALID_CREDENTIALS",
  "ACCOUNT_DEACTIVATED",
  "VALIDATION_FAILED",
  "ROLE_NOT_AUTHORISED",
  "EVENT_NOT_FOUND",
  "DRAFT_NOT_FOUND",
  "STATUS_TRANSITION_NOT_PERMITTED",
  "EVENT_ALREADY_DECIDED",
  "DRAFT_ALREADY_SUBMITTED",
  "NO_OPEN_CLARIFICATION",
  "IDENTITY_UNAVAILABLE",
  "REASSIGNMENT_NOT_PERMITTED",
  "NOMINEE_NOT_ELIGIBLE",
  "SELF_NOMINATION_NOT_PERMITTED",
  "REASSIGNMENT_ALREADY_PENDING",
  "REASSIGNMENT_PROPOSAL_NOT_FOUND",
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
