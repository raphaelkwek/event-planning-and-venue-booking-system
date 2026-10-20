import { z } from "zod";

/**
 * The shape of a venue in a request. What the values mean (whole numbers above
 * zero, at least one layout, sensible hours) is checked by domain/venueRecord.ts.
 */
const dayHours = z.object({ opensAt: z.string(), closesAt: z.string() }).nullable();

export const venueBodySchema = z.object({
  name: z.string(),
  building: z.string(),
  maxCapacity: z.number({ invalid_type_error: "Maximum capacity must be a whole number greater than zero." }),
  layouts: z.array(z.object({ name: z.string(), capacity: z.number({ invalid_type_error: "Layout capacity must be a whole number greater than zero." }) })),
  facilities: z.array(z.string()),
  accessibilityFeatures: z.array(z.string()),
  operatingHours: z.object({
    monday: dayHours.optional(),
    tuesday: dayHours.optional(),
    wednesday: dayHours.optional(),
    thursday: dayHours.optional(),
    friday: dayHours.optional(),
    saturday: dayHours.optional(),
    sunday: dayHours.optional(),
  }),
  setupMinutes: z.number({ invalid_type_error: "Setup time must be a whole number of minutes, 0 or more." }).optional(),
  turnaroundMinutes: z.number({ invalid_type_error: "Turnaround time must be a whole number of minutes, 0 or more." }).optional(),
  isActive: z.boolean().optional(),
});

export type VenueBody = z.infer<typeof venueBodySchema>;
