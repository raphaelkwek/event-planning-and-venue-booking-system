/**
 * L6 — which venue-booking messages start or reset a hold's HoldExpiry
 * workflow (ADR-0009). Pure: the consumer parses the message, asks this, and
 * signal-with-starts the workflow it names.
 */

/** One workflow per hold, so a second start for the same hold finds the first. */
export function holdExpiryWorkflowId(holdId: string): string {
  return `hold-expiry-${holdId}`;
}

/** The parts of a parsed venue-booking message (contracts' parseCloudEvent) this reads. */
export interface HoldMessage {
  type: string;
  data: Record<string, unknown>;
}

export interface HoldExpirySchedule {
  holdId: string;
  expiresAt: string;
  /** Null when the message doesn't carry it (an expiry change); the workflow then asks the database. */
  reminderLeadMinutes: number | null;
}

/**
 * A placed hold starts its timer; a changed expiry resets it (signal-with-start
 * is safe even if the run has ended). Every other message is none of the
 * workflow's business.
 */
export function holdExpiryScheduleFor(message: HoldMessage): HoldExpirySchedule | null {
  const { data } = message;
  if (typeof data.holdId !== "string" || typeof data.expiresAt !== "string") return null;
  if (message.type === "venue-booking.hold-placed" && typeof data.reminderLeadMinutes === "number") {
    return { holdId: data.holdId, expiresAt: data.expiresAt, reminderLeadMinutes: data.reminderLeadMinutes };
  }
  if (message.type === "venue-booking.hold-expiry-changed") {
    return { holdId: data.holdId, expiresAt: data.expiresAt, reminderLeadMinutes: null };
  }
  return null;
}
