import { describe, expect, it } from "vitest";
import { equipmentLineSubmittedPayloadSchema, KAFKA_TOPICS } from "@connectsphere/contracts";
import { lineSubmittedMessage } from "../../../src/modules/equipment/events/lineSubmittedMessage.js";
import type { RequestLine } from "../../../src/modules/equipment/repo/requestLines.js";

/**
 * O1, team decision D-02: each line a coordinator saves raises one message, keyed by the line, that
 * names the Technical Support Staff to tell. What the message carries is what the notification
 * says: the event, the equipment, the quantity and when it is needed.
 */

const line: RequestLine = {
  id: "33333333-3333-4333-8333-333333333333",
  seq: 7,
  eventId: "6f1c2a4e-8b1d-4c3a-9e2f-1a2b3c4d5e6f",
  eventReference: "EVT-000042",
  equipmentTypeId: "70000000-0000-4000-8000-000000000001",
  equipmentTypeName: "Folding Chairs",
  quantity: 40,
  notes: "Rows of 10",
  requiredFrom: "2026-12-02T06:00:00.000Z",
  requiredTo: "2026-12-02T10:00:00.000Z",
  status: "SUBMITTED",
  requestedBy: "c1000000-0000-4000-8000-000000000001",
  requestedAt: "2026-11-04T06:30:00.000Z",
  statusChangedBy: null,
  statusChangedAt: null,
  unavailableReason: null,
  substituteEquipmentTypeId: null,
  substituteEquipmentTypeName: null,
  substituteQuantity: null,
  updatedAt: "2026-11-04T06:30:00.000Z",
  reservation: null,
};
const technicalSupportIds = ["74000000-0000-4000-8000-000000000004", "74000000-0000-4000-8000-000000000014"];

describe("lineSubmittedMessage (O1, D-02)", () => {
  it("is keyed by the line, on the equipment request topic, and names the event, the line and who to tell", () => {
    const message = lineSubmittedMessage({
      event: { id: line.eventId, name: "Freshmen Orientation" },
      line,
      technicalSupportIds,
      actor: { userId: line.requestedBy, role: "EVENT_COORDINATOR" },
      correlationId: "corr-1",
    });

    expect(message).toEqual({
      topic: KAFKA_TOPICS.equipmentRequest,
      messageType: "equipment-request.line-submitted",
      aggregateId: line.id,
      actor: { userId: line.requestedBy, role: "EVENT_COORDINATOR" },
      correlationId: "corr-1",
      payload: {
        eventId: line.eventId,
        eventReference: "EVT-000042",
        eventName: "Freshmen Orientation",
        lineId: line.id,
        equipmentTypeName: "Folding Chairs",
        quantity: 40,
        requiredFrom: "2026-12-02T06:00:00.000Z",
        requiredTo: "2026-12-02T10:00:00.000Z",
        requestedBy: line.requestedBy,
        requestedAt: "2026-11-04T06:30:00.000Z",
        technicalSupportIds,
      },
    });
    expect(equipmentLineSubmittedPayloadSchema.parse(message.payload)).toEqual(message.payload);
  });
});
