import type { ErrorRequestHandler, Request, Response } from "express";
import type { ErrorCode } from "@connectsphere/contracts";
import { logger } from "./logger.js";

/**
 * The last middleware of the app (implementation.md §5, §9). Anything a route
 * throws, rejects with, or passes to `next(error)` ends here, so a caller never
 * sees a stack trace, an HTML page or database text, only the error envelope.
 *
 * - body-parser's malformed JSON becomes 400 VALIDATION_FAILED, and an oversized
 *   body 413, both in the envelope;
 * - any other failure is 500 INTERNAL_ERROR with a generic message. The detail
 *   goes to the log with the correlation id, which the caller can quote.
 */

interface HttpError extends Error {
  status?: number;
  statusCode?: number;
  type?: string;
  expose?: boolean;
}

function correlationIdOf(req: Request, res: Response): string | null {
  return (res.getHeader("x-correlation-id") as string | undefined) ?? req.header("x-correlation-id") ?? null;
}

function send(res: Response, status: number, code: ErrorCode, message: string, correlationId: string | null) {
  res.status(status).json({ error: { code, message, correlationId } });
}

export const errorHandler: ErrorRequestHandler = (error: HttpError, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }
  const correlationId = correlationIdOf(req, res);

  if (error?.type === "entity.parse.failed") {
    send(res, 400, "VALIDATION_FAILED", "The request body is not valid JSON.", correlationId);
    return;
  }
  if (error?.type === "entity.too.large") {
    send(res, 413, "VALIDATION_FAILED", "The request body is too large.", correlationId);
    return;
  }
  const status = error?.status ?? error?.statusCode;
  if (typeof status === "number" && status >= 400 && status < 500 && error.expose) {
    send(res, status, "VALIDATION_FAILED", "The request could not be read.", correlationId);
    return;
  }

  logger.error("request failed", {
    correlationId,
    route: `${req.method} ${req.path}`,
    outcome: "error",
    code: "INTERNAL_ERROR",
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
  send(res, 500, "INTERNAL_ERROR", "Something went wrong on our side. Try again, and quote the correlation id if it keeps happening.", correlationId);
};
