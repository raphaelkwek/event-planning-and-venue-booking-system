import type { Response } from "express";
import type { ErrorCode, ErrorField } from "@connectsphere/contracts";
import { logger } from "../logger.js";

/** The single error envelope from implementation.md §5, logged with its code. */
export function refuse(res: Response, status: number, code: ErrorCode, message: string, fields?: ErrorField[]) {
  const correlationId = (res.getHeader("x-correlation-id") as string | undefined) ?? null;
  logger.info("request refused", { correlationId, outcome: "refused", code });
  res.status(status).json({ error: { code, message, ...(fields ? { fields } : {}), correlationId } });
}
