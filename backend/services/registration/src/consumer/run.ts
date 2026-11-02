import type { Consumer, Kafka } from "kafkajs";
import type { Sql } from "postgres";
import { KAFKA_TOPICS } from "@connectsphere/contracts";
import { logger } from "../logger.js";
import { handleMessage } from "./handleApproval.js";
import { handleListingMessage } from "./handleListing.js";
import { consumerGroup } from "./kafkaMessages.js";

/**
 * The registration service's consumers (implementation.md §3.5):
 * - seat-builder reads connectsphere.venue-booking.v1 and builds an event's
 *   seats, and its venue for R1, from each approval (EN-13);
 * - event-listings reads connectsphere.event.v1 and keeps the service's copy
 *   of each event's published fields and registration settings, cancelling
 *   registrations when the event is cancelled (R1, R3).
 * Each commits a message's offset only after its handler returns, which is
 * after the handler's transaction commits. A group seen for the first time
 * starts at the newest message.
 */
export interface RunningConsumers {
  stop(): Promise<void>;
}

export async function startConsumers(kafka: Kafka, sql: Sql, groupSuffix: string): Promise<RunningConsumers> {
  const seatGroup = consumerGroup("seat-builder", groupSuffix);
  const listingGroup = consumerGroup("event-listings", groupSuffix);
  const seatBuilder = kafka.consumer({ groupId: seatGroup });
  const listings = kafka.consumer({ groupId: listingGroup });
  const all: Consumer[] = [seatBuilder, listings];

  try {
    await Promise.all(all.map((consumer) => consumer.connect()));
    await seatBuilder.subscribe({ topic: KAFKA_TOPICS.venueBooking, fromBeginning: false });
    await listings.subscribe({ topic: KAFKA_TOPICS.event, fromBeginning: false });
  } catch (error) {
    // Close whatever did connect, so the next attempt starts clean.
    await Promise.allSettled(all.map((consumer) => consumer.disconnect()));
    throw error;
  }

  await seatBuilder.run({
    eachMessage: async ({ topic, message }) => {
      const key = message.key ? message.key.toString() : null;
      const outcome = await handleMessage(message.value ? message.value.toString() : null, { sql });
      if (outcome.outcome === "built") logger.info("seats built", { topic, key, seats: outcome.seats, retired: outcome.retired, moved: outcome.moved });
      else if (outcome.outcome === "invalid") logger.error("message skipped: it failed validation", { topic, key, error: outcome.error });
      else if (outcome.outcome === "ignored" && outcome.reason === "no-layout-capacity") {
        logger.warn("approval skipped: it names no layout capacity, so no seats were built", { topic, key });
      }
    },
  });

  await listings.run({
    eachMessage: async ({ topic, message }) => {
      const key = message.key ? message.key.toString() : null;
      const outcome = await handleListingMessage(message.value ? message.value.toString() : null, { sql });
      if (outcome.outcome === "applied") logger.info("event listing applied", { topic, key, stale: outcome.stale, cancelled: outcome.cancelled });
      else if (outcome.outcome === "invalid") logger.error("message skipped: it failed validation", { topic, key, error: outcome.error });
    },
  });

  logger.info("registration consumers started", { groups: [seatGroup, listingGroup] });

  return {
    async stop() {
      await Promise.allSettled(all.map((consumer) => consumer.disconnect()));
    },
  };
}
