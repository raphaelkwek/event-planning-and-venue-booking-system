import type { Kafka } from "kafkajs";
import { KAFKA_TOPICS } from "@connectsphere/contracts";
import { logger } from "../shared/logger.js";
import { consumerGroup, handleHoldExpiryMessage, type HoldExpiryScheduler } from "./holdExpiryConsumer.js";

/**
 * L6 — runs the hold-expiry consumer on the venue-booking topic (§3.5). The
 * offset of a message is committed only after its handler returns. A group
 * seen for the first time starts at the newest message: holds placed before
 * the worker existed are left to `npm run jobs:schedule-hold-expiries`.
 */
export async function startHoldExpiryConsumer(
  kafka: Kafka,
  scheduler: HoldExpiryScheduler,
  groupSuffix: string
): Promise<{ stop(): Promise<void> }> {
  const groupId = consumerGroup(groupSuffix);
  const consumer = kafka.consumer({ groupId });
  try {
    await consumer.connect();
    await consumer.subscribe({ topic: KAFKA_TOPICS.venueBooking, fromBeginning: false });
  } catch (error) {
    await consumer.disconnect().catch(() => {});
    throw error;
  }

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      const key = message.key?.toString() ?? null;
      const outcome = await handleHoldExpiryMessage(message.value?.toString() ?? null, scheduler);
      if (outcome.outcome === "scheduled") logger.info("hold expiry scheduled", { topic, key, holdId: outcome.holdId });
      else if (outcome.outcome === "invalid") logger.error("venue-booking message skipped: it failed validation", { topic, key, error: outcome.error });
    },
  });

  logger.info("hold-expiry consumer started", { groupId });
  return { stop: () => consumer.disconnect() };
}
