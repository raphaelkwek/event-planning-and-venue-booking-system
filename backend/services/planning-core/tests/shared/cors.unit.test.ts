import { describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import { corsFor, parseAllowedOrigins } from "../../src/shared/cors.js";

/**
 * DEPLOY-T9 (ADR-0016): the web app on Vercel is another origin, so the API
 * answers CORS for that environment's own Vercel domain only, read from
 * CORS_ALLOWED_ORIGINS. Unset, nothing changes.
 */

const ALLOWED = "https://connectsphere-staging.vercel.app";
const FOREIGN = "https://connectsphere.vercel.app";

function appWith(value: string | undefined) {
  return express()
    .use(corsFor(parseAllowedOrigins(value)))
    .get("/api/v1/thing", (_req, res) => {
      res.setHeader("x-correlation-id", "corr-1");
      res.json({ ok: true });
    });
}

describe("CORS for the Vercel origin", () => {
  it("DEPLOY-T9 an allowed origin gets Access-Control-Allow-Origin and the exposed correlation header", async () => {
    const res = await request(appWith(ALLOWED)).get("/api/v1/thing").set("Origin", ALLOWED);
    expect(res.status).toBe(200);
    expect(res.headers["access-control-allow-origin"]).toBe(ALLOWED);
    expect(res.headers["access-control-expose-headers"]).toBe("X-Correlation-Id,Retry-After");
    expect(res.headers["access-control-allow-credentials"]).toBeUndefined();
    expect(res.headers.vary).toContain("Origin");
  });

  it("DEPLOY-T9 a preflight from the allowed origin is answered 204 with the allowed methods and headers", async () => {
    const res = await request(appWith(ALLOWED))
      .options("/api/v1/thing")
      .set("Origin", ALLOWED)
      .set("Access-Control-Request-Method", "PATCH")
      .set("Access-Control-Request-Headers", "authorization,content-type,if-match");
    expect(res.status).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBe(ALLOWED);
    expect(res.headers["access-control-allow-methods"]).toBe("GET,HEAD,POST,PUT,PATCH,OPTIONS");
    expect(res.headers["access-control-allow-headers"]).toBe("Authorization,Content-Type,If-Match,X-Correlation-Id");
    expect(res.headers["access-control-max-age"]).toBe("600");
  });

  it("DEPLOY-T9 a foreign origin gets no Access-Control-Allow-Origin", async () => {
    const get = await request(appWith(ALLOWED)).get("/api/v1/thing").set("Origin", FOREIGN);
    expect(get.headers["access-control-allow-origin"]).toBeUndefined();
    const preflight = await request(appWith(ALLOWED))
      .options("/api/v1/thing")
      .set("Origin", FOREIGN)
      .set("Access-Control-Request-Method", "POST");
    expect(preflight.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("DEPLOY-T9 with CORS_ALLOWED_ORIGINS unset nothing changes", async () => {
    for (const value of [undefined, "", " , "]) {
      const res = await request(appWith(value)).get("/api/v1/thing").set("Origin", ALLOWED);
      expect(res.status).toBe(200);
      expect(res.headers["access-control-allow-origin"]).toBeUndefined();
      expect(res.headers["access-control-expose-headers"]).toBeUndefined();
    }
  });

  it("DEPLOY-T9 a wildcard or a path is refused at start-up", () => {
    for (const bad of ["*", "https://a.vercel.app/", "https://a.vercel.app/app", "http://a.vercel.app", "a.vercel.app", "https://*.vercel.app"]) {
      expect(() => parseAllowedOrigins(bad), bad).toThrow(/CORS_ALLOWED_ORIGINS/);
    }
    expect(parseAllowedOrigins(` ${ALLOWED} , http://localhost:5173,http://127.0.0.1:4173 `)).toEqual([
      ALLOWED,
      "http://localhost:5173",
      "http://127.0.0.1:4173",
    ]);
  });
});
