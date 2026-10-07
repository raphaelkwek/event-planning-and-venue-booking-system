import { sql } from "../../../shared/db.js";
import { runCompletionSweep } from "./completeEvents.js";

/**
 * `npm run jobs:complete-events` — runs the F1 completion sweep once and exits
 * non-zero if any event could not be completed. The scheduler replaces this
 * trigger when it exists; the sweep itself does not change.
 *
 * The npm script (with `--env-file=.env`) is for local and manual runs. A
 * scheduler should run the compiled
 * `node backend/services/planning-core/dist/modules/event/jobs/runCompleteEvents.js`
 * with its environment injected: `--env-file` fails when the file is absent,
 * and tsx is a dev dependency.
 */
try {
  process.exitCode = await runCompletionSweep(sql);
} finally {
  await sql.end().catch(() => {});
}
