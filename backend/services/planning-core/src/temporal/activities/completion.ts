import type { CompletionAttempt } from "../../modules/event/index.js";

/**
 * EN-11 — the activities CompleteEvent calls. An activity is where a workflow's
 * side effects happen: here, the event module's completion rule, reached through
 * its index.ts (ADR-0004). The worker passes the real function; tests pass a fake.
 */
export interface CompletionActivities {
  completeEventIfDue(eventId: string): Promise<CompletionAttempt>;
}

export function createCompletionActivities(complete: (eventId: string) => Promise<CompletionAttempt>): CompletionActivities {
  return {
    completeEventIfDue: (eventId) => complete(eventId),
  };
}
