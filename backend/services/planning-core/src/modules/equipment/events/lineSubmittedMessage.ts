import { KAFKA_TOPICS } from "@connectsphere/contracts";
import type { RequestLine } from "../repo/requestLines.js";
import type { OutboxMessage } from "./outbox.js";

/**
 * O1, team decision D-02 (clarifications.md): a coordinator saved a new line, which now waits for
 * Technical Support. One message per line, keyed by the line, naming every active Technical Support
 * Staff member to tell, with what the notice says: the event, the equipment, the quantity and when
 * it is needed.
 */
export function lineSubmittedMessage(input: {
  event: { id: string; name: string };
  line: RequestLine;
  technicalSupportIds: string[];
  actor: OutboxMessage["actor"];
  correlationId: string | null;
}): OutboxMessage {
  const { event, line } = input;
  return {
    topic: KAFKA_TOPICS.equipmentRequest,
    messageType: "equipment-request.line-submitted",
    aggregateId: line.id,
    actor: input.actor,
    correlationId: input.correlationId,
    payload: {
      eventId: event.id,
      eventReference: line.eventReference,
      eventName: event.name,
      lineId: line.id,
      equipmentTypeName: line.equipmentTypeName,
      quantity: line.quantity,
      requiredFrom: line.requiredFrom,
      requiredTo: line.requiredTo,
      requestedBy: line.requestedBy,
      requestedAt: line.requestedAt,
      technicalSupportIds: input.technicalSupportIds,
    },
  };
}
