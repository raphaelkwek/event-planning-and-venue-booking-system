import { z } from "zod";
import { ROLES } from "./accessScope.js";
import { ACTOR_ROLES } from "./envelope.js";
import { EVENT_PAYLOAD_SCHEMAS } from "./eventEvents.js";

/**
 * The Kafka message envelope (ADR-0008, implementation.md §3.3): a CloudEvents
 * 1.0 structured-mode JSON event. Every producer writes exactly this shape and
 * every consumer validates against it, so an attribute outside the contract is
 * refused rather than ignored.
 *
 * Extensions:
 * - `correlationid`: the originating HTTP request's x-correlation-id,
 *   propagated unchanged. Absent when nothing user-facing started it.
 * - `traceparent`: the W3C Trace Context of the producing span (ADR-0013).
 * - `actor`: who caused the change, as `ROLE:userId`, or `SYSTEM`.
 *
 * `data` is the payload schema for the message's `type` (eventEvents.ts).
 */

export const CLOUDEVENTS_SPEC_VERSION = "1.0";

export type ActorRole = (typeof ACTOR_ROLES)[number];
export interface Actor {
  role: ActorRole;
  userId: string | null;
}

const uuid = z.string().uuid();

/**
 * CloudEvents extension values must be strings, not objects, so the actor
 * travels as one string. A user role always names its user; SYSTEM never does.
 */
export function parseActor(value: string): Actor {
  if (value === "SYSTEM") return { role: "SYSTEM", userId: null };
  const [role, userId, ...rest] = value.split(":");
  if (rest.length > 0 || role === "SYSTEM" || !(ROLES as readonly string[]).includes(role)) {
    throw new Error(`Not a valid actor: "${value}"`);
  }
  if (!uuid.safeParse(userId).success) throw new Error(`Actor "${role}" needs a user id`);
  return { role: role as ActorRole, userId };
}

export function formatActor(actor: Actor): string {
  if (actor.role === "SYSTEM") return "SYSTEM";
  if (!actor.userId) throw new Error(`Actor "${actor.role}" needs a user id`);
  return `${actor.role}:${actor.userId}`;
}

const isActor = (value: string) => {
  try {
    parseActor(value);
    return true;
  } catch {
    return false;
  }
};

/** version-traceid-parentid-flags; an all-zero trace or parent id is invalid. */
const TRACEPARENT = /^00-(?!0{32})[0-9a-f]{32}-(?!0{16})[0-9a-f]{16}-[0-9a-f]{2}$/;

/** `/connectsphere/<service>`, plus `/<module>` inside planning-core. */
const SOURCE = /^\/connectsphere\/[a-z][a-z0-9-]*(\/[a-z][a-z0-9-]*)?$/;

export const cloudEventSchema = z
  .object({
    specversion: z.literal(CLOUDEVENTS_SPEC_VERSION),
    /** Unique per message; consumers' inboxes deduplicate on it. */
    id: uuid,
    source: z.string().regex(SOURCE),
    /** The message type, e.g. `event.submitted`; it selects the data schema. */
    type: z.string().min(1),
    /** The aggregate's id, which is also the Kafka message key. */
    subject: uuid,
    /** When the state change committed: RFC 3339 UTC with milliseconds. */
    time: z.string().datetime({ precision: 3 }),
    datacontenttype: z.literal("application/json"),
    correlationid: z.string().min(1).optional(),
    traceparent: z.string().regex(TRACEPARENT),
    actor: z.string().refine(isActor, "actor must be ROLE:userId, or SYSTEM"),
    data: z.record(z.unknown()),
  })
  .strict();

export type CloudEvent = z.infer<typeof cloudEventSchema>;

/** The data schema for every message type that may be published. */
export const MESSAGE_DATA_SCHEMAS = { ...EVENT_PAYLOAD_SCHEMAS } as const;
export type MessageType = keyof typeof MESSAGE_DATA_SCHEMAS;

/** Validates a whole message: the envelope, then the data for its type. */
export function parseCloudEvent(message: unknown) {
  const envelope = cloudEventSchema.parse(message);
  const schema = MESSAGE_DATA_SCHEMAS[envelope.type as MessageType];
  if (!schema) throw new Error(`No data schema is known for message type "${envelope.type}"`);
  return { ...envelope, type: envelope.type as MessageType, data: schema.parse(envelope.data) };
}
