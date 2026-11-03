import type { eventCancelledPayloadSchema, eventListingChangedPayloadSchema } from "@connectsphere/contracts";

/** The data of the two event messages the registration service reads, as their contracts validate them. */
export type EventListingChanged = ReturnType<(typeof eventListingChangedPayloadSchema)["parse"]>;
export type EventCancelled = ReturnType<(typeof eventCancelledPayloadSchema)["parse"]>;
