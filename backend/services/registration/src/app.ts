import "./asyncErrors.js";
import express from "express";
import { corsFor, parseAllowedOrigins } from "./cors.js";
import helmet from "helmet";
import { randomUUID } from "node:crypto";
import { config } from "./config.js";
import { errorHandler } from "./errorHandler.js";
import { sql } from "./db.js";
import { healthRouter } from "./health.js";
import { probeBroker } from "./kafka.js";
import { logger } from "./logger.js";
import { supabaseAuthenticator } from "./api/identity.js";
import { registrationRateLimiter } from "./api/limiter.js";
import { registrationRouter } from "./api/routes.js";
import { createServiceMetrics } from "@connectsphere/observability";
import { registerOverAdmissionGauges } from "./overAdmission.js";

/**
 * The registration service's HTTP side: health (EN-13), and the attendee API
 * (R1 to R4). src/index.ts starts it listening, the consumers and the relay.
 */
export const app = express();
// ADR-0016: the web app is on Vercel, another origin; first, so every answer carries the headers.
app.use(corsFor(parseAllowedOrigins(process.env.CORS_ALLOWED_ORIGINS)));
app.use(helmet());

// EN-17: HTTP timings and the zero-over-admission gauge. /metrics is
// rate-limited, and off in production unless METRICS_TOKEN is set.
const metrics = createServiceMetrics({ service: "registration", token: process.env.METRICS_TOKEN });
registerOverAdmissionGauges(metrics.registry, sql);
app.use(metrics.middleware);
app.use(metrics.router);

app.use(express.json());

// The correlation id travels in the response, the log line and any message the request writes (§9).
// Attendee data is never cached by the browser or a proxy (ADR-0014): logging out leaves nothing to show.
app.use((req, res, next) => {
  const correlationId = req.header("x-correlation-id") ?? randomUUID();
  req.headers["x-correlation-id"] = correlationId;
  res.setHeader("x-correlation-id", correlationId);
  if (req.path.startsWith("/api/")) res.setHeader("Cache-Control", "no-store");
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
app.use(registrationRouter({ sql, auth: supabaseAuthenticator, limiter: registrationRateLimiter(config.rateLimitPerMinute) }));

// Last, so that anything a route rejects with or passes to next(error) ends in the envelope.
app.use(errorHandler);
