import type { Sql } from "postgres";

/**
 * A scripted stand-in for the `postgres` client, for tests of code that builds a
 * query and reads its rows: no connection, no Postgres. A query is a tagged
 * template; it runs when awaited, finds the first step whose pattern matches the
 * statement's text, and answers that step's rows (or throws its error). Nested
 * fragments (`sql\`...\``, `sql.unsafe`, `sql(list)`) are inlined into the text,
 * so a step matches what would be sent. An unscripted statement throws, so a
 * query the code should not run fails the test instead of passing silently.
 */

type Row = Record<string, unknown>;

export interface Step {
  match: RegExp;
  rows?: Row[] | ((values: unknown[]) => Row[]);
  error?: unknown;
}

export interface Call {
  text: string;
  values: unknown[];
}

const FRAGMENT = Symbol("fragment");

interface Fragment {
  [FRAGMENT]: true;
  text: string;
  values: unknown[];
}

const isFragment = (value: unknown): value is Fragment => typeof value === "object" && value !== null && FRAGMENT in value;
const fragment = (text: string, values: unknown[] = []): Fragment => ({ [FRAGMENT]: true, text, values });

export function scriptedSql(steps: Step[]) {
  const calls: Call[] = [];

  const render = (strings: readonly string[], values: unknown[]): Call => {
    let text = "";
    const flat: unknown[] = [];
    strings.forEach((part, i) => {
      text += part;
      if (i >= values.length) return;
      const value = values[i];
      if (isFragment(value)) {
        text += value.text;
        flat.push(...value.values);
      } else {
        text += "?";
        flat.push(value);
      }
    });
    return { text: text.replace(/\s+/g, " ").trim(), values: flat };
  };

  const query = (call: Call) => {
    const asFragment = fragment(call.text, call.values);
    return Object.assign(asFragment, {
      then(resolve: (rows: Row[]) => unknown, reject: (error: unknown) => unknown) {
        calls.push(call);
        const step = steps.find((candidate) => candidate.match.test(call.text));
        if (!step) return Promise.reject(new Error(`unscripted query: ${call.text}`)).then(resolve, reject);
        if (step.error) return Promise.reject(step.error).then(resolve, reject);
        const rows = typeof step.rows === "function" ? step.rows(call.values) : (step.rows ?? []);
        return Promise.resolve(rows).then(resolve, reject);
      },
    });
  };

  const sql = ((first: unknown, ...rest: unknown[]) => {
    if (Array.isArray(first) && "raw" in first) return query(render(first as string[], rest));
    // sql("table") names an identifier, sql([ids]) is a list for IN.
    if (typeof first === "string") return fragment(`"${first}"`);
    return fragment("(?)", [first]);
  }) as unknown as Sql & { calls: Call[] };

  Object.assign(sql, {
    unsafe: (text: string) => fragment(text),
    json: (value: unknown) => value,
    begin: async (work: (tx: Sql) => Promise<unknown>) => work(sql),
    calls,
  });
  return sql as Sql & { calls: Call[] };
}

/** A row's date columns arrive as Date objects, as the driver returns them. */
export const at = (iso: string) => new Date(iso);
