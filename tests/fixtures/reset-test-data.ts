import "dotenv/config";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const here = dirname(fileURLToPath(import.meta.url));

async function run() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }

  const sql = postgres(databaseUrl, { max: 1, prepare: false });
  const before = await sql`
    select count(*)::int as n from event.events
    where owner_id in ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000007')
  `;

  await sql.unsafe(readFileSync(join(here, "reset-test-data.sql"), "utf8"));
  await sql.end();

  console.log(`reset: removed ${before[0]!.n} test request(s) and their history, clarifications and assignments`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
