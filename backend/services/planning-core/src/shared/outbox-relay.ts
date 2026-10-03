import type { Sql } from "postgres";
import { logger } from "./logger.js";
import { newTraceparent } from "./tracing.js";
import {
  backoffMs,
  groupByTopic,
  prepareRow,
  UnpublishableError,
  type OutboxRow,
  type PreparedMessage,
} from "./outbox/messages.js";

/**
 * The outbox relay (EN-04.2, implementation.md §3.4): publishes each module's
 * committed outbox rows to Kafka, then marks them published.
 *
 * Each pass, per outbox table, in one transaction:
 * 1. Take the table's relay lock (`pg_try_advisory_xact_lock`). If another
 *    relay holds it, skip the table this pass. One relay at a time per table
 *    keeps each aggregate's messages in order; SKIP LOCKED alone would let a
 *    second relay publish a later message while the first still holds an
 *    earlier one.
 * 2. Claim up to `batchSize` unpublished rows in write order (`seq`) with
 *    FOR UPDATE SKIP LOCKED, so no two relays ever take the same row.
 * 3. Set aside rows that can never publish, then publish the rest per topic.
 *    A topic that fails leaves its rows pending with `attempts` + 1 and
 *    `last_error`; the next pass retries them first.
 *
 * Publishing inside the transaction is deliberate: the row locks are what stop
 * a second relay taking the same rows. kafkajs's request timeout bounds how
 * long they are held.
 */

export interface OutboxPublisher {
  publish(topic: string, messages: Array<Pick<PreparedMessage, "key" | "value" | "headers">>): Promise<void>;
}

export interface PassResult {
  published: number;
  failed: number;
  parked: number;
  /** Tables another relay was working on during this pass. */
  busy: number;
}

export interface RelayOptions {
  sql: Sql;
  /** Schema-qualified outbox tables, e.g. "event.outbox", each from its module's index.ts. */
  tables: string[];
  publisher: OutboxPublisher;
  batchSize?: number;
  /** The wait between passes that find nothing to publish. */
  idleMs?: number;
}

/** last_error's prefix on a row set aside; the relay never selects it again (§3.4). */
export const UNPUBLISHABLE_PREFIX = "unpublishable: ";

const MAX_ERROR_LENGTH = 1000;

export class OutboxRelay {
  private readonly sql: Sql;
  private readonly tables: string[];
  private readonly publisher: OutboxPublisher;
  private readonly batchSize: number;
  private readonly idleMs: number;

  private running = false;
  private loop: Promise<void> | null = null;
  private wake: (() => void) | null = null;

  constructor(options: RelayOptions) {
    this.sql = options.sql;
    this.tables = options.tables;
    this.publisher = options.publisher;
    this.batchSize = options.batchSize ?? 100;
    this.idleMs = options.idleMs ?? 1000;
  }

  /** One pass over every outbox table. */
  async runOnce(): Promise<PassResult> {
    const total: PassResult = { published: 0, failed: 0, parked: 0, busy: 0 };
    for (const table of this.tables) {
      const result = await this.relayTable(table);
      total.published += result.published;
      total.failed += result.failed;
      total.parked += result.parked;
      total.busy += result.busy;
    }
    return total;
  }

  private relayTable(table: string): Promise<PassResult> {
    return this.sql.begin(async (tx) => {
      const result: PassResult = { published: 0, failed: 0, parked: 0, busy: 0 };

      const [lock] = await tx`select pg_try_advisory_xact_lock(hashtext(${`outbox-relay:${table}`})) as locked`;
      if (!lock!.locked) return { ...result, busy: 1 };

      const rows = await tx<OutboxRow[]>`
        select id, topic, message_key, envelope
        from ${tx(table)}
        where published_at is null
          and (last_error is null or last_error not like ${UNPUBLISHABLE_PREFIX + "%"})
        order by seq
        limit ${this.batchSize}
        for update skip locked
      `;

      const ready: PreparedMessage[] = [];
      for (const row of rows) {
        try {
          ready.push(prepareRow(row, newTraceparent));
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
          await this.publisher.publish(
            topic,
            messages.map(({ key, value, headers }) => ({ key, value, headers })),
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
        let delay = this.idleMs;
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

  /** Lets the pass in progress finish (its batch is published and marked), then stops. */
  async stop(): Promise<void> {
    this.running = false;
    this.wake?.();
    await this.loop;
    this.loop = null;
  }
}
