import express from "express";
import { corsFor, parseAllowedOrigins } from "./cors.js";
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

// EN-17: HTTP timings and the notification-freshness histogram (metrics.ts).
// /metrics is rate-limited, and off in production unless METRICS_TOKEN is set.
app.use(metrics.middleware);
app.use(metrics.router);

app.use(express.json());
app.use(healthRouter(sql, probeBroker));
app.use(notificationsRouter(sql));
