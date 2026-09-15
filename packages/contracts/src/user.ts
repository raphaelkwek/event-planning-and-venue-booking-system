import { z } from "zod";
import { ROLES } from "./accessScope.js";

/** The response of Identity's `GET /api/v1/users/me`, consumed by every service. */
export const currentUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(ROLES),
});

export type CurrentUser = z.infer<typeof currentUserSchema>;
