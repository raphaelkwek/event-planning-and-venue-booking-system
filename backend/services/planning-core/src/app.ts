import "./shared/asyncErrors.js";
import express from "express";
import { httpTelemetry, traceFields } from "@connectsphere/telemetry";
import { config } from "./shared/config.js";
import helmet from "helmet";
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

// EN-08: first, so every route and every refusal gets a correlation id (the trace id, ADR-0013)
// and is timed by route pattern (http_request_duration_seconds, the names EN-17's SLOs query).
app.use(httpTelemetry({ service: config.serviceName }));
// The API serves JSON only, so the default helmet headers (and no X-Powered-By) are safe for the SPA, which is served elsewhere.
app.use(helmet());

// EN-17: timed first, so every route and every refusal is counted. /metrics is
// rate-limited, and off in production unless METRICS_TOKEN is set.
const metrics = createServiceMetrics({ service: "planning-core", token: process.env.METRICS_TOKEN });
app.use(metrics.middleware);
app.use(metrics.router);

app.use(express.json());

app.use((req, res, next) => {
  const correlationId = res.getHeader("x-correlation-id") as string;
  // Taken now, while the request's span is the active one: the 'finish' event may run outside it.
  const trace = traceFields();
  const startedAt = Date.now();
  res.on("finish", () => {
    const fields = {
      ...trace,
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
