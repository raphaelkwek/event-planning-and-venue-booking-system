import { z } from "zod";
import { EQUIPMENT_REQUEST_LINE_STATUSES } from "./equipment.js";

/**
 * Domain events produced by the equipment module for O1/O2's request lines. They are
 * published to the equipment-request aggregate's topic, `KAFKA_TOPICS.equipmentRequest`
 * (topics.ts); the message type says which one this is. The payload carries what the
 * notification to the assigned coordinator needs (O2): the event, the line and the new
 * status, never a whole aggregate.
 */

const lineStatus = z.enum(EQUIPMENT_REQUEST_LINE_STATUSES);

export const equipmentLineStatusChangedPayloadSchema = z.object({
  eventId: z.string().uuid(),
  eventReference: z.string().min(1),
  eventName: z.string().min(1),
  lineId: z.string().uuid(),
  /** The event's assigned coordinator when the status changed: the one to notify. */
  coordinatorId: z.string().uuid(),
  equipmentTypeName: z.string().min(1),
  quantity: z.number().int().positive(),
  /** Q1: how many were reserved, when that is fewer than `quantity`'s worth the coordinator should hear about. Absent for O2's changes. */
  reservedQuantity: z.number().int().positive().nullable().optional(),
  /** Q2: the change released the line's reservation; `reason` is the release reason. */
  released: z.boolean().optional(),
  previousStatus: lineStatus,
  newStatus: lineStatus,
  /** O2's reason for Unavailable. */
  reason: z.string().nullable(),
  /** O2's substitute, for Substituted. */
  substituteEquipmentTypeName: z.string().nullable(),
  substituteQuantity: z.number().int().positive().nullable(),
  changedBy: z.string().uuid(),
  changedAt: z.string().datetime(),
});

/** Validators keyed by messageType, for producers and consumers alike. */
export const EQUIPMENT_REQUEST_PAYLOAD_SCHEMAS = {
  "equipment-request.line-status-changed": equipmentLineStatusChangedPayloadSchema,
} as const;

export type EquipmentRequestMessageType = keyof typeof EQUIPMENT_REQUEST_PAYLOAD_SCHEMAS;
