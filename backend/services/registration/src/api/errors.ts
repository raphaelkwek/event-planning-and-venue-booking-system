import type { Response } from "express";
import type { ErrorCode, ErrorField } from "@connectsphere/contracts";
import { logger } from "../logger.js";

/**
 * The single error envelope from implementation.md §5, logged with its code:
 * refusals are correct behaviour, and the log shows they were deliberate (§9).
 */
export function refuse(
  res: Response,
  status: number,
  code: ErrorCode,
  message: string,
  extra: { fields?: ErrorField[]; details?: Record<string, unknown> } = {},
) {
  const correlationId = (res.getHeader("x-correlation-id") as string | undefined) ?? null;
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
