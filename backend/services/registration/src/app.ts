import express from "express";
import { randomUUID } from "node:crypto";
import { config } from "./config.js";
import { sql } from "./db.js";
import { healthRouter } from "./health.js";
import { probeBroker } from "./kafka.js";
import { logger } from "./logger.js";
import { supabaseAuthenticator } from "./api/identity.js";
import { registrationRouter } from "./api/routes.js";
import { waitingRoomRouter } from "./api/waitingRoom.js";

/**
 * The registration service's HTTP side: health (EN-13), and the attendee API
 * (R1 to R4). src/index.ts starts it listening, the consumers and the relay.
 */
export const app = express();
if (config.trustProxyHops > 0) app.set("trust proxy", config.trustProxyHops);
app.use(express.json());

// The correlation id travels in the response, the log line and any message the request writes (§9).
// Attendee data is never cached by the browser or a proxy (ADR-0014): logging out leaves nothing to show.
// The one exception is the published listing in the browse routes, which set their own short public cache for the CDN (EN-12).
app.use((req, res, next) => {
  const correlationId = req.header("x-correlation-id") ?? randomUUID();
  req.headers["x-correlation-id"] = correlationId;
  res.setHeader("x-correlation-id", correlationId);
  if (req.path.startsWith("/api/")) res.setHeader("Cache-Control", "no-store");
  const startedAt = Date.now();
  res.on("finish", () => {
    logger.info("request completed", {
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
app.use(waitingRoomRouter({ sql, auth: supabaseAuthenticator }));
