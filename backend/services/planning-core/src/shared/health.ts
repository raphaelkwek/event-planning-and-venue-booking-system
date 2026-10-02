import { Router } from "express";
import type { Sql } from "postgres";

export function healthRouter(sql: Sql) {
  const router = Router();

  router.get("/healthz", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  router.get("/readyz", async (_req, res) => {
    try {
      await sql`select 1`;
      res.status(200).json({ status: "ready" });
    } catch (error) {
      res.status(503).json({
        status: "not_ready",
        error: error instanceof Error ? error.message : "unknown error",
      });
    }
  });

  return router;
}
