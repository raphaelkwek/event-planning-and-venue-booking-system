import { logger } from "./logger.js";

/**
 * Last-resort handlers. A rejected promise that nothing handled is logged with its stack
 * and the process carries on (async route errors reach next() anyway, so this is a backstop).
 * An uncaught exception is logged and the process then exits with 1, because Node may be in a corrupt state. Routes are
 * covered by asyncErrors.ts and errorHandler.ts; this catches background work
 * such as the outbox relay or a consumer.
 */
export function installProcessGuards(
  proc: Pick<NodeJS.Process, "on"> = process,
  exit: (code: number) => void = (code) => process.exit(code),
): void {
  proc.on("unhandledRejection", (reason) => {
    logger.error("unhandled promise rejection", {
      outcome: "error",
      error: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
    });
  });
  proc.on("uncaughtException", (error) => {
    logger.error("uncaught exception", { outcome: "error", error: error.message, stack: error.stack });
    // The process may be in a corrupt state: leave once the log line has been written.
    process.stderr.write("", () => exit(1));
  });
}
