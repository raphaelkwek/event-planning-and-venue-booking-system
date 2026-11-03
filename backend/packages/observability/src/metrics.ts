import { timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, RequestHandler, Response, Router as ExpressRouter } from "express";
import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { collectDefaultMetrics, Counter, Histogram, Registry } from "prom-client";

/**
 * Latency buckets in seconds. 0.4 and 0.8 are the staff read and write
 * objectives and the registration objective (ADR-0013), so the SLI "requests
 * faster than the objective" is read from one bucket with no interpolation.
 */
export const LATENCY_BUCKETS_SECONDS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.2, 0.4, 0.8, 1.6, 3.2, 6.4];

/** The route label of a request that matched no route. SLIs can exclude it. */
export const UNMATCHED_ROUTE = "unmatched";

export interface ServiceMetricsOptions {
  /** Added to every series as the `service` label. */
  service: string;
  /** When set, /metrics requires `Authorization: Bearer <token>`. */
  token?: string;
  /** In production /metrics is off unless a token is set. Defaults to NODE_ENV. */
  production?: boolean;
  /** Requests per minute per client IP for /metrics. Default 30 (a scrape every 15 s is 4). */
  limitPerMinute?: number;
  /** Set false in tests that create many registries in one process. */
  defaultMetrics?: boolean;
}

export interface ServiceMetrics {
  registry: Registry;
  /** Mount first, so every route (and every refusal) is timed. */
  middleware: RequestHandler;
  /** GET /metrics, rate-limited before the token check. */
  router: ExpressRouter;
}

const statusClass = (status: number) => `${Math.floor(status / 100)}xx`;

/** The route pattern ("/api/v1/events/:id"), never the raw URL, so ids cannot create series. */
export function routeLabel(req: Pick<Request, "baseUrl" | "route">): string {
  const pattern = req.route?.path;
  return typeof pattern === "string" ? `${req.baseUrl ?? ""}${pattern}` : UNMATCHED_ROUTE;
}

function tokenMatches(header: string | undefined, token: string): boolean {
  const given = Buffer.from((header ?? "").replace(/^Bearer /, ""));
  const wanted = Buffer.from(token);
  return given.length === wanted.length && timingSafeEqual(given, wanted);
}

export function createServiceMetrics(options: ServiceMetricsOptions): ServiceMetrics {
  const registry = new Registry();
  registry.setDefaultLabels({ service: options.service });
  if (options.defaultMetrics !== false) collectDefaultMetrics({ register: registry });

  const duration = new Histogram({
    name: "http_request_duration_seconds",
    help: "HTTP request duration by route pattern, from arrival to the response finishing.",
    labelNames: ["method", "route", "status"],
    buckets: LATENCY_BUCKETS_SECONDS,
    registers: [registry],
  });
  const total = new Counter({
    name: "http_requests_total",
    help: "HTTP requests by route pattern and status class.",
    labelNames: ["method", "route", "status"],
    registers: [registry],
  });

  const middleware: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
    const startedAt = process.hrtime.bigint();
    res.on("finish", () => {
      const labels = { method: req.method, route: routeLabel(req), status: statusClass(res.statusCode) };
      duration.observe(labels, Number(process.hrtime.bigint() - startedAt) / 1e9);
      total.inc(labels);
    });
    next();
  };

  const production = options.production ?? process.env.NODE_ENV === "production";
  const router = Router();
  const limiter = rateLimit({
    windowMs: 60_000,
    limit: options.limitPerMinute ?? 30,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler: (_req, res) =>
      res.status(429).json({ error: { code: "RATE_LIMITED", message: "Too many requests. Try again after the Retry-After period.", correlationId: null } }),
  });
  router.get("/metrics", limiter, (req, res, next) => {
    if (production && !options.token) {
      res.status(404).end();
      return;
    }
    if (options.token && !tokenMatches(req.header("authorization"), options.token)) {
      res.status(401).set("WWW-Authenticate", "Bearer").end();
      return;
    }
    registry
      .metrics()
      .then((text) => res.type(registry.contentType).send(text))
      .catch(next);
  });

  return { registry, middleware, router };
}
