import { randomBytes } from "node:crypto";
import { activeTraceparent } from "@connectsphere/telemetry";

/**
 * The W3C Trace Context `traceparent` every message carries (implementation.md
 * §3.3): the span active when the outbox row is written, so the message belongs
 * to the trace of the request that caused it (ADR-0013, EN-08). With no active
 * span (the SDK is off, or a job with no request) it is a new random one, as it
 * was before the SDK existed, so a message always has a valid one.
 */
export function newTraceparent(): string {
  return activeTraceparent() ?? `00-${randomBytes(16).toString("hex")}-${randomBytes(8).toString("hex")}-01`;
}
