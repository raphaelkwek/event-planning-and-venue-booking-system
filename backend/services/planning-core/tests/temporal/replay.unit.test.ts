import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Worker, type WorkflowBundleWithSourceMap } from "@temporalio/worker";
import { beforeAll, describe, expect, it } from "vitest";
import { bundleCompletionWorkflows } from "../../src/temporal/workflowBundle.js";
import { historyFromText, historyToText } from "./historyFile.js";

/**
 * EN-11-T3 — replays every committed CompleteEvent history against the current
 * workflow code. A change that makes a running workflow take a different path
 * fails here, in CI, before it can break one in flight. Never re-record a
 * history to make this pass: see scripts/record-workflow-histories.ts.
 */
const DIR = fileURLToPath(new URL("./histories/", import.meta.url));
const files = readdirSync(DIR).filter((name) => name.endsWith(".json")).sort();
const read = (name: string) => readFileSync(`${DIR}${name}`, "utf8");

let workflowBundle: WorkflowBundleWithSourceMap;
beforeAll(async () => {
  workflowBundle = await bundleCompletionWorkflows();
}, 60_000);

describe("CompleteEvent replay (EN-11-T3)", () => {
  it("has the four recorded baseline histories", () => {
    expect(files).toEqual([
      "complete-event-completes-at-end.json",
      "complete-event-not-due-then-completes.json",
      "complete-event-rescheduled-later.json",
      "complete-event-stops-when-cancelled.json",
    ]);
  });

  it.each(files)("replays %s deterministically", async (name) => {
    await expect(Worker.runReplayHistory({ workflowBundle }, historyFromText(read(name)), name)).resolves.toBeUndefined();
  }, 30_000);

  it("rejects a history the workflow would no longer produce", async () => {
    // Drop the timer from a recorded run: the workflow still starts one, which the history doesn't contain.
    const plain = JSON.parse(read("complete-event-completes-at-end.json")) as { events: { eventType: string }[] };
    plain.events = plain.events.filter((event) => !event.eventType.includes("TIMER"));
    await expect(Worker.runReplayHistory({ workflowBundle }, historyFromText(JSON.stringify(plain)), "drifted")).rejects.toThrow();
  }, 30_000);

  it("round-trips a history to the same text", () => {
    const text = read(files[0]!);
    expect(historyToText(historyFromText(text))).toBe(text);
  });
});
