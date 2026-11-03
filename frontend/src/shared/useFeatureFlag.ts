import { useEffect, useState } from "react";
import { getFeatureFlags, type FeatureFlags } from "../api/featureFlags.js";

/**
 * EN-15 — whether a flag is on, for hiding or disabling an action. The flag is on until the server
 * says otherwise, and stays on if the read fails: the server enforces the flag on the action
 * itself, so a wrong guess here costs one refused click, never a bypass.
 */
export function useFeatureFlag(key: keyof FeatureFlags, token: string): boolean {
  const [on, setOn] = useState(true);

  useEffect(() => {
    let current = true;
    getFeatureFlags(token)
      .then((flags) => {
        if (current) setOn(flags[key] !== false);
      })
      .catch(() => {
        if (current) setOn(true);
      });
    return () => {
      current = false;
    };
  }, [key, token]);

  return on;
}
