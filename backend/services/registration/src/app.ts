import express from "express";
import { corsFor, parseAllowedOrigins } from "./cors.js";
import { sql } from "./db.js";
import { healthRouter } from "./health.js";
import { probeBroker } from "./kafka.js";

/**
 * The registration service's HTTP side: health (EN-13). The registration and
 * waitlist routes arrive with R2 to R6. src/index.ts starts it listening and
 * starts the consumer.
 */
export const app = express();
// ADR-0016: the web app is on Vercel, another origin; first, so every answer carries the headers.
app.use(corsFor(parseAllowedOrigins(process.env.CORS_ALLOWED_ORIGINS)));
app.use(express.json());
app.use(healthRouter(sql, probeBroker));
