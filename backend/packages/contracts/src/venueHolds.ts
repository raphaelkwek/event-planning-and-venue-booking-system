/**
 * L3 — tentative holds (migration venue/0012). The event's assigned coordinator
 * requests one; Venue Staff of the venue place it, setting its expiry (the
 * customer's Week 9 answer, CQ-06). Placing takes the period in venue_slots.
 * L6 expires holds.
 */
export const HOLD_STATUSES = ["REQUESTED", "HELD", "CONVERTED", "RELEASED", "EXPIRED"] as const;
export type HoldStatus = (typeof HOLD_STATUSES)[number];

export const HOLD_STATUS_LABELS: Record<HoldStatus, string> = {
  REQUESTED: "Requested",
  HELD: "Held",
  CONVERTED: "Converted",
  RELEASED: "Released",
  EXPIRED: "Expired",
};
