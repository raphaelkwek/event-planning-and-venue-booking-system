import express from "express";
import { httpTelemetry } from "@connectsphere/telemetry";
import { config } from "./config.js";
import { sql } from "./db.js";
import { healthRouter } from "./health.js";
import { probeBroker } from "./kafka.js";

/**
 * The registration service's HTTP side: health (EN-13). The registration and
 * waitlist routes arrive with R2 to R6. src/index.ts starts it listening and
 * starts the consumer.
 */
export const app = express();
// EN-08: the correlation id (the trace id) on every response, and http_request_duration_seconds by route pattern.
app.use(httpTelemetry({ service: config.serviceName }));
app.use(express.json());
app.use(healthRouter(sql, probeBroker));
