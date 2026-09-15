import { Router } from "express";
import type { Sql } from "postgres";
import { z } from "zod";
import { signInWithPassword, revokeSession } from "../auth/supabaseAuthClient.js";
import { decideLoginOutcome } from "../domain/loginPolicy.js";
import { findUserBySupabaseId, findRoleForUser, recordSuccessfulLogin } from "../repo/users.js";
import { insertLoginAudit } from "../repo/loginAudit.js";
import { logger } from "../logger.js";

const loginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function errorEnvelope(code: string, message: string, correlationId: string | null) {
  return { error: { code, message, correlationId } };
}

export function authRouter(sql: Sql) {
  const router = Router();

  router.post("/api/v1/auth/login", async (req, res) => {
    const correlationId = req.header("x-correlation-id") ?? null;
    const parsed = loginBodySchema.safeParse(req.body);

    if (!parsed.success) {
      res
        .status(400)
        .json(errorEnvelope("VALIDATION_FAILED", "email and password are both required.", correlationId));
      return;
    }

    const { email, password } = parsed.data;
    const grantResult = await signInWithPassword(email, password);

    if (!grantResult.ok) {
      await insertLoginAudit(sql, { userId: null, emailTried: email, outcome: "INVALID_CREDENTIALS" });
      logger.info("login refused", { correlationId, outcome: "refused", code: "INVALID_CREDENTIALS" });
      res.status(401).json(errorEnvelope("INVALID_CREDENTIALS", "email or password is incorrect", correlationId));
      return;
    }

    const user = await findUserBySupabaseId(sql, grantResult.supabaseUserId);
    const outcome = decideLoginOutcome(user);

    if (outcome.decision === "INVALID_CREDENTIALS") {
      await insertLoginAudit(sql, { userId: null, emailTried: email, outcome: "INVALID_CREDENTIALS" });
      logger.info("login refused", { correlationId, outcome: "refused", code: "INVALID_CREDENTIALS" });
      res.status(401).json(errorEnvelope("INVALID_CREDENTIALS", "email or password is incorrect", correlationId));
      return;
    }

    if (outcome.decision === "DEACTIVATED_ACCOUNT") {
      await insertLoginAudit(sql, { userId: outcome.userId, emailTried: email, outcome: "DEACTIVATED_ACCOUNT" });
      logger.info("login refused", { correlationId, outcome: "refused", code: "ACCOUNT_DEACTIVATED" });
      res
        .status(403)
        .json(
          errorEnvelope(
            "ACCOUNT_DEACTIVATED",
            "This account has been deactivated. Contact an administrator.",
            correlationId
          )
        );
      return;
    }

    const role = await findRoleForUser(sql, outcome.userId);
    const loginTime = new Date();
    await recordSuccessfulLogin(sql, outcome.userId, loginTime);
    await insertLoginAudit(sql, { userId: outcome.userId, emailTried: email, outcome: "SUCCESS" });

    logger.info("login succeeded", { correlationId, userId: outcome.userId, outcome: "success" });

    res.status(200).json({
      user: { id: outcome.userId, email, role },
      lastLoginAt: loginTime.toISOString(),
    });
  });

  router.post("/api/v1/auth/logout", async (req, res) => {
    const correlationId = req.header("x-correlation-id") ?? null;
    const header = req.header("authorization");

    if (!header?.startsWith("Bearer ")) {
      res.status(401).json(errorEnvelope("UNAUTHENTICATED", "A valid bearer token is required.", correlationId));
      return;
    }

    await revokeSession(header.slice("Bearer ".length));
    logger.info("logout completed", { correlationId, outcome: "success" });
    res.status(204).send();
  });

  return router;
}
