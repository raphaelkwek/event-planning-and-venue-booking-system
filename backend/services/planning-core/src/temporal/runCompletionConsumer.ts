import type { Kafka } from "kafkajs";
import { KAFKA_TOPICS } from "@connectsphere/contracts";
import { logger } from "../shared/logger.js";
import { consumerGroup, handleCompletionMessage, type CompletionScheduler } from "./completionConsumer.js";

/**
 * EN-11 — runs the event-completion consumer on the event topic (§3.5). The
 * offset of a message is committed only after its handler returns, so a
 * message whose scheduling threw (Temporal unreachable) is delivered again.
 * A group seen for the first time starts at the newest message: events
 * confirmed before the worker existed are left to `npm run jobs:complete-events`.
 */
export async function startCompletionConsumer(
  kafka: Kafka,
  scheduler: CompletionScheduler,
  groupSuffix: string
): Promise<{ stop(): Promise<void> }> {
  const groupId = consumerGroup(groupSuffix);
  const consumer = kafka.consumer({ groupId });
  try {
    await consumer.connect();
    await consumer.subscribe({ topic: KAFKA_TOPICS.event, fromBeginning: false });
  } catch (error) {
    await consumer.disconnect().catch(() => {});
    throw error;
  }

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      const key = message.key?.toString() ?? null;
      const outcome = await handleCompletionMessage(message.value?.toString() ?? null, scheduler);
      if (outcome.outcome === "scheduled") logger.info("event completion scheduled", { topic, key, eventId: outcome.eventId });
      else if (outcome.outcome === "invalid") logger.error("event message skipped: it failed validation", { topic, key, error: outcome.error });
    },
  });

  logger.info("event-completion consumer started", { groupId });
  return { stop: () => consumer.disconnect() };
}
