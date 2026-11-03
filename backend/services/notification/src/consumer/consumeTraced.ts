import { withConsumerSpan } from "@connectsphere/telemetry";
import { handleMessage, type HandlerDeps, type IncomingMessage, type Outcome } from "./handleMessage.js";
import { toIncoming } from "./kafkaMessages.js";

/** The parts of a kafkajs message (and where it came from) the consumer span records. */
export interface ConsumedKafkaMessage {
  topic: string;
  partition: number;
  /** The consumer group, e.g. connectsphere.notification.event-notifier. */
  group: string;
  message: Parameters<typeof toIncoming>[1] & { offset?: string; timestamp?: string };
}

/**
 * Handles one Kafka message inside a CONSUMER span that is a child of the span
 * in the message's `traceparent` header, so the notification it stores belongs to
 * the trace of the request that caused it (EN-08, ADR-0013). The outcome (stored,
 * duplicate, ignored, retried, dead-lettered) is the span's `connectsphere.outcome`.
 */
export async function consumeTraced(
  { topic, partition, group, message }: ConsumedKafkaMessage,
  deps: HandlerDeps,
  /** Runs inside the span, so what it logs carries the trace id. */
  afterHandling?: (outcome: Outcome, incoming: IncomingMessage) => void,
): Promise<Outcome> {
  const incoming = toIncoming(topic, message);
  const outcome = await withConsumerSpan(
    {
      topic,
      group,
      partition,
      offset: message.offset,
      timestamp: message.timestamp,
      key: incoming.key,
      headers: incoming.headers,
      value: incoming.value,
    },
    async () => {
      const outcome = await handleMessage(incoming, deps);
      afterHandling?.(outcome, incoming);
      return outcome;
    },
    (result) => result.outcome,
  );
  return outcome;
}
