import cors from "cors";
import type { RequestHandler } from "express";

/**
 * ADR-0016: in staging and production the web app is served by Vercel, a
 * different origin from this API, so the browser needs CORS. The origins come
 * from CORS_ALLOWED_ORIGINS (comma-separated, each environment lists only its
 * own Vercel domain). Unset, as on a laptop where the Vite dev server proxies
 * every call, nothing changes: no CORS header is ever sent.
 */

/** The methods and headers the web app uses (frontend/src/api). */
const METHODS = ["GET", "HEAD", "POST", "PUT", "PATCH", "OPTIONS"];
const ALLOWED_HEADERS = ["Authorization", "Content-Type", "If-Match", "X-Correlation-Id"];
/** client.ts reads the correlation id; Retry-After comes with RATE_LIMITED. */
const EXPOSED_HEADERS = ["X-Correlation-Id", "Retry-After"];
const PREFLIGHT_MAX_AGE_SECONDS = 600;
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

function isExactOrigin(entry: string): boolean {
  let url: URL;
  try {
    url = new URL(entry);
  } catch {
    return false;
  }
  if (url.origin !== entry || url.hostname.includes("*")) return false;
  return url.protocol === "https:" || (url.protocol === "http:" && LOCAL_HOSTS.has(url.hostname));
}

/** Reads CORS_ALLOWED_ORIGINS, refusing anything but exact https origins (and http on localhost). */
export function parseAllowedOrigins(value: string | undefined): string[] {
  const entries = (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  const invalid = entries.filter((entry) => !isExactOrigin(entry));
  if (invalid.length > 0) {
    throw new Error(
      `CORS_ALLOWED_ORIGINS must list exact origins such as https://app.example.org (no wildcard, path or trailing slash); refused: ${invalid.join(", ")}`
    );
  }
  return entries;
}

/** Answers CORS for the listed origins only; with none listed it does nothing. */
export function corsFor(origins: string[]): RequestHandler {
  if (origins.length === 0) return (_req, _res, next) => next();
  return cors({
    origin: origins,
    credentials: false,
    methods: METHODS,
    allowedHeaders: ALLOWED_HEADERS,
    exposedHeaders: EXPOSED_HEADERS,
    maxAge: PREFLIGHT_MAX_AGE_SECONDS,
  });
}
