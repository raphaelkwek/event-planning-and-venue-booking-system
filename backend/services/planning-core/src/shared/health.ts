import { Router } from "express";
import type { Sql } from "postgres";

/**
 * /healthz says the process is alive; /readyz says whether it can serve.
 *
 * Readiness depends on the database only. The broker is reported, not
 * required: while Kafka is down, requests still commit and their messages
 * wait in the outbox until the relay can publish them (implementation.md
 * §3.4), so taking planning-core out of service would turn a Kafka outage
 * into an API outage for nothing. `probeBroker` is absent when this process
 * has no KAFKA_* settings.
 */
export function healthRouter(sql: Sql, probeBroker?: () => Promise<boolean>) {
  const router = Router();

  router.get("/healthz", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  router.get("/readyz", async (_req, res) => {
    const kafka = probeBroker ? ((await probeBroker()) ? "reachable" : "unreachable") : "not_configured";
    try {
      await sql`select 1`;
      res.status(200).json({ status: "ready", checks: { database: "ok", kafka } });
    } catch (error) {
      res.status(503).json({
        status: "not_ready",
        checks: { database: "unreachable", kafka },
        error: (error as Error).message,
      });
    }
  });

  return router;
}
