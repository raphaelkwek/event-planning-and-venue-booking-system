import { logger } from "./logger.js";

/**
 * Last-resort loggers. A rejected promise or a throw that nothing handled is
 * written to the log with its stack instead of silently ending the process (and,
 * under `concurrently --kill-others-on-fail`, the whole dev stack). Routes are
 * covered by asyncErrors.ts and errorHandler.ts; this catches background work
 * such as the outbox relay or a consumer.
 */
export function installProcessGuards(proc: Pick<NodeJS.Process, "on"> = process): void {
  proc.on("unhandledRejection", (reason) => {
    logger.error("unhandled promise rejection", {
      outcome: "error",
      error: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
    });
  });
  proc.on("uncaughtException", (error) => {
    logger.error("uncaught exception", { outcome: "error", error: error.message, stack: error.stack });
  });
}
