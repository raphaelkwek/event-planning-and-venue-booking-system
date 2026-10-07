import { z } from "zod";
import { EQUIPMENT_KINDS } from "@connectsphere/contracts";

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
