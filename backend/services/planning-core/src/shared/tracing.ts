import { randomBytes } from "node:crypto";

/**
 * A new W3C Trace Context `traceparent` (version 00, sampled). Every message
 * carries one (implementation.md §3.3). Until ADR-0013's OpenTelemetry SDK is
 * wired in, each request starts its own trace; the SDK will then supply the
 * active span's instead.
 */
export function newTraceparent(): string {
  return `00-${randomBytes(16).toString("hex")}-${randomBytes(8).toString("hex")}-01`;
}
