import { Partitioners, type Kafka } from "kafkajs";
import type { Sql } from "postgres";
import { withProducerSpans } from "@connectsphere/telemetry";
import { logger } from "../logger.js";
import { backoffMs, groupByTopic, prepareRow, UnpublishableError, type OutboxRow, type PreparedMessage } from "./messages.js";

/**
 * The registration service's outbox relay (implementation.md §3.4), the same
 * algorithm as planning-core's EN-04.2 relay. Each pass, in one transaction:
 * 1. take the table's relay lock (`pg_try_advisory_xact_lock`), or skip this
 *    pass if another relay holds it, which keeps each registration's messages
 *    in order;
 * 2. claim up to `batchSize` unpublished rows in `seq` order, FOR UPDATE SKIP
 *    LOCKED;
 * 3. set aside rows that can never publish, publish the rest per topic, and
 *    mark them published. A failed send leaves its rows pending with the
 *    attempt and the error, and the next pass retries them first.
 *
 * Publishing inside the transaction is deliberate (§3.4): the row locks are
 * what stop a second relay taking the same rows.
 */

export interface OutboxPublisher {
  publish(topic: string, messages: Array<Pick<PreparedMessage, "key" | "value" | "headers">>): Promise<void>;
}

export interface PassResult {
  published: number;
  failed: number;
  parked: number;
  busy: boolean;
}

/** last_error's prefix on a row set aside; the relay never selects it again (§3.4). */
export const UNPUBLISHABLE_PREFIX = "unpublishable: ";
const MAX_ERROR_LENGTH = 1000;

export class OutboxRelay {
  private running = false;
  private loop: Promise<void> | null = null;
  private wake: (() => void) | null = null;

  constructor(
    private readonly options: { sql: Sql; table: string; publisher: OutboxPublisher; batchSize?: number; idleMs?: number },
  ) {}

  private get batchSize() {
    return this.options.batchSize ?? 100;
  }

  /** One pass over the outbox. */
  runOnce(): Promise<PassResult> {
    const { sql, table, publisher } = this.options;
    return sql.begin(async (tx) => {
      const result: PassResult = { published: 0, failed: 0, parked: 0, busy: false };
      const [lock] = await tx`select pg_try_advisory_xact_lock(hashtext(${`outbox-relay:${table}`})) as locked`;
      if (!lock!.locked) return { ...result, busy: true };

      const rows = await tx<OutboxRow[]>`
        select id, topic, message_key, envelope from ${tx(table)}
        where published_at is null
          and (last_error is null or last_error not like ${UNPUBLISHABLE_PREFIX + "%"})
        order by seq
        limit ${this.batchSize}
        for update skip locked
      `;

      const ready: PreparedMessage[] = [];
      for (const row of rows) {
        try {
          ready.push(prepareRow(row));
        } catch (error) {
          if (!(error instanceof UnpublishableError)) throw error;
          await tx`
            update ${tx(table)}
            set attempts = attempts + 1, last_error = ${(UNPUBLISHABLE_PREFIX + error.message).slice(0, MAX_ERROR_LENGTH)}
            where id = ${row.id}
          `;
          result.parked += 1;
          logger.error("outbox row set aside: it can never be published", { table, rowId: row.id, reason: error.message });
        }
      }

      for (const [topic, messages] of groupByTopic(ready)) {
        const ids = messages.map((m) => m.rowId);
        try {
          // One PRODUCER span per message, a child of the transaction that wrote its row (the row's
          // traceparent), and the span's own traceparent in the Kafka header (EN-08, ADR-0013).
          await withProducerSpans(
            topic,
            messages.map(({ key, value, headers }) => ({ key, value, headers })),
            (traced) => publisher.publish(topic, traced),
            { continueFromHeader: true },
          );
          await tx`update ${tx(table)} set published_at = now() where id in ${tx(ids)}`;
          result.published += ids.length;
        } catch (error) {
          const message = (error as Error).message.slice(0, MAX_ERROR_LENGTH);
          await tx`update ${tx(table)} set attempts = attempts + 1, last_error = ${message} where id in ${tx(ids)}`;
          result.failed += ids.length;
          logger.warn("outbox publish failed; the rows stay pending", { table, topic, rows: ids.length, error: message });
        }
      }
      return result;
    });
  }

  /** Runs passes until stop(): again at once after a full batch, after `idleMs` when idle, backing off on failure. */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.loop = (async () => {
      let failures = 0;
      while (this.running) {
        let delay = this.options.idleMs ?? 1000;
        try {
          const result = await this.runOnce();
          failures = result.failed > 0 ? failures + 1 : 0;
          if (failures > 0) delay = backoffMs(failures);
          else if (result.published + result.parked >= this.batchSize) delay = 0;
        } catch (error) {
          failures += 1;
          delay = backoffMs(failures);
          logger.error("outbox relay pass failed", { error: (error as Error).message });
        }
        if (this.running && delay > 0) {
          await new Promise<void>((resolve) => {
            const timer = setTimeout(resolve, delay);
            this.wake = () => {
              clearTimeout(timer);
              resolve();
            };
          });
          this.wake = null;
        }
      }
    })();
  }

  /** Lets the pass in progress finish, then stops. */
  async stop(): Promise<void> {
    this.running = false;
    this.wake?.();
    await this.loop;
    this.loop = null;
  }
}

/**
 * Publishes the relay's messages: one request in flight at a time, so a retried
 * send cannot overtake the next; never creates a topic; and the Java-compatible
 * partitioner, so every client puts a registration on the same partition.
 */
export function kafkaPublisher(client: Kafka): OutboxPublisher & { disconnect(): Promise<void> } {
  const producer = client.producer({ allowAutoTopicCreation: false, maxInFlightRequests: 1, createPartitioner: Partitioners.DefaultPartitioner });
  let connected: Promise<void> | null = null;
  return {
    async publish(topic, messages) {
      connected ??= producer.connect().catch((error) => {
        connected = null;
        throw error;
      });
      await connected;
      await producer.send({ topic, messages, acks: -1 });
    },
    async disconnect() {
      if (connected) await producer.disconnect();
    },
  };
}
