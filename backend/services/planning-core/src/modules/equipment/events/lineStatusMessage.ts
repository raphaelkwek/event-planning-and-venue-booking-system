import { KAFKA_TOPICS } from "@connectsphere/contracts";
import type { RequestLine } from "../repo/requestLines.js";
import type { OutboxMessage } from "./outbox.js";

/**
 * O2 and Q1: every change to a line's status tells the event's assigned
 * coordinator, through one message shape the notification service already reads.
 */
export function lineStatusChangedMessage(input: {
  event: { id: string; name: string; assignedCoordinatorId: string };
  previous: RequestLine;
  updated: RequestLine;
  actor: OutboxMessage["actor"];
  correlationId: string | null;
  /** Q2: the line's reservation was released; the notice says so and carries the release reason. */
  release?: { reason: string };
}): OutboxMessage {
  const { event, previous, updated, actor } = input;
  // Q1 only: a Reserved line says how many were reserved, which can be fewer than requested. O2's messages stay as they were.
  const reservedQuantity = updated.status === "RESERVED" ? updated.reservation?.reservedQuantity : undefined;
  return {
    topic: KAFKA_TOPICS.equipmentRequest,
    messageType: "equipment-request.line-status-changed",
    aggregateId: updated.id,
    actor,
    correlationId: input.correlationId,
    payload: {
      eventId: event.id,
      eventReference: updated.eventReference,
      eventName: event.name,
      lineId: updated.id,
      coordinatorId: event.assignedCoordinatorId,
      equipmentTypeName: updated.equipmentTypeName,
      quantity: updated.quantity,
      ...(reservedQuantity === undefined ? {} : { reservedQuantity }),
      previousStatus: previous.status,
      newStatus: updated.status,
      ...(input.release ? { released: true } : {}),
      reason: input.release ? input.release.reason : updated.unavailableReason,
      substituteEquipmentTypeName: updated.substituteEquipmentTypeName,
      substituteQuantity: updated.substituteQuantity,
      changedBy: actor.userId,
      changedAt: updated.statusChangedAt,
    },
  };
}
