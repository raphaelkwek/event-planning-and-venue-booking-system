import { Router } from "express";
import type { Sql } from "postgres";
import { logger } from "./logger.js";

/**
 * /healthz says the process is alive; /readyz says whether it can do its job.
 * Ready means the database answers, since every seat is stored there.
 * The broker is reported, not required: while it is down no new seats are built,
 * but nothing is lost either (the outbox holds the approval), and registrations can still claim the seats that exist.
 */
export function healthRouter(sql: Sql, probeBroker?: () => Promise<boolean>) {
  const router = Router();

  router.get("/healthz", (_req, res) => {
    res.status(200).json({ status: "ok", service: "registration" });
  });

  router.get("/readyz", async (_req, res) => {
    const kafka = probeBroker ? ((await probeBroker()) ? "reachable" : "unreachable") : "not_configured";
    try {
      await sql`select 1`;
      res.status(200).json({ status: "ready", checks: { database: "ok", kafka } });
    } catch (error) {
      // The detail is for the log; an unauthenticated caller gets only the status.
      logger.error("readiness check failed", { outcome: "error", error: (error as Error).message });
      res.status(503).json({ status: "not_ready", checks: { database: "unreachable", kafka } });
    }
  });

  return router;
}
