import postgres from "postgres";
import { isThrowawayDatabase } from "../tests/support/race.js";

/**
 * EN-03-T18 — CI's proof that `npm run event-store:verify` catches an edited
 * entry. Edits the first stream entry's data, by event and version, the way
 * someone who can switch the append-only trigger off could, and prints which
 * entry it edited so the CI step can check the verify output names it.
 *
 * Refuses any database but this machine's own: it runs only on the
 * integration job's throwaway Postgres, never the team's shared one.
 */

const url = process.env.DATABASE_URL ?? "";
if (!isThrowawayDatabase(url)) {
  console.error("Refusing: DATABASE_URL must be this machine's own throwaway Postgres.");
  process.exit(2);
}

const sql = postgres(url, { max: 1, prepare: false });

try {
  const edited = await sql.begin(async (tx) => {
    // Skips the triggers for this transaction only. A superuser may do this,
    // which is why the hash chain exists: it still shows the edit.
    await tx`set local session_replication_role = replica`;
    const [entry] = await tx<{ aggregate_id: string; version: number }[]>`
      update event.event_stream
      set data = jsonb_set(data, '{triggeringAction}', '"EDITED_AFTER_THE_FACT"')
      where id = (select id from event.event_stream order by aggregate_id, version limit 1)
      returning aggregate_id, version
    `;
    return entry;
  });
  if (!edited) {
    console.error("The stream is empty, so there was nothing to edit.");
    process.exitCode = 1;
  } else {
    console.log(`event ${edited.aggregate_id} version ${edited.version}`);
  }
} finally {
  await sql.end();
}
