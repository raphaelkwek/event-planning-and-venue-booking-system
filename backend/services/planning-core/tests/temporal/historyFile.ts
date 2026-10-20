import { createRequire } from "node:module";

/**
 * EN-11 — how a recorded workflow history is written to disk and read back.
 *
 * Temporal's own `historyToJSON` fails here ("type must be a Type"): it builds
 * its type from a protobufjs copy nested under @temporalio/common. The proto
 * package's generated classes convert a history to a plain object and back
 * without it, and `Worker.runReplayHistory` replays the result.
 */
const { temporal } = createRequire(import.meta.url)("@temporalio/proto") as typeof import("@temporalio/proto");

export type History = temporal.api.history.v1.IHistory;

export function historyToText(history: History): string {
  const plain = temporal.api.history.v1.History.toObject(temporal.api.history.v1.History.fromObject(history), {
    longs: String,
    enums: String,
    bytes: String,
  });
  return `${JSON.stringify(plain, null, 2)}\n`;
}

export function historyFromText(text: string): temporal.api.history.v1.History {
  return temporal.api.history.v1.History.fromObject(JSON.parse(text));
}
