import express from "express";
import { httpTelemetry } from "@connectsphere/telemetry";
import { config } from "./config.js";
import { sql } from "./db.js";
import { healthRouter } from "./health.js";
import { probeBroker } from "./kafka.js";
import { notificationsRouter } from "./api/notifications.js";

/**
 * The notification service's HTTP side: health (EN-04.3), and T2's read,
 * unread-count and mark-as-read API. src/index.ts starts it
 * listening and starts the consumers.
 */
export const app = express();
// EN-08: the correlation id (the trace id) on every response, and http_request_duration_seconds by route pattern.
app.use(httpTelemetry({ service: config.serviceName }));
app.use(express.json());
app.use(healthRouter(sql, probeBroker));
app.use(notificationsRouter(sql));
