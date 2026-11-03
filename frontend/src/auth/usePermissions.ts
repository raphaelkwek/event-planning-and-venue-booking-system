import { useEffect, useState } from "react";
import { ApiError } from "../api/client.js";
import { checkPermissions, type PermissionCheck } from "../api/permissions.js";

/**
 * EN-07: the permissions the staff console asks about once per session (one
 * per screen), answered by the server's Cerbos policies. Until they arrive
 * nothing permission-bound is offered, and if they can't be read nothing is:
 * the console fails closed, as the server does.
 */
export type PermissionState =
  | { status: "loading" }
  | { status: "ready"; allowed: ReadonlySet<string> }
  | { status: "failed"; message: string };

export function usePermissions(token: string | null, checks: readonly PermissionCheck[]): PermissionState {
  const [state, setState] = useState<PermissionState>({ status: "loading" });

  useEffect(() => {
    if (!token) return;
    let live = true;
    setState({ status: "loading" });
    checkPermissions(token, [...checks])
      .then((allowed) => live && setState({ status: "ready", allowed }))
      .catch((error: unknown) => {
        if (!live) return;
        const message =
          error instanceof ApiError ? error.message : "Your permissions could not be checked. Reload the page to try again.";
        setState({ status: "failed", message });
      });
    return () => {
      live = false;
    };
    // `checks` is a module-level constant, so only a new token (another sign-in) asks again.
  }, [token, checks]);

  return state;
}
