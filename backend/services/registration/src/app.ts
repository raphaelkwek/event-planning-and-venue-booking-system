import express from "express";
import { httpTelemetry, traceFields } from "@connectsphere/telemetry";
import { config } from "./config.js";
import { sql } from "./db.js";
import { healthRouter } from "./health.js";
import { probeBroker } from "./kafka.js";
import { logger } from "./logger.js";
import { supabaseAuthenticator } from "./api/identity.js";
import { registrationRouter } from "./api/routes.js";
import { createServiceMetrics } from "@connectsphere/observability";
import { registerOverAdmissionGauges } from "./overAdmission.js";

/**
 * The registration service's HTTP side: health (EN-13), and the attendee API
 * (R1 to R4). src/index.ts starts it listening, the consumers and the relay.
 */
export const app = express();

// EN-08: first, so every route and every refusal gets a correlation id (the trace id, ADR-0013)
// and is timed by route pattern (http_request_duration_seconds, the names EN-17's SLOs query).
app.use(httpTelemetry({ service: config.serviceName }));

// EN-17: HTTP timings and the zero-over-admission gauge. /metrics is
// rate-limited, and off in production unless METRICS_TOKEN is set.
const metrics = createServiceMetrics({ service: "registration", token: process.env.METRICS_TOKEN });
registerOverAdmissionGauges(metrics.registry, sql);
app.use(metrics.middleware);
app.use(metrics.router);

app.use(express.json());

// The correlation id (set above: the trace id) travels in the response, the log line and any message the request writes (§9).
// Attendee data is never cached by the browser or a proxy (ADR-0014): logging out leaves nothing to show.
app.use((req, res, next) => {
  const correlationId = res.getHeader("x-correlation-id") as string;
  // Taken now, while the request's span is the active one: the 'finish' event may run outside it.
  const trace = traceFields();
  if (req.path.startsWith("/api/")) res.setHeader("Cache-Control", "no-store");
  const startedAt = Date.now();
  res.on("finish", () => {
    logger.info("request completed", {
      ...trace,
      correlationId,
      route: `${req.method} ${req.path}`,
      durationMs: Date.now() - startedAt,
      outcome: res.statusCode < 400 ? "success" : "refused",
    });
  });
  next();
});

app.use(healthRouter(sql, probeBroker));
app.use(registrationRouter({ sql, auth: supabaseAuthenticator }));
