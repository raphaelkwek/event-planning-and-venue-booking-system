import type { PendingQuery, Row } from "postgres";

/** A piece of SQL spliced into a statement: column assignments or a condition. */
export type Fragment = PendingQuery<Row[]>;
