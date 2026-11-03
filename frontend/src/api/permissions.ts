import { request } from "./client.js";

/**
 * EN-07 (ADR-0010): what the signed-in role may do, from the Cerbos policies the
 * server enforces. The console holds no list of roles per screen: it asks
 * planning-core's POST /api/v1/permissions/check, which asks the policy decision
 * point for the verified caller, and offers only what comes back allowed.
 */

/** A resource kind in policies/resources/. */
export type PolicyKind = "event" | "venue" | "booking_request" | "equipment_type" | "equipment_request_line" | "registration" | "user";

export interface PermissionCheck {
  kind: PolicyKind;
  action: string;
}

export interface PermissionResult extends PermissionCheck {
  allowed: boolean;
  reach: "ALWAYS" | "CONDITIONAL" | "NEVER";
}

export const permissionKey = (check: PermissionCheck) => `${check.kind}:${check.action}`;

/** The keys (`kind:action`) of the checks the policies allow the caller. */
export async function checkPermissions(token: string, checks: PermissionCheck[]): Promise<Set<string>> {
  if (checks.length === 0) return new Set();
  const { results } = await request<{ results: PermissionResult[] }>("/identity/api/v1/permissions/check", {
    method: "POST",
    token,
    body: { checks },
  });
  return new Set(results.filter((result) => result.allowed).map(permissionKey));
}
