import express from "express";
import { sql } from "./db.js";
import { healthRouter } from "./health.js";
import { probeBroker } from "./kafka.js";

/**
 * The notification service's HTTP side. EN-04.3 serves only health; T2 adds
 * the read, unread-count and mark-as-read API here. src/index.ts starts it
 * listening and starts the consumers.
 */
export const app = express();
app.use(express.json());
app.use(healthRouter(sql, probeBroker));
