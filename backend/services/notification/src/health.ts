import { Router } from "express";
import type { Sql } from "postgres";

/**
 * /healthz says the process is alive; /readyz says whether it can do its job.
 * Ready means the database answers, since every notification is stored there.
 * The broker is reported, not required: while it is down nothing new arrives,
 * but nothing is lost either (the outbox holds it), and what is stored can be read.
 */
export function healthRouter(sql: Sql, probeBroker?: () => Promise<boolean>) {
  const router = Router();

  router.get("/healthz", (_req, res) => {
    res.status(200).json({ status: "ok", service: "notification" });
  });

  router.get("/readyz", async (_req, res) => {
    const kafka = probeBroker ? ((await probeBroker()) ? "reachable" : "unreachable") : "not_configured";
    try {
      await sql`select 1`;
      res.status(200).json({ status: "ready", checks: { database: "ok", kafka } });
    } catch (error) {
      res.status(503).json({ status: "not_ready", checks: { database: "unreachable", kafka }, error: (error as Error).message });
    }
  });

  return router;
}
