import { z } from "zod";
import type { ErrorField } from "@connectsphere/contracts";

export interface AvailabilityInput {
  startsAt: Date;
  endsAt: Date;
  requestedQuantity: number;
}
const timestamp = z.string().datetime({ offset: true });
const querySchema = z.object({
  startsAt: timestamp,
  endsAt: timestamp,
  requestedQuantity: z.string().regex(/^\d+$/, "Requested quantity must be a whole number of zero or greater.")
    .transform(Number).refine(Number.isSafeInteger, "Requested quantity must be a safe whole number."),
});

export function validateAvailabilityQuery(query: unknown): { ok: true; input: AvailabilityInput } | { ok: false; fields: ErrorField[] } {
  const result = querySchema.safeParse(query);
  if (!result.success) return { ok: false, fields: result.error.issues.map((issue) => ({ field: issue.path.join("."), message: issue.message })) };
  const startsAt = new Date(result.data.startsAt);
  const endsAt = new Date(result.data.endsAt);
  if (endsAt <= startsAt) return { ok: false, fields: [{ field: "endsAt", message: "End must be later than start." }] };
  return { ok: true, input: { startsAt, endsAt, requestedQuantity: result.data.requestedQuantity } };
}
