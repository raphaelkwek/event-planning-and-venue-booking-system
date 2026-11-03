import { context, SpanKind, SpanStatusCode, trace, type Context, type Span } from "@opentelemetry/api";

/**
 * Spans for postgres.js (porsager). OpenTelemetry's `pg` instrumentation does
 * not cover this driver, so `instrumentSql` wraps the `sql` function instead:
 * a Proxy that starts a CLIENT span for each query when it runs, and a
 * `db.transaction` span around each `begin`, with the transaction's queries as
 * its children. Nothing else about the object changes, so every call site
 * (tagged templates, `sql.json`, `sql.begin`, `tx.savepoint`) is untouched.
 *
 * The span records the statement's text with `$n` in place of every value, so no
 * parameter, token or attendee field can reach a trace (implementation.md §9). A failure
 * records the SQLSTATE and the error's class, never the driver's message, which can echo values.
 * `unsafe()` statements are recorded only when they were given parameters.
 *
 * A query is traced only inside a span (a request, or a consumed message). The
 * outbox relay's polling, the readiness probe and start-up queries have none, and
 * would otherwise each be a root trace of their own.
 */

const TRACER_NAME = "connectsphere.postgres";
const MAX_STATEMENT_LENGTH = 1000;

/** Everything of a postgres.js `Query` this file relies on is the Promise protocol, plus its template parts. */
interface QueryLike extends PromiseLike<unknown> {
  strings?: ArrayLike<string>;
}

const isQuery = (value: unknown): value is QueryLike =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as { then?: unknown }).then === "function" &&
  Array.isArray((value as { strings?: unknown }).strings);

/** The statement with `$1`, `$2`... where the template had values. */
export function statementText(strings: ArrayLike<string>): string {
  let text = strings[0] ?? "";
  for (let i = 1; i < strings.length; i += 1) text += `$${i}${strings[i]}`;
  return text.replace(/\s+/g, " ").trim().slice(0, MAX_STATEMENT_LENGTH);
}

const OPERATION = /^\s*([a-z]+)/i;
const TABLE = /\b(?:from|into|update|join)\s+([a-z_]\w*(?:\.[a-z_]\w*)?)/i;

/** `SELECT event.events`, `INSERT event.outbox`: a name with a bounded number of values. */
export function spanNameFor(statement: string): { name: string; operation?: string; table?: string } {
  const operation = OPERATION.exec(statement)?.[1]?.toUpperCase();
  const table = TABLE.exec(statement)?.[1]?.toLowerCase();
  if (!operation) return { name: "db.query" };
  return { name: table ? `${operation} ${table}` : operation, operation, table };
}

function startQuerySpan(statement: string, parent: Context, recordText: boolean): Span {
  const { name, operation, table } = spanNameFor(statement);
  return trace.getTracer(TRACER_NAME).startSpan(
    name,
    {
      kind: SpanKind.CLIENT,
      attributes: {
        "db.system": "postgresql",
        "db.system.name": "postgresql",
        ...(recordText ? { "db.query.text": statement } : {}),
        ...(operation ? { "db.operation.name": operation } : {}),
        ...(table ? { "db.collection.name": table } : {}),
      },
    },
    parent,
  );
}

/**
 * Marks the span failed with Postgres's SQLSTATE and the error's class only. The driver's message
 * is left out on purpose: Postgres echoes values in it ("Key (email)=(a@b.c) already exists"), and a
 * span must never carry a value (implementation.md §9).
 */
export function failSpan(span: Span, error: unknown): void {
  const name = error instanceof Error ? error.name : "Error";
  span.setStatus({ code: SpanStatusCode.ERROR });
  const sqlState = (error as { code?: unknown } | null)?.code;
  if (typeof sqlState === "string") span.setAttribute("db.response.status_code", sqlState);
  span.setAttribute("error.type", name);
}

/**
 * Starts the span when the query first runs (an `await`, `.then`, `.catch` or
 * `.finally`) and ends it when it settles. A fragment that is only interpolated
 * into another query is never run, and so never makes a span.
 */
function traceQuery(query: QueryLike, parent: Context, recordText = true): void {
  const strings = query.strings!;
  const originalThen = query.then.bind(query) as PromiseLike<unknown>["then"];
  let started = false;
  query.then = ((onFulfilled, onRejected) => {
    if (!started) {
      started = true;
      const span = startQuerySpan(statementText(strings), parent, recordText);
      // The derived promise's handlers both return, so it can never reject unhandled.
      void originalThen(
        (result) => {
          const count = (result as { count?: unknown } | null)?.count;
          if (typeof count === "number") span.setAttribute("db.response.returned_rows", count);
          span.end();
        },
        (error) => {
          failSpan(span, error);
          span.end();
        },
      );
    }
    return originalThen(onFulfilled, onRejected);
  }) as PromiseLike<unknown>["then"];
}

type AnyFunction = (...args: unknown[]) => unknown;

/** A `begin` or `savepoint` argument list with its callback replaced; the callback is always last. */
function withCallback(args: unknown[], wrap: (callback: AnyFunction) => AnyFunction): unknown[] {
  const callback = args[args.length - 1];
  return typeof callback === "function" ? [...args.slice(0, -1), wrap(callback as AnyFunction)] : args;
}

/** Only a real parent span is worth a span of its own; see the note at the top of the file. */
function hasSpan(parent: Context): boolean {
  const spanContext = trace.getSpanContext(parent);
  return spanContext !== undefined && trace.isSpanContextValid(spanContext);
}

function instrument<T extends object>(sql: T, fixedParent?: Context): T {
  const parentOf = () => fixedParent ?? context.active();

  return new Proxy(sql, {
    apply(target, thisArg, args) {
      const result = Reflect.apply(target as unknown as AnyFunction, thisArg, args);
      const parent = parentOf();
      if (isQuery(result) && hasSpan(parent)) traceQuery(result, parent);
      return result;
    },

    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver) as unknown;
      if (typeof value !== "function") return value;

      if (property === "unsafe") {
        return (...args: unknown[]) => {
          const result = (value as AnyFunction).apply(target, args);
          const parent = parentOf();
          if (isQuery(result) && hasSpan(parent)) {
            // unsafe() takes the whole statement as a string, not as template parts. Its text is
            // recorded only when values were passed as parameters: with none, a caller may have
            // built the statement with the values inside it.
            result.strings = [typeof args[0] === "string" ? args[0] : ""];
            const hasParameters = Array.isArray(args[1]) && args[1].length > 0;
            traceQuery(result, parent, hasParameters);
          }
          return result;
        };
      }

      if (property === "begin") {
        return (...args: unknown[]) => runInTransactionSpan(target, value as AnyFunction, args, parentOf());
      }

      if (property === "savepoint") {
        // A savepoint's queries stay children of the transaction's span.
        const parent = parentOf();
        return (...args: unknown[]) =>
          (value as AnyFunction).apply(
            target,
            withCallback(args, (callback) => (inner) => callback(instrument(inner as object, parent))),
          );
      }

      return value;
    },
  });
}

function runInTransactionSpan(target: object, begin: AnyFunction, args: unknown[], parent: Context): Promise<unknown> {
  if (!hasSpan(parent)) return begin.apply(target, args) as Promise<unknown>;

  const span = trace.getTracer(TRACER_NAME).startSpan(
    "db.transaction",
    { kind: SpanKind.CLIENT, attributes: { "db.system": "postgresql", "db.system.name": "postgresql", "db.operation.name": "TRANSACTION" } },
    parent,
  );
  const inside = trace.setSpan(parent, span);

  // `context.with` makes the transaction span the active one for the callback, so a message written
  // to the outbox in it carries this span's `traceparent`; the Proxy's fixed parent covers a pool that
  // runs the callback later, from another async context.
  const wrapped = withCallback(args, (callback) => (tx) => context.with(inside, () => callback(instrument(tx as object, inside))));
  return (begin.apply(target, wrapped) as Promise<unknown>).then(
    (value) => {
      span.end();
      return value;
    },
    (error: unknown) => {
      failSpan(span, error);
      span.end();
      throw error;
    },
  );
}

/**
 * The same `sql`, with its queries and transactions traced. Call it once where
 * the pool is created (`db.ts`); tests that build their own pool can wrap it too.
 */
export function instrumentSql<T extends object>(sql: T): T {
  return instrument(sql);
}
