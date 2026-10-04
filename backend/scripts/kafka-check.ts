#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { Kafka, logLevel } from "kafkajs";
import { KAFKA_TOPICS, TOPICS_BEFORE_CUTOVER } from "@connectsphere/contracts";
import { parse } from "dotenv";
import { toClientConfig, redact, KafkaConfigError } from "@connectsphere/kafka";

// npm run kafka:check — proves this laptop can reach the team's Kafka cluster
// (SPM-113). It reads only the KAFKA_* block of .env, connects, lists the
// topics and compares them with KAFKA_TOPICS: the ones in TOPICS_BEFORE_CUTOVER
// must exist now, the rest from the cutover to Confluent. It never prints a
// credential.

/** Only the KAFKA_* lines of .env: no other secret is ever loaded. */
function kafkaVarsFrom(dotenvText: string): Record<string, string> {
  return Object.fromEntries(Object.entries(parse(dotenvText)).filter(([name]) => name.startsWith("KAFKA_")));
}

let vars: Record<string, string> = {};
try {
  vars = kafkaVarsFrom(readFileSync(".env", "utf8"));
} catch {
  console.error("No .env in this folder. Run this from the repo root, after copying .env.example to .env.");
  process.exit(1);
}

async function main() {
  const config = toClientConfig(vars);
  console.log(`Brokers:   ${config.brokers.join(", ")}`);
  console.log(`Auth:      SASL ${config.sasl.mechanism} over TLS`);
  console.log(`CA:        ${config.ssl === true ? "system trusted CAs" : "KAFKA_SSL_CA_PATH"}`);

  const kafka = new Kafka({
    clientId: "connectsphere-kafka-check",
    ...config,
    connectionTimeout: 10_000,
    retry: { retries: 2 },
    logLevel: logLevel.NOTHING,
  });
  const admin = kafka.admin();
  await admin.connect();
  try {
    const topics = new Set(await admin.listTopics());
    const expected: string[] = Object.values(KAFKA_TOPICS);
    const required: string[] = [...TOPICS_BEFORE_CUTOVER];
    const missing = required.filter((topic) => !topics.has(topic));
    const others = [...topics].filter((topic) => !expected.includes(topic) && !topic.startsWith("_"));

    console.log("\nConnected.");
    for (const topic of expected) {
      const state = topics.has(topic) ? "ok     " : required.includes(topic) ? "MISSING" : "cutover";
      console.log(`  ${state} ${topic}`);
    }
    for (const topic of others) console.log(`  extra   ${topic}`);

    if (!vars.KAFKA_GROUP_SUFFIX?.trim()) {
      console.log(
        "\nNote: KAFKA_GROUP_SUFFIX is empty. Set it to dev-<your initials> before running a consumer\n" +
          "on this laptop, or you will share a consumer group with the deployed service.",
      );
    }

    if (missing.length > 0) {
      console.error(`\n${missing.length} topic(s) the code publishes to do not exist on the cluster.`);
      process.exitCode = 1;
    }
  } finally {
    await admin.disconnect();
  }
}

main().catch((error: unknown) => {
  if (error instanceof KafkaConfigError) {
    console.error(error.message);
  } else {
    const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    console.error(`\nCould not connect: ${redact(message, vars)}`);
    console.error(
      "Check the brokers, credentials and CA path in .env. An Aiven free service powers off after\n" +
        "24 hours without traffic; if it shows Powered off in the console, power it on and retry.",
    );
  }
  process.exit(1);
});
