import "./asyncErrors.js";
import express from "express";
import { corsFor, parseAllowedOrigins } from "./cors.js";
import { httpTelemetry } from "@connectsphere/telemetry";
import { config } from "./config.js";
import helmet from "helmet";
import { randomUUID } from "node:crypto";
import { errorHandler } from "./errorHandler.js";
import { logger } from "./logger.js";
import { sql } from "./db.js";
import { healthRouter } from "./health.js";
import { probeBroker } from "./kafka.js";
import { notificationsRouter } from "./api/notifications.js";
import { metrics } from "./metrics.js";

/**
 * The notification service's HTTP side: health (EN-04.3), and T2's read,
 * unread-count and mark-as-read API. src/index.ts starts it
 * listening and starts the consumers.
 */
export const app = express();
// ADR-0016: the web app is on Vercel, another origin; first, so every answer carries the headers.
app.use(corsFor(parseAllowedOrigins(process.env.CORS_ALLOWED_ORIGINS)));
// EN-08: the correlation id (the trace id) on every response, and http_request_duration_seconds by route pattern.
app.use(httpTelemetry({ service: config.serviceName }));
app.use(helmet());

// EN-17: HTTP timings and the notification-freshness histogram (metrics.ts).
// /metrics is rate-limited, and off in production unless METRICS_TOKEN is set.
app.use(metrics.middleware);
app.use(metrics.router);

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
app.use(notificationsRouter(sql));

// Last, so that anything a route rejects with or passes to next(error) ends in the envelope.
app.use(errorHandler);
