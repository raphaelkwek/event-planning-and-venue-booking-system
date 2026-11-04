/**
 * Stands in for Kafka in the browser tests' stack (EN-14), for the journeys whose last step is a
 * notification or another service's reaction to a message.
 *
 * CI's browser stack runs without Kafka on purpose (tests/playwright.config.ts), so every message a
 * journey causes waits in its service's outbox. This script does what the outbox relay and the
 * consumers would do with those messages, with the services' own code:
 *   1. reads the unpublished rows about one event from every outbox (planning-core's event, venue,
 *      equipment and change outboxes, and the registration service's);
 *   2. turns each into the Kafka message the relay would send, with the relay's own `prepareRow`;
 *   3. hands that message to the consumers that subscribe to its topic: the notification service's
 *      `handleMessage`, and, when asked, the registration service's seat builder and listing handler;
 *   4. repeats, so a message a consumer writes in turn (the registration service's own outbox) is
 *      delivered as well.
 * Only the transport is skipped. The consumers' inboxes still drop a message they have handled.
 *
 * It runs as its own process, under tsx like the services themselves, so the services' modules
 * resolve exactly as they do when the stack runs them. tests/e2e/support/deliver.ts calls it.
 *
 * Usage: npx tsx tests/e2e/support/relay/deliver-outbox.ts '<json>'
 *   json: { "eventId": "<uuid>", "types"?: ["event.cancelled", ...], "to"?: ["notification", "registration"] }
 * Prints one JSON line: the deliveries made, each with its outbox, message type and outcome.
 */
import { randomBytes } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import postgres from "postgres";

type Consumer = "notification" | "registration";

interface Options {
  eventId: string;
  types?: string[];
  to?: Consumer[];
}

interface Row {
  id: string;
  topic: string;
  message_key: string;
  envelope: { type?: string } & Record<string, unknown>;
  outbox: string;
}

interface Prepared {
  topic: string;
  key: string;
  value: string;
  headers: Record<string, string>;
}

export interface Delivery {
  outbox: string;
  type: string;
  consumer: string;
  outcome: string;
  /** Why the notification consumer retried or dead-lettered the message (its error header), when it did. */
  error?: string;
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const PLANNING_CORE_OUTBOXES = ["event.outbox", "venue.outbox", "equipment.outbox", "change.outbox"];
const REGISTRATION_OUTBOX = "registration.outbox";
/** A consumer that writes messages of its own is followed this many rounds, which is far more than any chain needs. */
const MAX_ROUNDS = 5;

/** Imported by path at run time, so the browser tests' typecheck does not compile the services. */
const load = (path: string) => import(pathToFileURL(join(ROOT, path)).href);

function assertThrowawayDatabase(url: string | undefined): string {
  if (!url || !/^postgres(ql)?:\/\/[^@]*@(127\.0\.0\.1|localhost)(:\d+)?\//.test(url)) {
    throw new Error("DATABASE_URL must be this machine's throwaway Postgres; the relay stand-in never runs against a shared database");
  }
  return url;
}

const traceparent = () => `00-${randomBytes(16).toString("hex")}-${randomBytes(8).toString("hex")}-01`;

async function main() {
  const options = JSON.parse(process.argv[2] ?? "{}") as Options;
  if (!options.eventId) throw new Error("eventId is required");
  const to = new Set<Consumer>(options.to ?? ["notification"]);

  const [{ prepareRow: preparePlanningCoreRow }, { prepareRow: prepareRegistrationRow }, notification, seatBuilder, listings, { KAFKA_TOPICS }, { ERROR_HEADER }] =
    await Promise.all([
      load("backend/services/planning-core/src/shared/outbox/messages.ts"),
      load("backend/services/registration/src/outbox/messages.ts"),
      load("backend/services/notification/src/consumer/handleMessage.ts"),
      load("backend/services/registration/src/consumer/handleApproval.ts"),
      load("backend/services/registration/src/consumer/handleListing.ts"),
      load("backend/packages/contracts/src/index.ts"),
      load("backend/services/notification/src/domain/retryPolicy.ts"),
    ]);

  /** The topics each consumer subscribes to (each service's consumer/run.ts). */
  const NOTIFICATION_TOPICS = new Set<string>([KAFKA_TOPICS.event, KAFKA_TOPICS.equipmentRequest, KAFKA_TOPICS.venueBooking, KAFKA_TOPICS.registration]);

  const sql = postgres(assertThrowawayDatabase(process.env.DATABASE_URL), { max: 2, onnotice: () => undefined });
  const delivered = new Set<string>();
  const deliveries: Delivery[] = [];
  try {
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const rows: Row[] = [];
      for (const outbox of [...PLANNING_CORE_OUTBOXES, REGISTRATION_OUTBOX]) {
        const found = await sql<Row[]>`
          select id, topic, message_key, envelope, ${outbox} as outbox
          from ${sql(outbox)}
          where published_at is null
            and (message_key = ${options.eventId} or envelope->'data'->>'eventId' = ${options.eventId})
          order by seq
        `;
        rows.push(...found.filter((row) => !delivered.has(`${outbox}:${row.id}`)));
      }
      const wanted = rows.filter((row) => !options.types || options.types.includes(String(row.envelope.type)));
      for (const row of rows) delivered.add(`${row.outbox}:${row.id}`);
      if (wanted.length === 0) break;

      for (const row of wanted) {
        const message: Prepared =
          row.outbox === REGISTRATION_OUTBOX ? prepareRegistrationRow(row) : preparePlanningCoreRow(row, traceparent);
        const type = String(row.envelope.type);
        const record = (consumer: string, outcome: unknown) =>
          deliveries.push({ outbox: row.outbox, type, consumer, outcome: String((outcome as { outcome?: string }).outcome ?? outcome) });

        if (to.has("registration")) {
          if (message.topic === KAFKA_TOPICS.venueBooking && type === seatBuilder.APPROVED) {
            record("registration.seat-builder", await seatBuilder.handleMessage(message.value, { sql }));
          }
          if (message.topic === KAFKA_TOPICS.event && (type === listings.LISTING_CHANGED || type === listings.CANCELLED)) {
            record("registration.event-listings", await listings.handleListingMessage(message.value, { sql }));
          }
        }
        if (to.has("notification") && NOTIFICATION_TOPICS.has(message.topic)) {
          // A message the consumer retries or dead-letters goes to Kafka with the error in a header; keep it.
          let error: string | undefined;
          const outcome = await notification.handleMessage(
            { topic: message.topic, key: message.key, value: message.value, headers: message.headers },
            {
              sql,
              publish: async (_topic: string, sent: { headers: Record<string, string> }) => {
                error = sent.headers[ERROR_HEADER] ?? error;
              },
            },
          );
          record("notification", outcome);
          if (error) deliveries[deliveries.length - 1]!.error = error;
        }
      }
    }
  } finally {
    await sql.end();
  }
  process.stdout.write(`${JSON.stringify(deliveries)}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`);
  process.exit(1);
});
