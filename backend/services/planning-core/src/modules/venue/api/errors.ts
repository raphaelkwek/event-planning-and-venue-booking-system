import type { Response } from "express";
import type { ZodError } from "zod";
import type { ErrorCode, ErrorField } from "@connectsphere/contracts";
import { logger } from "../../../shared/logger.js";

/**
 * The single error envelope from implementation.md §5, logged with its code,
 * as in the event module.
 */
export function refuse(res: Response, status: number, code: ErrorCode, message: string, fields?: ErrorField[]) {
  const correlationId = (res.getHeader("x-correlation-id") as string | undefined) ?? null;
  logger.info("request refused", { correlationId, outcome: "refused", code });
  res.status(status).json({ error: { code, message, ...(fields ? { fields } : {}), correlationId } });
}

/** Turns a shape failure into the same `fields[]` the venue rules use. */
export function fieldsFromZod(error: ZodError): ErrorField[] {
  return error.issues.map((issue) => ({ field: issue.path.join(".") || "body", message: issue.message }));
}
