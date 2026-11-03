import { ROOT_CONTEXT, trace, type Context, type SpanContext } from "@opentelemetry/api";

/**
 * W3C Trace Context helpers (https://www.w3.org/TR/trace-context/). The
 * `traceparent` is the one string that crosses a process boundary, in an HTTP
 * header or a Kafka message header, so these are plain functions over strings
 * and need no registered propagator.
 */

const TRACEPARENT = /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/;

/** The header's span context, or null when it is missing, malformed or has an all-zero id. */
export function parseTraceparent(value: string | null | undefined): SpanContext | null {
  const match = TRACEPARENT.exec((value ?? "").trim());
  if (!match) return null;
  const [, traceId, spanId, flags] = match as unknown as [string, string, string, string];
  const context: SpanContext = { traceId, spanId, traceFlags: parseInt(flags, 16), isRemote: true };
  return trace.isSpanContextValid(context) ? context : null;
}

/** `00-<trace id>-<span id>-<flags>`. Only the sampled bit is carried, as the specification requires. */
export function formatTraceparent(spanContext: SpanContext): string {
  const flags = (spanContext.traceFlags & 1).toString(16).padStart(2, "0");
  return `00-${spanContext.traceId}-${spanContext.spanId}-${flags}`;
}

/** The context a remote parent gives: `base` with that parent set, or `base` itself when the header is unusable. */
export function contextFromTraceparent(value: string | null | undefined, base: Context = ROOT_CONTEXT): Context {
  const spanContext = parseTraceparent(value);
  return spanContext ? trace.setSpanContext(base, spanContext) : base;
}

/** The active span's context, only if it is a real one. */
export function activeSpanContext(): SpanContext | undefined {
  const spanContext = trace.getActiveSpan()?.spanContext();
  return spanContext && trace.isSpanContextValid(spanContext) ? spanContext : undefined;
}

/** The trace id of the request or message being handled: the correlation id (ADR-0013). */
export function activeTraceId(): string | undefined {
  return activeSpanContext()?.traceId;
}

export function activeTraceparent(): string | undefined {
  const spanContext = activeSpanContext();
  return spanContext ? formatTraceparent(spanContext) : undefined;
}

export interface TraceFields {
  traceId?: string;
  spanId?: string;
}

/** What a log line adds so Loki and Tempo can be joined on it. Empty when no span is active. */
export function traceFields(): TraceFields {
  const spanContext = activeSpanContext();
  return spanContext ? { traceId: spanContext.traceId, spanId: spanContext.spanId } : {};
}

/**
 * A log line's fields with the active trace on them. `correlationId` is filled
 * from the trace id when the caller gave none, because the two are the same
 * thing (ADR-0013); an id the caller did give is kept.
 */
export function withTraceFields<T extends { correlationId?: string | null }>(fields: T): T & TraceFields {
  const fromTrace = traceFields();
  if (!fromTrace.traceId) return fields;
  return { ...fields, ...fromTrace, correlationId: fields.correlationId ?? fromTrace.traceId };
}
