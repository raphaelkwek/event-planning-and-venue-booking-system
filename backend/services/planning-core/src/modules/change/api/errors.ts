import type { Response } from "express";
import type { ZodError } from "zod";
import type { ErrorCode, ErrorField } from "@connectsphere/contracts";
import { logger } from "../../../shared/logger.js";

export function refuse(
  res: Response,
  status: number,
  code: ErrorCode,
  message: string,
  fields?: ErrorField[],
  details?: Record<string, unknown>,
) {
  const correlationId = (res.getHeader("x-correlation-id") as string | undefined) ?? null;
  logger.info("request refused", { correlationId, outcome: "refused", code });
  res.status(status).json({
    error: { code, message, ...(details ? { details } : {}), ...(fields ? { fields } : {}), correlationId },
  });
}

export function fieldsFromZod(error: ZodError): ErrorField[] {
  return error.issues.map((issue) => ({ field: issue.path.join(".") || "body", message: issue.message }));
}
