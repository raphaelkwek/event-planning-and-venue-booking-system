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

const LOADING: PermissionState = { status: "loading" };

/**
 * The answer is kept with the token it was asked for, so the next person to sign in on this tab
 * never sees, even for one render, the screens the previous person's role was allowed (A1).
 */
export function usePermissions(token: string | null, checks: readonly PermissionCheck[]): PermissionState {
  const [answer, setAnswer] = useState<{ token: string; state: PermissionState } | null>(null);

  useEffect(() => {
    if (!token) return;
    let live = true;
    checkPermissions(token, [...checks])
      .then((allowed) => live && setAnswer({ token, state: { status: "ready", allowed } }))
      .catch((error: unknown) => {
        if (!live) return;
        const message =
          error instanceof ApiError ? error.message : "Your permissions could not be checked. Reload the page to try again.";
        setAnswer({ token, state: { status: "failed", message } });
      });
    return () => {
      live = false;
    };
    // `checks` is a module-level constant, so only a new token (another sign-in) asks again.
  }, [token, checks]);

  return answer && answer.token === token ? answer.state : LOADING;
}
