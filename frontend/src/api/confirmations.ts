import { request } from "./client.js";
import type { LineStatus } from "./equipmentRequests.js";
import type { EventStatus } from "./types.js";

const EVENT = "/event/api/v1";

/** F5 — mirrors `ConfirmedArrangements` in documentation/api/planning-core.openapi.yaml. */
export interface ConfirmedArrangements {
  id: string;
  reference: string | null;
  status: EventStatus;
  previousStatus: EventStatus;
  confirmedBy: string;
  confirmedAt: string;
}

/** F5 — what an `ARRANGEMENTS_NOT_READY` refusal lists under `details`. */
export type VenueOutstanding =
  | { kind: "NO_CONFIRMED_BOOKING" }
  | { kind: "HOLD" | "PENDING_REQUEST"; reference: string; venueName: string };

export type EquipmentOutstanding =
  | { kind: "NONE_REQUESTED" }
  | {
      kind: "LINE";
      lineId: string;
      equipmentTypeName: string;
      quantity: number;
      status: LineStatus;
      requestedQuantity: number | null;
      reservedQuantity: number | null;
    };

export interface FlagOutstanding {
  arrangement: "BOOKING" | "HOLD" | "BOOKING_REQUEST" | "EQUIPMENT_LINE";
  reference: string;
  name: string;
  flag: "REQUIRES_RECONFIRMATION" | "UNSUITABLE" | "FLAGGED_FOR_REVIEW";
}

/** F5 — the assigned coordinator confirms the venue and equipment; the event moves to Safety Review. */
export function confirmArrangements(token: string, eventId: string) {
  return request<{ event: ConfirmedArrangements }>(`${EVENT}/events/${eventId}/confirmation`, { method: "POST", token });
}
