import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import type { Delivery } from "./relay/deliver-outbox.js";

export type { Delivery };

const run = promisify(execFile);
const require = createRequire(import.meta.url);
const TSX_CLI = require.resolve("tsx/cli");
const SCRIPT = fileURLToPath(new URL("./relay/deliver-outbox.ts", import.meta.url));
const ROOT = fileURLToPath(new URL("../../../", import.meta.url));

export interface DeliverOptions {
  /** Only the messages of these types (and none a consumer writes in turn, unless named too). */
  types?: string[];
  /** The consumers to hand them to. The notification service's, unless said otherwise. */
  to?: Array<"notification" | "registration">;
}

/**
 * Delivers what one event's actions left in the outboxes to the consumers, as Kafka would
 * (relay/deliver-outbox.ts explains how), and returns each delivery and its outcome. CI's browser
 * stack runs without Kafka, so a journey whose card ends on a notification calls this after the
 * action and before it opens Notifications. A journey cites it in its card's Remarks.
 */
export async function deliverOutbox(eventId: string, options: DeliverOptions = {}): Promise<Delivery[]> {
  const { stdout } = await run(process.execPath, [TSX_CLI, SCRIPT, JSON.stringify({ eventId, ...options })], {
    cwd: ROOT,
    env: process.env,
    timeout: 60_000,
    maxBuffer: 4 * 1024 * 1024,
  });
  const last = stdout.trim().split("\n").pop() ?? "[]";
  return JSON.parse(last) as Delivery[];
}
