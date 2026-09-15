import express from "express";
import { randomUUID } from "node:crypto";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { sql } from "./db.js";
import { healthRouter } from "./api/health.js";

export const app = express();

app.use(express.json());

app.use((req, res, next) => {
  const correlationId = req.header("x-correlation-id") ?? randomUUID();
  req.headers["x-correlation-id"] = correlationId;
  res.setHeader("x-correlation-id", correlationId);
  const startedAt = Date.now();
  res.on("finish", () => {
    logger.info("request completed", {
      correlationId,
      route: `${req.method} ${req.path}`,
      durationMs: Date.now() - startedAt,
      outcome: res.statusCode < 400 ? "success" : "refused",
    });
  });
  next();
});

app.use(healthRouter(sql));

// ROUTES — additional routers are mounted below this line by later tasks.

if (process.env.NODE_ENV !== "test") {
  app.listen(config.port, () => {
    logger.info(`identity-service listening on :${config.port}`);
  });
}
