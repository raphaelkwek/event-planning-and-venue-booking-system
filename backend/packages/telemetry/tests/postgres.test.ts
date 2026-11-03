import { describe, expect, it } from "vitest";
import { context, SpanKind, trace } from "@opentelemetry/api";
import { parentIdOf, startForTest } from "./support/testTelemetry.js";
import { activeTraceparent, instrumentSql, spanNameFor, statementText } from "../src/index.js";

const t = startForTest("postgres-test");
const tracer = trace.getTracer("test");

/**
 * A postgres.js Query as far as instrumentSql can tell: a Promise subclass (so `await` looks up its `then`,
 * as it does for the real one) carrying the template's strings.
 */
class FakeQuery extends Promise<unknown> {
  strings: string[] = [];
  static get [Symbol.species]() {
    return Promise;
  }
}

function fakeQuery(strings: readonly string[], outcome: "ok" | "fail" = "ok", count = 3) {
  const query = new FakeQuery((resolve, reject) => {
    if (outcome === "ok") resolve(Object.assign([], { count }));
    else reject(Object.assign(new Error("duplicate key"), { code: "23505" }));
  });
  // A rejected promise nobody awaits would fail the run; an awaited one is handled by the caller.
  query.catch(() => undefined);
  query.strings = Array.from(strings);
  return query;
}

/** The part of a postgres.js `sql` that is traced: a tag, begin, savepoint, unsafe, and helpers that pass through. */
function fakeSql() {
  const tag = (strings: TemplateStringsArray) => fakeQuery(strings);
  return Object.assign(tag, {
    json: (value: unknown) => ({ json: value }),
    unsafe: (text: string) => fakeQuery([text]),
    begin: async (fn: (tx: unknown) => unknown) => fn(fakeTx()),
    savepoint: async (fn: (tx: unknown) => unknown) => fn(fakeTx()),
    end: async () => undefined,
  });
}

function fakeTx() {
  const tag = (strings: TemplateStringsArray) => fakeQuery(strings);
  return Object.assign(tag, {
    json: (value: unknown) => ({ json: value }),
    savepoint: async (fn: (tx: unknown) => unknown) => fn(fakeTx()),
  });
}

/** Runs `work` as a request would: with a server span active. */
async function inRequest<T>(work: () => Promise<T>): Promise<T> {
  const span = tracer.startSpan("request", { kind: SpanKind.SERVER });
  try {
    return await context.with(trace.setSpan(context.active(), span), work);
  } finally {
    span.end();
  }
}

type AnySql = ReturnType<typeof fakeSql>;

describe("the statement text", () => {
  it("EN-08-T2 puts $n where a value was, collapses whitespace and bounds the length", () => {
    expect(statementText(["select a\n  from t where id = ", " and x = ", ""])).toBe("select a from t where id = $1 and x = $2");
    expect(statementText(["x".repeat(5000)])).toHaveLength(1000);
    expect(statementText([])).toBe("");
  });

  it("names a span for its operation and table, and falls back to the operation or a plain name", () => {
    expect(spanNameFor("select id from event.events where id = $1")).toMatchObject({ name: "SELECT event.events", operation: "SELECT", table: "event.events" });
    expect(spanNameFor("insert into venue.outbox (a) values ($1)").name).toBe("INSERT venue.outbox");
    expect(spanNameFor("update event.events set a = $1").name).toBe("UPDATE event.events");
    expect(spanNameFor("select pg_try_advisory_xact_lock(hashtext($1))").name).toBe("SELECT");
    expect(spanNameFor("select * from $1 where a = $2").name).toBe("SELECT");
    expect(spanNameFor("$$$").name).toBe("db.query");
  });
});

describe("a traced sql", () => {
  it("EN-08-T2 makes one CLIENT span per query that runs, a child of the span active when it was written", async () => {
    t.spans.reset();
    const sql = instrumentSql(fakeSql()) as AnySql;
    await inRequest(async () => {
      await sql`select id from event.events where id = ${"abc"}`;
    });

    const [request] = t.byName("request");
    const [query] = t.byName("SELECT event.events");
    expect(query!.kind).toBe(SpanKind.CLIENT);
    expect(parentIdOf(query!)).toBe(request!.spanContext().spanId);
    expect(query!.attributes["db.system"]).toBe("postgresql");
    expect(query!.attributes["db.operation.name"]).toBe("SELECT");
    expect(query!.attributes["db.collection.name"]).toBe("event.events");
    expect(query!.attributes["db.response.returned_rows"]).toBe(3);
  });

  it("EN-08-T2 makes no span for a fragment that is only interpolated into another query", async () => {
    t.spans.reset();
    const sql = instrumentSql(fakeSql()) as AnySql;
    await inRequest(async () => {
      void sql`where id = ${"abc"}`;
      await sql`select 1`;
    });
    expect(t.finished().filter((s) => s.kind === SpanKind.CLIENT)).toHaveLength(1);
  });

  it("EN-08-T2 makes no span for a query with no span around it, such as the outbox relay's polling", async () => {
    t.spans.reset();
    const sql = instrumentSql(fakeSql()) as AnySql;
    await sql`select 1`;
    await sql.begin(async (tx) => (tx as AnySql)`select 2`);
    expect(t.finished()).toHaveLength(0);
  });

  it("EN-08-T2 passes helpers such as sql.json and values through unchanged", () => {
    const sql = instrumentSql(fakeSql()) as AnySql;
    expect(sql.json({ a: 1 })).toEqual({ json: { a: 1 } });
  });

  it("EN-08-T2 records a failed query as an error with Postgres's SQLSTATE, and the caller still gets the error", async () => {
    t.spans.reset();
    const failing = Object.assign((strings: TemplateStringsArray) => fakeQuery(strings, "fail"), {});
    const sql = instrumentSql(failing);
    await inRequest(async () => {
      await expect(sql`insert into event.events (a) values (${1})`).rejects.toThrow("duplicate key");
    });
    const [query] = t.byName("INSERT event.events");
    expect(query!.status.code).toBe(2);
    expect(query!.attributes["db.response.status_code"]).toBe("23505");
    expect(query!.attributes["error.type"]).toBe("Error");
    // Postgres's message can echo a value ("Key (email)=(...) already exists"), so a span never carries it.
    expect(query!.status.message).toBeUndefined();
    expect(query!.events).toHaveLength(0);
    expect(JSON.stringify([query!.status, query!.attributes, query!.events])).not.toContain("duplicate key");
  });

  it("EN-08-T2 traces a query run with .catch or .finally, and ends its span once however often it is awaited", async () => {
    t.spans.reset();
    const sql = instrumentSql(fakeSql()) as AnySql;
    await inRequest(async () => {
      const query = sql`select 1`;
      await query;
      await query;
      await sql`select 2`.finally(() => undefined);
      await sql`select 3`.catch(() => undefined);
    });
    expect(t.byName("SELECT")).toHaveLength(3);
  });

  it("EN-08-T2 traces unsafe(), recording its text only when it was given parameters", async () => {
    t.spans.reset();
    const sql = instrumentSql(fakeSql()) as AnySql & { unsafe(text: string, args?: unknown[]): PromiseLike<unknown> };
    await inRequest(async () => {
      await sql.unsafe("truncate event.events");
      await sql.unsafe("delete from event.events where id = $1", ["x"]);
      // No parameters: the caller may have put the values in the text.
      await sql.unsafe("update event.events set name = 'secret-name'");
    });
    const [truncate] = t.byName("TRUNCATE");
    const [deleted] = t.byName("DELETE event.events");
    const [updated] = t.byName("UPDATE event.events");
    expect(truncate!.attributes["db.query.text"]).toBeUndefined();
    expect(updated!.attributes["db.query.text"]).toBeUndefined();
    expect(JSON.stringify(updated!.attributes)).not.toContain("secret-name");
    expect(deleted!.attributes["db.query.text"]).toBe("delete from event.events where id = $1");
  });
});

describe("a traced transaction", () => {
  it("EN-08-T2 wraps a transaction's queries in one db.transaction span and makes them its children", async () => {
    t.spans.reset();
    const sql = instrumentSql(fakeSql()) as AnySql;
    await inRequest(async () => {
      await sql.begin(async (tx) => {
        await (tx as AnySql)`select id from event.events`;
        await (tx as AnySql)`update event.events set name = ${"n"}`;
      });
    });

    const [request] = t.byName("request");
    const [transaction] = t.byName("db.transaction");
    expect(parentIdOf(transaction!)).toBe(request!.spanContext().spanId);
    for (const name of ["SELECT event.events", "UPDATE event.events"]) {
      const [query] = t.byName(name);
      expect(parentIdOf(query!)).toBe(transaction!.spanContext().spanId);
    }
  });

  it("EN-08-T3 makes the transaction the active span inside it, so an outbox row carries its traceparent", async () => {
    t.spans.reset();
    const sql = instrumentSql(fakeSql()) as AnySql;
    let insideTransaction: string | undefined;
    await inRequest(async () => {
      await sql.begin(async () => {
        insideTransaction = activeTraceparent();
      });
    });
    const [transaction] = t.byName("db.transaction");
    expect(insideTransaction).toBe(`00-${transaction!.spanContext().traceId}-${transaction!.spanContext().spanId}-01`);
  });

  it("EN-08-T2 keeps a savepoint's queries under the transaction", async () => {
    t.spans.reset();
    const sql = instrumentSql(fakeSql()) as AnySql;
    await inRequest(async () => {
      await sql.begin(async (tx) => {
        await (tx as unknown as { savepoint(fn: (inner: unknown) => Promise<unknown>): Promise<unknown> }).savepoint(async (inner) => {
          await (inner as AnySql)`insert into change.requests (a) values (${1})`;
        });
      });
    });
    const [transaction] = t.byName("db.transaction");
    const [insert] = t.byName("INSERT change.requests");
    expect(parentIdOf(insert!)).toBe(transaction!.spanContext().spanId);
  });

  it("EN-08-T2 marks the transaction failed and rethrows when it rolls back", async () => {
    t.spans.reset();
    const sql = instrumentSql(fakeSql()) as AnySql;
    await inRequest(async () => {
      await expect(
        sql.begin(async () => {
          throw Object.assign(new Error("deadlock detected"), { code: "40P01" });
        }),
      ).rejects.toThrow("deadlock detected");
    });
    const [transaction] = t.byName("db.transaction");
    expect(transaction!.status.code).toBe(2);
    expect(transaction!.attributes["db.response.status_code"]).toBe("40P01");
  });

  it("EN-08-T2 keeps a transaction's queries under it even when the callback runs later, from another async context", async () => {
    t.spans.reset();
    const deferred = Object.assign((strings: TemplateStringsArray) => fakeQuery(strings), {
      // A saturated pool runs the callback later, from whichever context released a connection.
      begin: async (fn: (tx: unknown) => unknown) => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return context.with(context.active(), () => fn(fakeTx()));
      },
    });
    const sql = instrumentSql(deferred);
    await inRequest(async () => {
      await sql.begin(async (tx) => {
        await (tx as AnySql)`select 1 from a.b`;
      });
    });
    const [transaction] = t.byName("db.transaction");
    const [query] = t.byName("SELECT a.b");
    expect(parentIdOf(query!)).toBe(transaction!.spanContext().spanId);
  });
});
