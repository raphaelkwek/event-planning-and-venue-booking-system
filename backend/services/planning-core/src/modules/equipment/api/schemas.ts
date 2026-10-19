import { z } from "zod";
import { EQUIPMENT_KINDS, EQUIPMENT_REQUEST_LINE_STATUSES } from "@connectsphere/contracts";

export const equipmentTypeBodySchema = z.object({
  name: z.string(),
  description: z.string(),
  characteristics: z.record(z.string()),
  kind: z.enum(EQUIPMENT_KINDS),
  totalQuantity: z.number().nullable(),
  unitLabels: z.array(z.string()),
});

const dateString = z.string().refine((value) => !Number.isNaN(new Date(value).getTime()), "Enter a valid date and time.");

export const unavailabilityBodySchema = z.object({
  unitId: z.string().uuid().nullable(),
  quantity: z.number().nullable(),
  startsAt: dateString,
  endsAt: dateString,
  reason: z.string(),
});

/** O1: the request is checked line by line by the domain, so the body only has to be an object with a list of objects. */
export const createLinesBodySchema = z.object({
  eventId: z.string().uuid(),
  lines: z.array(z.record(z.unknown())),
});

/** A single line, for an edit: the domain checks each field. */
export const lineBodySchema = z.record(z.unknown());

const lineStatuses = z.enum(EQUIPMENT_REQUEST_LINE_STATUSES);

export const listLinesQuerySchema = z.object({
  eventId: z.string().uuid().optional(),
  status: lineStatuses.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().regex(/^\d{1,15}$/, "Invalid cursor.").optional(),
});
