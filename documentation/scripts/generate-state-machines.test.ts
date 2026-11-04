import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { EVENT_STATUSES } from "../../backend/packages/contracts/src/eventStatus.js";
import { readEdges, renderEventStatus } from "./generate-state-machines.js";

const REPO = fileURLToPath(new URL("../../", import.meta.url));
const SOURCE = readFileSync(join(REPO, "backend/services/planning-core/src/modules/event/domain/statusMachine.ts"), "utf8");

test("SM-T1 a multi-status row becomes one edge per source status, and shared edges merge their actions", () => {
  const edges = readEdges(`const TRANSITIONS: Record<A, R> = {
    APPROVE: { from: ["UNDER_REVIEW", "AWAITING_CLARIFICATION"], to: "APPROVED" },
    OK: { from: ["UNDER_REVIEW"], to: "APPROVED" },
};`);
  assert.deepEqual(edges, [
    { from: "UNDER_REVIEW", to: "APPROVED", actions: ["APPROVE", "OK"] },
    { from: "AWAITING_CLARIFICATION", to: "APPROVED", actions: ["APPROVE"] },
  ]);
});

test("SM-T2 the real status machine yields only statuses the contracts list, and reaches every one", () => {
  const edges = readEdges(SOURCE);
  const named = new Set(edges.flatMap((e) => [e.from, e.to]));
  for (const status of named) assert.ok((EVENT_STATUSES as readonly string[]).includes(status), `${status} is not an event status`);
  for (const status of EVENT_STATUSES) assert.ok(named.has(status), `${status} has no transition`);
});

test("SM-T3 the committed diagram is what the status machine generates", () => {
  const committed = readFileSync(join(REPO, "documentation/architecture/domain/event-status.puml"), "utf8");
  assert.equal(committed, renderEventStatus(readEdges(SOURCE)), "stale: run npm run diagrams:states");
});
