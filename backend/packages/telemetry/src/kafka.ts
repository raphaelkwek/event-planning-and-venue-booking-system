import { context, ROOT_CONTEXT, SpanKind, SpanStatusCode, trace, type Span } from "@opentelemetry/api";
import { instruments } from "./instruments.js";
import { contextFromTraceparent, formatTraceparent, parseTraceparent } from "./traceContext.js";

/**
 * Trace context through Kafka (ADR-0013, implementation.md §3.3).
 *
 * The producer side gives every message its own PRODUCER span and puts that
 * span's W3C `traceparent` in the message's headers. The consumer side makes
 * the span of handling it a child of the span in the header. So one trace runs
 * from the HTTP request that wrote the outbox row, through the relay's publish,
 * into the service that consumed it. These are small wrappers around kafkajs
 * calls rather than a patch of kafkajs, because the relay publishes a batch whose
 * messages belong to different traces, which a patch of `producer.send` cannot see.
 */

export const TRACEPARENT_HEADER = "traceparent";

const TRACER_NAME = "connectsphere.kafka";

/** The part of a message the producer helper reads and rewrites. */
export interface TraceableMessage {
  headers: Record<string, string>;
}

function failSpan(span: Span, error: unknown): void {
  const err = error instanceof Error ? error : new Error(String(error));
  span.recordException(err);
  span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
  span.setAttribute("error.type", err.name);
}

export interface PublishOptions {
  /**
   * Each message continues the trace in its own `traceparent` header (the outbox
   * relay: the header was written when the originating request committed). Without
   * it the spans are children of whichever span is active (a consumer's retry).
   */
  continueFromHeader?: boolean;
}

/**
 * Runs `send` with every message's `traceparent` header set to its own
 * PRODUCER span, then ends the spans when `send` settles. A failed send marks
 * them all failed and rethrows.
 */
export async function withProducerSpans<M extends TraceableMessage>(
  topic: string,
  messages: M[],
  send: (messages: M[]) => Promise<void>,
  options: PublishOptions = {},
): Promise<void> {
  const tracer = trace.getTracer(TRACER_NAME);
  const spans: Span[] = [];
  const traced = messages.map((message) => {
    const parent = options.continueFromHeader ? contextFromTraceparent(message.headers[TRACEPARENT_HEADER]) : context.active();
    const span = tracer.startSpan(
      `${topic} publish`,
      { kind: SpanKind.PRODUCER, attributes: { "messaging.system": "kafka", "messaging.destination.name": topic, "messaging.operation.type": "publish" } },
      parent,
    );
    spans.push(span);
    const spanContext = span.spanContext();
    return trace.isSpanContextValid(spanContext)
      ? { ...message, headers: { ...message.headers, [TRACEPARENT_HEADER]: formatTraceparent(spanContext) } }
      : message;
  });

  const { kafkaPublished } = instruments();
  try {
    await send(traced);
    kafkaPublished.add(messages.length, { topic, result: "ok" });
  } catch (error) {
    spans.forEach((span) => failSpan(span, error));
    kafkaPublished.add(messages.length, { topic, result: "error" });
    throw error;
  } finally {
    spans.forEach((span) => span.end());
  }
}

/** kafkajs hands header values as Buffers, strings or arrays of either; the handlers want plain strings. */
export function kafkaHeaders(raw: Record<string, Buffer | string | Array<Buffer | string> | undefined> | undefined): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const [name, value] of Object.entries(raw ?? {})) {
    if (value === undefined) continue;
    headers[name] = Array.isArray(value) ? value.map(String).join(",") : value.toString();
  }
  return headers;
}

export interface ConsumedMessage {
  topic: string;
  /** The consumer group, e.g. connectsphere.notification.event-notifier. */
  group: string;
  partition?: number;
  offset?: string;
  key: string | null;
  /** kafkajs's `message.timestamp`: when the broker appended it, in ms since the epoch, as a string. */
  timestamp?: string;
  headers: Record<string, string>;
  value: string | null;
}

/**
 * Where a message's trace comes from: the `traceparent` header the publisher
 * set, else the CloudEvent's own `traceparent` attribute (a message produced
 * before this header existed), else nothing, and the message starts a new trace.
 */
export function incomingTraceparent(message: Pick<ConsumedMessage, "headers" | "value">): string | undefined {
  const fromHeader = message.headers[TRACEPARENT_HEADER];
  if (parseTraceparent(fromHeader)) return fromHeader;
  try {
    const attribute = (JSON.parse(message.value ?? "") as { traceparent?: unknown } | null)?.traceparent;
    return typeof attribute === "string" && parseTraceparent(attribute) ? attribute : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Handles one consumed message inside a CONSUMER span that is a child of the
 * producer's, so the queries and publishes it makes are in the same trace.
 * `classify` names what happened ("stored", "duplicate", "retried"...) for the
 * span and for `kafka_consumer_processing_duration_seconds`.
 */
export async function withConsumerSpan<T>(
  message: ConsumedMessage,
  handle: () => Promise<T>,
  classify: (result: T) => string = () => "ok",
): Promise<T> {
  const parent = contextFromTraceparent(incomingTraceparent(message), ROOT_CONTEXT);
  const span = trace.getTracer(TRACER_NAME).startSpan(
    `${message.topic} process`,
    {
      kind: SpanKind.CONSUMER,
      attributes: {
        "messaging.system": "kafka",
        "messaging.destination.name": message.topic,
        "messaging.operation.type": "process",
        "messaging.consumer.group.name": message.group,
        ...(message.partition !== undefined ? { "messaging.destination.partition.id": String(message.partition) } : {}),
        ...(message.offset !== undefined ? { "messaging.kafka.offset": Number(message.offset) } : {}),
        ...(message.key ? { "messaging.kafka.message.key": message.key } : {}),
      },
    },
    parent,
  );

  const { kafkaProcessing, kafkaLag } = instruments();
  const startedAt = Date.now();
  const appendedAt = Number(message.timestamp);
  if (Number.isFinite(appendedAt) && appendedAt > 0) {
    kafkaLag.record(Math.max(0, startedAt - appendedAt) / 1000, { topic: message.topic, group: message.group });
  }

  const labels = (outcome: string) => ({ topic: message.topic, group: message.group, outcome });
  try {
    const result = await context.with(trace.setSpan(parent, span), handle);
    const outcome = classify(result);
    span.setAttribute("connectsphere.outcome", outcome);
    kafkaProcessing.record((Date.now() - startedAt) / 1000, labels(outcome));
    return result;
  } catch (error) {
    failSpan(span, error);
    kafkaProcessing.record((Date.now() - startedAt) / 1000, labels("error"));
    throw error;
  } finally {
    span.end();
  }
}
