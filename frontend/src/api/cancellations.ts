import { request } from "./client.js";
import type { ChangeRequest } from "./changeRequests.js";
import type { EventStatus } from "./types.js";

const EVENT = "/event/api/v1";

/** F3 — mirrors `CancelledEvent` in documentation/api/planning-core.openapi.yaml. */
export interface CancelledEvent {
  id: string;
  reference: string | null;
  status: EventStatus;
  previousStatus: EventStatus;
  cancellationReason: string;
  cancelledBy: string;
  cancelledAt: string;
}

/** F4 — what the cancellation released, by reference. `registrations` is 0 until the registration service exists. */
export interface ReleasedOnCancellation {
  bookings: string[];
  holds: string[];
  requests: string[];
  reservations: { reservationId: string; equipmentTypeName: string; reservedQuantity: number }[];
  registrations: number;
}

/** F3 — the owner or the assigned coordinator cancels the event, with a reason; F4 releases what it holds. */
export function cancelEvent(token: string, eventId: string, reason: string) {
  return request<{ event: CancelledEvent; closedChangeRequest: ChangeRequest | null; released: ReleasedOnCancellation }>(`${EVENT}/events/${eventId}/cancellation`, {
    method: "POST",
    token,
    body: { reason },
  });
}
