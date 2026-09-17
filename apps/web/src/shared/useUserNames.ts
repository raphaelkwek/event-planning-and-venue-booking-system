import { useCallback, useEffect, useState } from "react";
import { lookupUsers } from "../api/users.js";

/**
 * Turns user ids into the names people recognise (B1, D1). The services store
 * ids only (plan.md §4); names come from Identity, fetched once per id and kept
 * for the rest of the session.
 *
 * A user with no display name is shown by email. Until a name has loaded, or if
 * the lookup fails, the id itself is shown — a name is a courtesy, and failing to
 * fetch one must not stop the screen working.
 */
const names = new Map<string, string>();

export function useUserNames(token: string, ids: (string | null | undefined)[]) {
  const [, setVersion] = useState(0);
  const wanted = [...new Set(ids.filter((id): id is string => Boolean(id)))].sort();
  const key = wanted.join(",");

  useEffect(() => {
    const missing = wanted.filter((id) => !names.has(id));
    if (missing.length === 0) return;

    let active = true;
    lookupUsers(token, missing)
      .then((users) => {
        for (const user of users) names.set(user.id, user.displayName ?? user.email);
        if (active) setVersion((version) => version + 1);
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
    // `key` stands in for `wanted`, which is a new array on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, key]);

  return useCallback((id: string | null | undefined) => (id ? (names.get(id) ?? id) : null), []);
}
