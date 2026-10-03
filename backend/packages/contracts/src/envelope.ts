import { z } from "zod";
import { ROLES } from "./accessScope.js";

/**
 * The envelope used before CloudEvents. Superseded by cloudEvent.ts (ADR-0008,
 * implementation.md §3.3), but the event module's outbox writer still produces
 * it, so it stays until that writer and the relay move to CloudEvents (EN-04.2).
 * Rows already written in this shape must be converted when published.
 */

export const AGGREGATE_TYPES = [
  "EVENT",
  "BOOKING",
  "HOLD",
  "RESERVATION",
  "REGISTRATION",
  "NOTIFICATION",
] as const;

export type AggregateType = (typeof AGGREGATE_TYPES)[number];

export const ACTOR_ROLES = [...ROLES, "SYSTEM"] as const;

export const envelopeSchema = z.object({
  messageId: z.string().uuid(),
  messageType: z.string().min(1),
  schemaVersion: z.number().int().positive(),
  occurredAt: z.string().datetime(),
  producer: z.string().min(1),
  correlationId: z.string().nullable(),
  causationId: z.string().nullable(),
  actor: z.object({
    userId: z.string().uuid().nullable(),
    role: z.enum(ACTOR_ROLES),
  }),
  aggregate: z.object({
    type: z.enum(AGGREGATE_TYPES),
    id: z.string().uuid(),
  }),
  payload: z.record(z.unknown()),
});

export type Envelope = z.infer<typeof envelopeSchema>;
