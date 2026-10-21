/**
 * The error type the venue module throws when a hold's event can't be found
 * (`HoldEventMissingError`). Temporal reports an activity's error by its class
 * name, and the HoldExpiry workflow lists it as non-retryable. Kept here, free
 * of imports, because workflow code can't import the venue module.
 */
export const HOLD_EVENT_MISSING_ERROR = "HoldEventMissingError";
