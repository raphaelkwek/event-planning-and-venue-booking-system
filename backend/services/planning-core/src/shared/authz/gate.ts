import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { ErrorCode } from "@connectsphere/contracts";
import { logger } from "../logger.js";
import { pdp, PolicyUnavailableError } from "./pdp.js";

/**
 * A2 through the policies (EN-07, ADR-0010). A route names the policy resource
 * kind and action it performs, never a list of roles, and this gate asks the
 * policy decision point whether the caller's role may ever take that action:
 *
 * - never (no rule grants it to the role): 403 ROLE_NOT_AUTHORISED, as A2 says;
 * - always, or only for related records (owner, assigned coordinator, the
 *   venue's staff): the request goes on, and the record's own scope (A3, A4,
 *   enforced again by row-level security) decides which records it reaches;
 * - no answer: 503 POLICY_UNAVAILABLE. It fails closed, never open.
 *
 * Cerbos answers who; each module's domain code still answers when.
 */

/** The resource kinds planning-core asks about; each is a file in policies/resources/. */
export const POLICY_KINDS = ["event", "venue", "booking_request", "equipment_type", "equipment_request_line", "user"] as const;
export type PolicyKind = (typeof POLICY_KINDS)[number];

export interface Permission {
  /** A resource kind in policies/resources/, e.g. "event". */
  kind: PolicyKind;
  /** One of that policy's actions, e.g. "approve". */
  action: string;
}

/** Sends the module's own error envelope (implementation.md §5). */
export type Refusal = (req: Request, res: Response, status: number, code: ErrorCode, message: string) => void;

export const ROLE_NOT_AUTHORISED_MESSAGE = "Your role is not authorised to use this function.";
export const POLICY_UNAVAILABLE_MESSAGE =
  "Your permissions could not be checked because the permission service is unavailable. Nothing was changed.";

/** A gate carries its permission, so the generated matrix (EN-07.3) can read it off the router. */
export type PermissionGate = RequestHandler & { readonly permission: Permission };

interface ActorLike {
  actor?: { userId: string; role: string };
}

export function permissionGate(permission: Permission, refusal: Refusal): PermissionGate {
  const gate = async (req: Request, res: Response, next: NextFunction) => {
    const actor = (req as Request & ActorLike).actor;
    if (!actor) {
      next(new Error(`The ${permission.kind} ${permission.action} gate ran before the caller was resolved.`));
      return;
    }
    try {
      const reach = await pdp.reach({ id: actor.userId, role: actor.role }, permission.kind, permission.action);
      if (reach === "NEVER") {
        refusal(req, res, 403, "ROLE_NOT_AUTHORISED", ROLE_NOT_AUTHORISED_MESSAGE);
        return;
      }
      next();
    } catch (error) {
      if (!(error instanceof PolicyUnavailableError)) {
        next(error);
        return;
      }
      logger.error("permission check failed closed", {
        correlationId: req.header("x-correlation-id") ?? null,
        code: "POLICY_UNAVAILABLE",
        cause: error.message,
      });
      refusal(req, res, 503, "POLICY_UNAVAILABLE", POLICY_UNAVAILABLE_MESSAGE);
    }
  };
  return Object.assign(gate, { permission: Object.freeze({ ...permission }) });
}
