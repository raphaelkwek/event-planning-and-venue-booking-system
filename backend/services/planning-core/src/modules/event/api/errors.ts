import type { Response } from "express";
import type { ZodError } from "zod";
import type { ErrorCode, ErrorField, Role } from "@connectsphere/contracts";
import { logger } from "../../../shared/logger.js";
import { notInScopeMessage } from "../../identity/index.js";

/**
 * The single error envelope from implementation.md §5. Every refusal goes
 * through here so that it is shaped consistently and logged with its code —
 * refusals are correct behaviour under CP and we show they are deliberate
 * (implementation.md §9).
 */
export function refuse(
  res: Response,
  status: number,
  code: ErrorCode,
  message: string,
  extra: {
    fields?: ErrorField[];
    details?: Record<string, unknown>;
    correlationId?: string | null;
  } = {}
) {
  const correlationId =
    extra.correlationId ?? (res.getHeader("x-correlation-id") as string | undefined) ?? null;

  logger.info("request refused", { correlationId, outcome: "refused", code });

  res.status(status).json({
    error: {
      code,
      message,
      ...(extra.details ? { details: extra.details } : {}),
      ...(extra.fields ? { fields: extra.fields } : {}),
      correlationId,
    },
  });
}

/**
 * A3 — an event outside the caller's scope is simply not found, never refused
 * as forbidden. A4 — a coordinator is told it is not assigned to them.
 */
export function eventNotFound(res: Response, role: Role) {
  refuse(res, 404, "EVENT_NOT_FOUND", notInScopeMessage(role, "No event with that reference is available to you."));
}

/** Turns a shape failure into the same `fields[]` B2's rule failures use. */
export function fieldsFromZod(error: ZodError): ErrorField[] {
  return error.issues.map((issue) => ({
    field: issue.path.join(".") || "body",
    message: issue.message,
  }));
}
