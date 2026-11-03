import "dotenv/config";
import postgres from "postgres";
import { verificationReport } from "../src/modules/event/domain/eventStream.js";
import { verifyEventStore } from "../src/modules/event/repo/eventStreamVerification.js";

/**
 * EN-03 (ADR-0007) — the event store's tamper check:
 *
 *   npm run event-store:verify
 *
 * Recomputes every event's hash chain from the stored entries, and checks that
 * every row of the history projection matches its stream entry. Exits 0 when
 * all is intact, and 1 at the first broken link or mismatched row, which it
 * names. It only reads. It checks whichever database DATABASE_URL names (the
 * root .env, or the environment): CI runs it on the integration job's
 * throwaway Postgres, before and after editing one entry.
 */

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(2);
}

// The transaction pooler cannot keep prepared statements (src/shared/db.ts).
const sql = postgres(url, { max: 1, prepare: false });

try {
  const report = verificationReport(await verifyEventStore(sql));
  for (const line of report.lines) (report.ok ? console.log : console.error)(line);
  process.exitCode = report.ok ? 0 : 1;
} finally {
  await sql.end();
}
