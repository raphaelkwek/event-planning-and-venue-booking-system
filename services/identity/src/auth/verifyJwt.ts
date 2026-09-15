import type { NextFunction, Request, Response } from "express";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { config } from "../config.js";

const jwks = createRemoteJWKSet(new URL(config.supabaseJwksUrl));

export interface AuthenticatedRequest extends Request {
  auth?: { supabaseUserId: string };
}

export async function verifyJwt(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const header = req.header("authorization");
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({
      error: {
        code: "UNAUTHENTICATED",
        message: "A valid bearer token is required.",
        correlationId: req.header("x-correlation-id") ?? null,
      },
    });
    return;
  }

  const token = header.slice("Bearer ".length);

  try {
    const { payload } = await jwtVerify(token, jwks);
    if (typeof payload.sub !== "string") {
      throw new Error("Token has no subject");
    }
    req.auth = { supabaseUserId: payload.sub };
    next();
  } catch {
    res.status(401).json({
      error: {
        code: "UNAUTHENTICATED",
        message: "The bearer token is invalid or expired.",
        correlationId: req.header("x-correlation-id") ?? null,
      },
    });
  }
}
