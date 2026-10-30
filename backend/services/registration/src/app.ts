import express from "express";
import { sql } from "./db.js";
import { healthRouter } from "./health.js";
import { probeBroker } from "./kafka.js";

/**
 * The registration service's HTTP side: health (EN-13). The registration and
 * waitlist routes arrive with R2 to R6. src/index.ts starts it listening and
 * starts the consumer.
 */
export const app = express();
app.use(express.json());
app.use(healthRouter(sql, probeBroker));
