import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "dotenv";
import { Connection } from "@temporalio/client";
import { connectionOptionsFor, temporalSettingsFromEnv } from "../services/planning-core/src/temporal/domain/settings.js";

// Read-only: checks authentication and namespace access without starting a
// worker, consuming Kafka messages or running activities against the database.
// An optional env-file path supports worktrees without copying credentials.
const envPath = resolve(process.argv[2] ?? ".env");
let vars: Record<string, string>;
try {
  vars = Object.fromEntries(Object.entries(parse(readFileSync(envPath, "utf8"))).filter(([key]) => key.startsWith("TEMPORAL_")));
} catch {
  console.error("Cannot read the env file. Run from the repo root or pass its path: npm run temporal:check -- /path/to/.env");
  process.exit(1);
}

const settings = temporalSettingsFromEnv(vars);
if (settings.status !== "configured") {
  console.error(settings.status === "invalid" ? settings.problems.join("\n") : "TEMPORAL_ADDRESS is not configured.");
  process.exit(1);
}

let connection: Connection | undefined;
try {
  connection = await Connection.connect({ ...connectionOptionsFor(settings), connectTimeout: "10s" });
  await connection.withDeadline(Date.now() + 10_000, () =>
    connection!.workflowService.describeNamespace({ namespace: settings.namespace }),
  );
  console.log("Temporal connection and namespace access verified. No workflows started.");
} catch {
  // SDK errors can contain connection metadata; do not print raw errors.
  console.error("Temporal check failed. Check network access, TEMPORAL_ADDRESS, TEMPORAL_NAMESPACE and API-key permissions.");
  process.exitCode = 1;
} finally {
  await connection?.close();
}
