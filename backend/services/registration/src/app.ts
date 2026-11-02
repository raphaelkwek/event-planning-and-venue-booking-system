import "./asyncErrors.js";
import express from "express";
import helmet from "helmet";
import { randomUUID } from "node:crypto";
import { errorHandler } from "./errorHandler.js";
import { logger } from "./logger.js";
import { sql } from "./db.js";
import { healthRouter } from "./health.js";
import { probeBroker } from "./kafka.js";

/**
 * The registration service's HTTP side: health (EN-13). The registration and
 * waitlist routes arrive with R2 to R6. src/index.ts starts it listening and
 * starts the consumer.
 */
export const app = express();
app.use(helmet());
app.use(express.json());
app.use((req, res, next) => {
  const correlationId = req.header("x-correlation-id") ?? randomUUID();
  res.setHeader("x-correlation-id", correlationId);
  res.on("finish", () => {
    // A 5xx is our failure, not a refusal: the error handler has logged it in detail.
    if (res.statusCode >= 500) logger.error("request failed", { correlationId, route: `${req.method} ${req.path}`, outcome: "error" });
  });
  next();
});
app.use(healthRouter(sql, probeBroker));

// Last, so that anything a route rejects with or passes to next(error) ends in the envelope.
app.use(errorHandler);
