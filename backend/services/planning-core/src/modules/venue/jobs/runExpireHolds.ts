import { sql } from "../../../shared/db.js";
import { runHoldExpirySweep } from "./expireOverdueHolds.js";

/**
 * `npm run jobs:expire-holds` — runs the L6 hold-expiry sweep once (M4, the
 * fallback when the HoldExpiry workflow can't run) and exits non-zero if any
 * hold could not be expired. Schedule it as often as an expiry may be late,
 * say every minute, like `jobs:complete-events`.
 *
 * The npm script (with `--env-file=.env`) is for local and manual runs. A
 * scheduler should run the compiled
 * `node backend/services/planning-core/dist/modules/venue/jobs/runExpireHolds.js`
 * with its environment injected.
 */
try {
  process.exitCode = await runHoldExpirySweep(sql);
} finally {
  await sql.end().catch(() => {});
}
