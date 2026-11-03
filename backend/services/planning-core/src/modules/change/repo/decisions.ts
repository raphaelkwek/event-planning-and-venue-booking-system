import type { TransactionSql } from "postgres";
import { KAFKA_TOPICS, SIGNIFICANT_EVENT_FIELDS, type ErrorField, type Role, type SignificantEventField } from "@connectsphere/contracts";
import { applyApprovedChange, checkProposedChange, findEventForChange, type ProposedChanges } from "../../event/index.js";
import { resolveAccessScope } from "../../identity/index.js";
import { cannotApproveMessage, isChangeable, proposedChanges, staleFields } from "../domain/changeRequests.js";
import { writeOutbox } from "../events/outbox.js";
import { flagArrangementsForChange, type AppliedChangeImpact } from "./changeImpact.js";
import { lockRequest, recordDecision, type ChangeRequestRecord } from "./changeRequests.js";

/**
 * S2 — the assigned coordinator's decision. The request is locked first, then the event, and
 * nothing is written until every check has passed; a refusal returns without having written
 * anything, so the caller's transaction commits an empty change.
 *
 * S3 — an approval also flags the arrangements the change affects and returns a Confirmed event
 * to Planning, in the same transaction: if flagging throws, the change, the decision and every
 * flag roll back together (AC11).
 */

export type Decision = { decision: "APPROVE" } | { decision: "REJECT"; reason: string };

/** The event's significant values after an approval. */
export type DecidedEvent = { id: string } & Partial<Record<SignificantEventField, unknown>>;

export type DecisionOutcome =
  | { ok: true; request: ChangeRequestRecord; event?: DecidedEvent; impact?: AppliedChangeImpact }
  | { ok: false; code: "NOT_FOUND" }
  | { ok: false; code: "NOT_ASSIGNED" }
  | { ok: false; code: "ALREADY_DECIDED"; status: "APPROVED" | "REJECTED"; decidedAt: string }
  | { ok: false; code: "NO_LONGER_VALID"; message: string; fields: ErrorField[]; status?: string };

/** The event module reports a proposed value on its own field name; the request names it under `changes`. */
const renamed = (problems: ErrorField[]): ErrorField[] =>
  problems.map((problem) => ({ field: `changes.${problem.field}`, message: problem.message }));

export async function decideChangeRequest(
  tx: TransactionSql,
  requestId: string,
  decision: Decision,
  actor: { userId: string; role: Role; correlationId?: string | null }
): Promise<DecisionOutcome> {
  const request = await lockRequest(tx, requestId);
  if (!request) return { ok: false, code: "NOT_FOUND" };
  if (request.status !== "PENDING") {
    // The check constraint gives every decided request a decision time.
    return { ok: false, code: "ALREADY_DECIDED", status: request.status, decidedAt: request.decidedAt! };
  }

  const scope = resolveAccessScope(actor.role, actor.userId, "events");
  const event = await findEventForChange(tx, request.eventId, scope, actor.userId, { lock: decision.decision === "APPROVE" ? "update" : "share" });
  if (!event) return { ok: false, code: "NOT_FOUND" };
  if (event.assignedCoordinatorId !== actor.userId) return { ok: false, code: "NOT_ASSIGNED" };

  const changes: ProposedChanges = proposedChanges(request.fields);

  // One instant for the decision and the history rows it writes.
  const at = new Date();
  let decided: ChangeRequestRecord;
  let applied: DecidedEvent | undefined;
  let impact: AppliedChangeImpact | undefined;
  if (decision.decision === "REJECT") {
    decided = await recordDecision(tx, request.id, { status: "REJECTED", actorId: actor.userId, reason: decision.reason, at });
  } else {
    if (!isChangeable(event.status)) {
      return { ok: false, code: "NO_LONGER_VALID", message: cannotApproveMessage(event.status), fields: [], status: event.status };
    }
    // D3 lets the organiser amend these fields while Awaiting Clarification, so the snapshot may be stale.
    const stale = staleFields(event.current, request.fields);
    if (stale.length > 0) {
      return {
        ok: false,
        code: "NO_LONGER_VALID",
        message: "The event changed after this request was made, so the change can't be approved. You can still reject it.",
        fields: stale,
      };
    }
    const problems = checkProposedChange(event.current, changes);
    if (problems.length > 0) {
      return {
        ok: false,
        code: "NO_LONGER_VALID",
        message: "The proposed values no longer pass the checks, so the change can't be approved. You can still reject it.",
        fields: renamed(problems),
      };
    }
    await applyApprovedChange(tx, event, changes, actor, at);
    impact = await flagArrangementsForChange(tx, { ...event, reference: request.eventReference }, request.id, changes, actor);
    decided = await recordDecision(tx, request.id, { status: "APPROVED", actorId: actor.userId, reason: null, at });
    const values: DecidedEvent = { id: event.id };
    for (const field of SIGNIFICANT_EVENT_FIELDS) values[field] = field in changes ? changes[field] : event.current[field];
    applied = values;
  }

  const common = {
    eventId: event.id,
    eventReference: request.eventReference,
    eventName: event.name,
    // The organiser who asked, which is the event's owner unless ownership has moved since.
    ownerId: request.requestedBy,
    changeRequestId: request.id,
    fields: request.fields.map((field) => field.fieldName),
    decidedBy: actor.userId,
    decidedAt: decided.decidedAt!,
  };
  await writeOutbox(tx, {
    topic: KAFKA_TOPICS.event,
    messageType: decision.decision === "APPROVE" ? "change-request.approved" : "change-request.rejected",
    aggregateId: event.id,
    actor,
    correlationId: actor.correlationId ?? null,
    payload: decision.decision === "APPROVE" ? common : { ...common, reason: decision.reason },
  });
  return applied ? { ok: true, request: decided, event: applied, impact } : { ok: true, request: decided };
}
