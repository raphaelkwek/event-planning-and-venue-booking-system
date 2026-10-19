import postgres, { type TransactionSql } from "postgres";

/**
 * EN-02.3's race harness (implementation.md §8.1, ADR-0006). It opens one
 * database connection per attempt, starts a transaction on each, holds every
 * transaction at a barrier until all of them are open, then lets them all run
 * their attempt at once. That is as close to "at the same instant" as a test
 * can get, and it's what N1's and Q1's "exactly one succeeds" means.
 *
 * Races open dozens of connections and write rows, so they only ever run
 * against a database the test run owns: CI's throwaway Postgres (EN-06.1), or
 * your own local one. Never the team's shared Supabase project.
 */

/** True when DATABASE_URL is this machine's own Postgres, as in CI. */
export function isThrowawayDatabase(url = process.env.DATABASE_URL ?? ""): boolean {
  try {
    const { protocol, hostname } = new URL(url);
    return protocol.startsWith("postgres") && ["127.0.0.1", "localhost", "::1", "[::1]"].includes(hostname);
  } catch {
    return false;
  }
}

/** How long attempts wait at the barrier for the rest before the race is called off. */
const BARRIER_TIMEOUT_MS = 15_000;

function barrier(parties: number): () => Promise<void> {
  let arrived = 0;
  let release!: () => void;
  const open = new Promise<void>((resolve) => (release = resolve));
  const timeout = new Promise<never>((_, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`race barrier: only ${arrived} of ${parties} attempts arrived`)),
      BARRIER_TIMEOUT_MS,
    );
    void open.then(() => clearTimeout(timer));
  });
  return () => {
    arrived += 1;
    if (arrived === parties) release();
    return Promise.race([open, timeout]);
  };
}

/**
 * Runs `attempt` once per index, each in its own transaction on its own
 * connection, all released together. Returns every outcome in index order.
 */
export async function race<T>(
  attempts: number,
  attempt: (tx: TransactionSql, index: number) => Promise<T>,
): Promise<PromiseSettledResult<T>[]> {
  const url = process.env.DATABASE_URL;
  if (!url || !isThrowawayDatabase(url)) {
    throw new Error("race(): DATABASE_URL must be a throwaway local Postgres, never the shared database");
  }

  const connections = Array.from({ length: attempts }, () => postgres(url, { max: 1, prepare: false }));
  const arrive = barrier(attempts);
  try {
    return await Promise.allSettled(
      connections.map((sql, index) =>
        sql.begin(async (tx) => {
          // A statement first, so the connection and transaction are really open
          // before this attempt counts as waiting at the barrier.
          await tx`select 1`;
          await arrive();
          return attempt(tx, index);
        }),
      ),
    );
  } finally {
    await Promise.all(connections.map((sql) => sql.end()));
  }
}

/** The successful outcomes' values. */
export const winners = <T>(results: PromiseSettledResult<T>[]): T[] =>
  results.filter((r): r is PromiseFulfilledResult<T> => r.status === "fulfilled").map((r) => r.value);

/** The failed outcomes' reasons. */
export const losers = <T>(results: PromiseSettledResult<T>[]): unknown[] =>
  results.filter((r): r is PromiseRejectedResult => r.status === "rejected").map((r) => r.reason);
