import "./shared/asyncErrors.js";
import express from "express";
import helmet from "helmet";
import { randomUUID } from "node:crypto";
import { corsFor, parseAllowedOrigins } from "./shared/cors.js";
import { createServiceMetrics } from "@connectsphere/observability";
import { logger } from "./shared/logger.js";
import { errorHandler } from "./shared/errorHandler.js";
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

// ADR-0016: the web app is on Vercel, another origin; first, so every answer carries the headers.
app.use(corsFor(parseAllowedOrigins(process.env.CORS_ALLOWED_ORIGINS)));
// The API serves JSON only, so the default helmet headers (and no X-Powered-By) are safe for the SPA, which is served elsewhere.
app.use(helmet());

// EN-17: timed first, so every route and every refusal is counted. /metrics is
// rate-limited, and off in production unless METRICS_TOKEN is set.
const metrics = createServiceMetrics({ service: "planning-core", token: process.env.METRICS_TOKEN });
app.use(metrics.middleware);
app.use(metrics.router);

app.use(express.json());

app.use((req, res, next) => {
  const correlationId = req.header("x-correlation-id") ?? randomUUID();
  req.headers["x-correlation-id"] = correlationId;
  res.setHeader("x-correlation-id", correlationId);
  const startedAt = Date.now();
  res.on("finish", () => {
    const fields = {
      correlationId,
      route: `${req.method} ${req.path}`,
      durationMs: Date.now() - startedAt,
    };
    // A 5xx is our failure, not a refusal: log it as an error.
    if (res.statusCode >= 500) logger.error("request failed", { ...fields, outcome: "error" });
    else logger.info("request completed", { ...fields, outcome: res.statusCode < 400 ? "success" : "refused" });
  });
  next();
});

app.use(healthRouter(sql, probeBroker));
app.use(identityRouter(sql));
app.use(eventRouter(sql));
app.use(venueRouter(sql));
app.use(equipmentRouter(sql));
app.use(changeRouter(sql));

// Last, so that anything a route rejects with or passes to next(error) ends in the envelope.
app.use(errorHandler);
