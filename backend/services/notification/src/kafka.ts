import { createKafka, kafkaSettingsFromEnv, probeFor } from "@connectsphere/kafka";
import { logger } from "./logger.js";

/**
 * The service's Kafka client, built once from the KAFKA_* variables by the
 * shared @connectsphere/kafka package. Null without them: the service then
 * serves its health endpoints but consumes nothing, and /readyz says so.
 */
export const kafka = createKafka(kafkaSettingsFromEnv(process.env), { clientId: "notification", log: logger });
export const probeBroker = probeFor(kafka);
