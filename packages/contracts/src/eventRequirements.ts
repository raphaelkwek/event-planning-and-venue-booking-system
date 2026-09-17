import { z } from "zod";

/**
 * The requirements an organiser records on an event request (B1), in the shape
 * the Venue service will filter and compare against (J1, K1) and the Equipment
 * service will turn into request lines (O1).
 *
 * Layout, facility and equipment type are free text for now. Their vocabulary
 * belongs to the Venue catalogue (H1) and the Equipment inventory (P2); fixing a
 * list here would be inventing values those owners have not defined yet
 * (implementation.md §11, rule 3). Replace the strings with shared enums once
 * those services exist.
 */

const text = z.string().refine((value) => value.trim().length > 0, "must not be empty");

export const venueRequirementsSchema = z.object({
  layout: z.string().nullish(),
  facilities: z.array(text).nullish(),
  notes: z.string().nullish(),
});

export type VenueRequirements = z.infer<typeof venueRequirementsSchema>;

export const equipmentRequirementLineSchema = z.object({
  equipmentType: text,
  quantity: z.number().int("must be a whole number").positive("must be greater than zero"),
  notes: z.string().nullish(),
});

export const equipmentRequirementsSchema = z.array(equipmentRequirementLineSchema);

export type EquipmentRequirementLine = z.infer<typeof equipmentRequirementLineSchema>;
