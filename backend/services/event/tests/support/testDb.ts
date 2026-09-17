import postgres from "postgres";

/** Matches src/db.ts: the transaction pooler cannot keep prepared statements. */
export function testDb() {
  return postgres(process.env.DATABASE_URL!, { max: 2, prepare: false });
}
