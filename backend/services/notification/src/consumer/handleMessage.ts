import type { Sql } from "postgres";
import { deadLetterTopic, parseCloudEvent, retryTopic } from "@connectsphere/contracts";
import { notificationsFor, type NewNotification } from "../domain/recipients.js";
import {
  ATTEMPT_HEADER,
  attemptOf,
  ERROR_HEADER,
  MAX_RETRIES,
  NOT_BEFORE_HEADER,
  ORIGINAL_TOPIC_HEADER,
  retryDelayMs,
} from "../domain/retryPolicy.js";

/**
 * What the notification consumer does with one Kafka message
 * (implementation.md §3.5). It never throws for a bad or failing message: the
 * message ends up stored, skipped, on the retry topic or on the dead-letter
 * topic, and the consumer commits its offset and moves on. It throws only if
 * it cannot reach Kafka to retry or dead-letter, and then the consumer tries
 * the message again.
 */

export const CONSUMER = "notification";
/** Recorded in the inbox, so a row says which consumer handled the message. */
export const INBOX_CONSUMER = "notification.event-notifier";
const RETRY_TOPIC = retryTopic(CONSUMER);
const DLQ_TOPIC = deadLetterTopic(CONSUMER);

export interface IncomingMessage {
  topic: string;
  key: string | null;
  value: string | null;
  headers: Record<string, string>;
}

export type OutgoingMessage = Omit<IncomingMessage, "topic">;

export interface HandlerDeps {
  sql: Sql;
  publish(topic: string, message: OutgoingMessage): Promise<void>;
  now?: () => number;
}

export type Outcome =
  | { outcome: "stored"; notifications: number }
  | { outcome: "duplicate" }
  | { outcome: "ignored" }
  | { outcome: "retried"; attempt: number }
  | { outcome: "dead-lettered" };

export async function handleMessage(message: IncomingMessage, deps: HandlerDeps): Promise<Outcome> {
  const originalTopic = message.headers[ORIGINAL_TOPIC_HEADER] ?? message.topic;

  let event;
  try {
    event = parseCloudEvent(JSON.parse(message.value ?? ""));
  } catch (error) {
    // Validation never succeeds on a retry, so it goes straight to the DLQ.
    await deadLetter(message, originalTopic, error, deps);
    return { outcome: "dead-lettered" };
  }

  const notifications = notificationsFor(event);
  if (notifications.length === 0) return { outcome: "ignored" };

  try {
    const stored = await store(deps.sql, event.id, event.time, notifications);
    return stored ? { outcome: "stored", notifications: notifications.length } : { outcome: "duplicate" };
  } catch (error) {
    const attempt = attemptOf(message.headers) + 1;
    if (attempt > MAX_RETRIES) {
      await deadLetter(message, originalTopic, error, deps);
      return { outcome: "dead-lettered" };
    }
    const now = (deps.now ?? Date.now)();
    await deps.publish(RETRY_TOPIC, {
      key: message.key,
      value: message.value,
      headers: {
        ...message.headers,
        [ATTEMPT_HEADER]: String(attempt),
        [NOT_BEFORE_HEADER]: String(now + retryDelayMs(attempt)),
        [ORIGINAL_TOPIC_HEADER]: originalTopic,
        [ERROR_HEADER]: errorText(error),
      },
    });
    return { outcome: "retried", attempt };
  }
}

/**
 * The inbox and the notifications in one transaction: the message id first,
 * so a duplicate (or a second consumer racing this one) finds the key taken
 * and stores nothing. Returns false for a duplicate.
 */
async function store(sql: Sql, messageId: string, occurredAt: string, notifications: NewNotification[]) {
  return sql.begin(async (tx) => {
    const claimed = await tx`
      insert into notification.consumed_messages (message_id, consumer)
      values (${messageId}, ${INBOX_CONSUMER})
      on conflict (message_id) do nothing
      returning message_id
    `;
    if (claimed.length === 0) return false;
    for (const n of notifications) {
      await tx`
        insert into notification.notifications
          (recipient_user_id, notification_type, event_id, event_reference, related_reference,
           message, source_message_id, occurred_at)
        values
          (${n.recipientUserId}, ${n.notificationType}, ${n.eventId}, ${n.eventReference}, ${n.relatedReference},
           ${n.message}, ${messageId}, ${occurredAt})
      `;
    }
    return true;
  });
}

/** The message, unchanged, on the dead-letter topic, with why and where it came from, for replay. */
function deadLetter(message: IncomingMessage, originalTopic: string, error: unknown, deps: HandlerDeps) {
  return deps.publish(DLQ_TOPIC, {
    key: message.key,
    value: message.value,
    headers: { ...message.headers, [ORIGINAL_TOPIC_HEADER]: originalTopic, [ERROR_HEADER]: errorText(error) },
  });
}

const errorText = (error: unknown) => String((error as Error)?.message ?? error).slice(0, 500);
