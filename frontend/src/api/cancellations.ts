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

/** F3 — the owner or the assigned coordinator cancels the event, with a reason. */
export function cancelEvent(token: string, eventId: string, reason: string) {
  return request<{ event: CancelledEvent; closedChangeRequest: ChangeRequest | null }>(`${EVENT}/events/${eventId}/cancellation`, {
    method: "POST",
    token,
    body: { reason },
  });
}
