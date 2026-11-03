import { describe, expect, it } from "vitest";
import { decodeCursor, DEFAULT_PAGE_SIZE, encodeCursor, MAX_PAGE_SIZE, readLimit } from "../../../src/modules/event/domain/pagination.js";

/** L7 — the page size and the cursor of the list of requests (implementation.md section 5). */

const ID = "ae700000-0000-4000-8000-000000000001";
const SORT_AT = "2026-11-02T10:15:30.123456Z";

describe("readLimit", () => {
  it("gives the default of 25 when no limit is asked for", () => {
    expect(DEFAULT_PAGE_SIZE).toBe(25);
    expect(readLimit(undefined)).toEqual({ ok: true, limit: 25 });
  });

  it("accepts a whole number from 1 to 100, both ends included", () => {
    expect(MAX_PAGE_SIZE).toBe(100);
    expect(readLimit("1")).toEqual({ ok: true, limit: 1 });
    expect(readLimit("50")).toEqual({ ok: true, limit: 50 });
    expect(readLimit("100")).toEqual({ ok: true, limit: 100 });
  });

  it.each(["0", "101", "-1", "2.5", "ten", "", " 5", "5 ", "1e1", "0x10"])("refuses %j", (raw) => {
    expect(readLimit(raw)).toEqual({ ok: false });
  });

  it("refuses what a query string can carry besides one text: a repeated or nested parameter", () => {
    expect(readLimit(["5", "6"])).toEqual({ ok: false });
    expect(readLimit({ a: "5" })).toEqual({ ok: false });
    expect(readLimit(5)).toEqual({ ok: false });
  });
});

describe("cursors", () => {
  it("round-trips the sort time and id", () => {
    expect(decodeCursor(encodeCursor({ sortAt: SORT_AT, id: ID }))).toEqual({ sortAt: SORT_AT, id: ID });
  });

  it("encodes only those two fields, as URL-safe text", () => {
    const text = encodeCursor({ sortAt: SORT_AT, id: ID, extra: "dropped" } as never);
    expect(text).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(JSON.parse(Buffer.from(text, "base64url").toString("utf8"))).toEqual({ sortAt: SORT_AT, id: ID });
  });

  const encoded = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");

  it.each([
    ["text that is not base64 JSON", "%%%not-a-cursor%%%"],
    ["JSON that is not an object", encoded("text")],
    ["null", encoded(null)],
    ["a missing sort time", encoded({ id: ID })],
    ["a sort time that is not text", encoded({ sortAt: 5, id: ID })],
    ["a sort time without microseconds", encoded({ sortAt: "2026-11-02T10:15:30Z", id: ID })],
    ["a sort time with trailing text", encoded({ sortAt: `${SORT_AT}; drop table`, id: ID })],
    ["a missing id", encoded({ sortAt: SORT_AT })],
    ["an id that is not text", encoded({ sortAt: SORT_AT, id: 5 })],
    ["an id that is not a UUID", encoded({ sortAt: SORT_AT, id: "not-a-uuid" })],
    ["an id with trailing text", encoded({ sortAt: SORT_AT, id: `${ID}x` })],
  ])("refuses %s", (_name, text) => {
    expect(decodeCursor(text)).toBeNull();
  });

  it("accepts an id in capitals", () => {
    expect(decodeCursor(encoded({ sortAt: SORT_AT, id: ID.toUpperCase() }))).toEqual({ sortAt: SORT_AT, id: ID.toUpperCase() });
  });
});
