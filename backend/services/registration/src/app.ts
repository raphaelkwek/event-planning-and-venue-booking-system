import express from "express";
import { createServiceMetrics } from "@connectsphere/observability";
import { sql } from "./db.js";
import { healthRouter } from "./health.js";
import { probeBroker } from "./kafka.js";
import { registerOverAdmissionGauges } from "./overAdmission.js";

/**
 * The registration service's HTTP side: health (EN-13). The registration and
 * waitlist routes arrive with R2 to R6. src/index.ts starts it listening and
 * starts the consumer.
 */
export const app = express();

// EN-17: HTTP timings and the zero-over-admission gauge. /metrics is
// rate-limited, and off in production unless METRICS_TOKEN is set.
const metrics = createServiceMetrics({ service: "registration", token: process.env.METRICS_TOKEN });
registerOverAdmissionGauges(metrics.registry, sql);
app.use(metrics.middleware);
app.use(metrics.router);

app.use(express.json());
app.use(healthRouter(sql, probeBroker));
