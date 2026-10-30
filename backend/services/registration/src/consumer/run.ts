import type { Kafka } from "kafkajs";
import type { Sql } from "postgres";
import { KAFKA_TOPICS } from "@connectsphere/contracts";
import { logger } from "../logger.js";
import { handleMessage } from "./handleApproval.js";
import { consumerGroup } from "./kafkaMessages.js";

/**
 * The registration service's consumer (implementation.md §3.5): seat-builder
 * reads connectsphere.venue-booking.v1 and builds an event's seats from each
 * approval. It commits a message's offset only after handleMessage returns,
 * which is after the seats' transaction commits. A group seen for the first
 * time starts at the newest message: approvals confirmed before this service
 * existed carry no layout capacity anyway.
 */
export interface RunningConsumers {
  stop(): Promise<void>;
}

export async function startConsumers(kafka: Kafka, sql: Sql, groupSuffix: string): Promise<RunningConsumers> {
  const group = consumerGroup("seat-builder", groupSuffix);
  const seatBuilder = kafka.consumer({ groupId: group });

  try {
    await seatBuilder.connect();
    await seatBuilder.subscribe({ topic: KAFKA_TOPICS.venueBooking, fromBeginning: false });
  } catch (error) {
    // Close whatever did connect, so the next attempt starts clean.
    await Promise.allSettled([seatBuilder.disconnect()]);
    throw error;
  }

  await seatBuilder.run({
    eachMessage: async ({ topic, message }) => {
      const key = message.key ? message.key.toString() : null;
      const outcome = await handleMessage(message.value ? message.value.toString() : null, { sql });
      if (outcome.outcome === "built") logger.info("seats built", { topic, key, seats: outcome.seats, retired: outcome.retired });
      else if (outcome.outcome === "invalid") logger.error("message skipped: it failed validation", { topic, key, error: outcome.error });
      else if (outcome.outcome === "ignored" && outcome.reason === "no-layout-capacity") {
        logger.warn("approval skipped: it names no layout capacity, so no seats were built", { topic, key });
      }
    },
  });

  logger.info("registration consumers started", { groups: [group] });

  return {
    async stop() {
      await seatBuilder.disconnect();
    },
  };
}
