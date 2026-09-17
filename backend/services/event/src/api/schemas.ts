import { z } from "zod";
import { equipmentRequirementsSchema, venueRequirementsSchema } from "@connectsphere/contracts";
import type { DraftFields } from "../repo/drafts.js";
import type { EventFields } from "../repo/events.js";

/**
 * Request shapes. These check shape only — B2's business rules live in
 * domain/validation.ts, so a draft may hold a half-filled request (C1) while a
 * submission is held to the full rule set.
 */

const isoDateTime = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), "must be a valid date and time");

const requestFields = {
  purpose: z.string().nullish(),
  description: z.string().nullish(),
  proposedStartAt: isoDateTime.nullish(),
  proposedEndAt: isoDateTime.nullish(),
  expectedAttendance: z.number().nullish(),
  venueRequirements: venueRequirementsSchema.nullish(),
  accessibilityNeeds: z.string().nullish(),
  equipmentRequired: z.boolean().nullish(),
  equipmentRequirements: equipmentRequirementsSchema.nullish(),
  registrationRequired: z.boolean().nullish(),
  registrationOpensAt: isoDateTime.nullish(),
  registrationClosesAt: isoDateTime.nullish(),
};

/**
 * C1 — a draft needs a name; everything else may be empty. A name of spaces is
 * no name, but the name is stored exactly as typed rather than trimmed, because
 * C2 restores "the exact value that was saved".
 */
export const draftBodySchema = z.object({
  name: z.string().refine((value) => value.trim().length > 0, "Event name is required."),
  ...requestFields,
});

/** B1 — a direct submission carries the same fields; B2 decides if they suffice. */
export const submissionBodySchema = z.object({
  name: z.string().nullish(),
  ...requestFields,
});

export type RequestBody = z.infer<typeof submissionBodySchema>;

export const clarificationBodySchema = z.object({ message: z.string().nullish() });

export const clarificationResponseBodySchema = z.object({
  message: z.string().nullish(),
  amendments: z.object(requestFields).extend({ name: z.string().nullish() }).partial().nullish(),
});

export const rejectionBodySchema = z.object({ reason: z.string().nullish() });

/**
 * D3 — the fields an organiser may amend when answering a clarification,
 * mapped to their columns. A field absent from this map is not amendable.
 */
export const AMENDABLE_COLUMNS = {
  name: "name",
  purpose: "purpose",
  description: "description",
  proposedStartAt: "proposed_start_at",
  proposedEndAt: "proposed_end_at",
  expectedAttendance: "expected_attendance",
  venueRequirements: "venue_requirements",
  accessibilityNeeds: "accessibility_needs",
  equipmentRequirements: "equipment_requirements",
  registrationRequired: "registration_required",
  registrationOpensAt: "registration_opens_at",
  registrationClosesAt: "registration_closes_at",
  equipmentRequired: "equipment_required",
} as const;

/**
 * B2 has already established the mandatory fields are present; this maps the
 * optional ones from absent to null, because an absent value is not something
 * the database driver will accept.
 */
export function toEventFields(body: RequestBody): EventFields {
  const draft = toDraftFields(body);
  return {
    ...draft,
    name: draft.name,
    purpose: draft.purpose ?? "",
    description: draft.description ?? "",
    proposedStartAt: draft.proposedStartAt!,
    proposedEndAt: draft.proposedEndAt!,
    expectedAttendance: draft.expectedAttendance!,
    equipmentRequired: draft.equipmentRequired!,
    registrationRequired: draft.registrationRequired!,
  };
}

export function toDraftFields(body: RequestBody & { name?: string | null }): DraftFields {
  return {
    name: body.name ?? "",
    purpose: body.purpose ?? null,
    description: body.description ?? null,
    proposedStartAt: body.proposedStartAt ?? null,
    proposedEndAt: body.proposedEndAt ?? null,
    expectedAttendance: body.expectedAttendance ?? null,
    venueRequirements: body.venueRequirements ?? null,
    accessibilityNeeds: body.accessibilityNeeds ?? null,
    equipmentRequired: body.equipmentRequired ?? null,
    equipmentRequirements: body.equipmentRequirements ?? null,
    registrationRequired: body.registrationRequired ?? null,
    registrationOpensAt: body.registrationOpensAt ?? null,
    registrationClosesAt: body.registrationClosesAt ?? null,
  };
}
