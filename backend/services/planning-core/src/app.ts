import express from "express";
import { randomUUID } from "node:crypto";
import { logger } from "./shared/logger.js";
import { sql } from "./shared/db.js";
import { healthRouter } from "./shared/health.js";
import { probeBroker } from "./shared/kafka/client.js";
import { identityRouter } from "./modules/identity/index.js";
import { eventRouter } from "./modules/event/index.js";
import { venueRouter } from "./modules/venue/index.js";
import { equipmentRouter } from "./modules/equipment/index.js";
import { changeRouter } from "./modules/change/index.js";

/**
 * planning-core: the one deployable for staff-facing work (ADR-0004). Each
 * module mounts its own router here and owns everything behind it; this file
 * only wires them together. src/index.ts starts it listening, so tests can
 * import the app without opening a port.
 */
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

app.use(healthRouter(sql, probeBroker));
app.use(identityRouter(sql));
app.use(eventRouter(sql));
app.use(venueRouter(sql));
app.use(equipmentRouter());
app.use(changeRouter());
