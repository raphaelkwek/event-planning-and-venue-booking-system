import { request } from "./client.js";

/** I2: a venue's periods of unavailability, served by planning-core's venue module. */

const VENUE = "/venue/api/v1";

export type ReasonType = "MAINTENANCE" | "EQUIPMENT_FAILURE" | "RENOVATION" | "SAFETY" | "OTHER";

/** CR-02's reasons, in the order the form offers them. */
export const REASON_TYPES: readonly ReasonType[] = ["MAINTENANCE", "EQUIPMENT_FAILURE", "RENOVATION", "SAFETY", "OTHER"];

export interface Block {
  id: string;
  venueId: string;
  startsAt: string;
  endsAt: string;
  reasonType: ReasonType;
  description: string;
  status: "ACTIVE" | "REMOVED";
  createdBy: string;
  createdAt: string;
  removedBy: string | null;
  removedAt: string | null;
}

/** A booking, hold or pending request a block disrupts, with where the two overlap. */
export interface Disrupted {
  kind: "BOOKING" | "HOLD" | "REQUEST";
  reference: string;
  eventReference: string | null;
  overlapFrom: string;
  overlapUntil: string;
  /** I3: the event is Confirmed and this disrupts its confirmed booking, so it returns (or would return) to Planning. */
  returnsEventToPlanning: boolean;
}

export interface BlockInput {
  startsAt: string;
  endsAt: string;
  reasonType: ReasonType;
  description: string;
}

export function listBlocks(token: string, venueId: string) {
  return request<{ items: Block[] }>(`${VENUE}/venues/${venueId}/unavailability`, { token });
}

/** What a block over the period would disrupt. Records nothing. */
export function reviewBlock(token: string, venueId: string, startsAt: string, endsAt: string) {
  return request<{ items: Disrupted[] }>(
    `${VENUE}/venues/${venueId}/unavailability/impact?${new URLSearchParams({ startsAt, endsAt })}`,
    { token },
  );
}

export function recordBlock(token: string, venueId: string, body: BlockInput) {
  return request<{ block: Block; disrupted: Disrupted[] }>(`${VENUE}/venues/${venueId}/unavailability`, { method: "POST", token, body });
}

export function removeBlock(token: string, venueId: string, blockId: string) {
  return request<{ block: Block; cleared: unknown[] }>(`${VENUE}/venues/${venueId}/unavailability/${blockId}/remove`, {
    method: "POST",
    token,
  });
}
