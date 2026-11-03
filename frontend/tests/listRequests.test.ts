import { afterEach, describe, expect, it, vi } from "vitest";
import { listRequests } from "../src/api/events.js";

/**
 * L7 — the server pages GET /events, and the screens still get the whole list: listRequests asks for
 * the largest page and follows nextCursor until there is none.
 */

const item = (id: string) => ({ id, kind: "EVENT", name: `Event ${id}`, status: "SUBMITTED" });
const reply = (items: unknown[], nextCursor: string | null) =>
  new Response(JSON.stringify({ items, nextCursor }), { status: 200, headers: { "content-type": "application/json" } });

afterEach(() => vi.unstubAllGlobals());

describe("listRequests", () => {
  it("follows the cursor through every page and returns the items in order, with no cursor left", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(reply([item("a"), item("b")], "c1"))
      .mockResolvedValueOnce(reply([item("c")], "c2"))
      .mockResolvedValueOnce(reply([item("d")], null));
    vi.stubGlobal("fetch", fetchMock);

    const result = await listRequests("token");

    expect(result.items.map((entry) => entry.id)).toEqual(["a", "b", "c", "d"]);
    expect(result.nextCursor).toBeNull();
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "/event/api/v1/events?limit=100",
      "/event/api/v1/events?limit=100&cursor=c1",
      "/event/api/v1/events?limit=100&cursor=c2",
    ]);
  });

  it("keeps the kind on every page, and sends the token", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(reply([item("a")], "c1")).mockResolvedValueOnce(reply([], null));
    vi.stubGlobal("fetch", fetchMock);

    await listRequests("secret", "drafts");

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "/event/api/v1/events?limit=100&kind=drafts",
      "/event/api/v1/events?limit=100&kind=drafts&cursor=c1",
    ]);
    expect(fetchMock.mock.calls[0]![1].headers.Authorization).toBe("Bearer secret");
  });

  it("stops after 100 pages rather than following a cursor that never ends", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => reply([item("x")], "again"));
    vi.stubGlobal("fetch", fetchMock);

    const result = await listRequests("token");

    expect(fetchMock).toHaveBeenCalledTimes(100);
    expect(result.items).toHaveLength(100);
  });

  it("throws the server's refusal, so the screen shows it", async () => {
    const refusal = { error: { code: "VALIDATION_FAILED", message: "limit must be a whole number from 1 to 100.", correlationId: null } };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(refusal), { status: 400 })));

    await expect(listRequests("token")).rejects.toMatchObject({ status: 400, envelope: { code: "VALIDATION_FAILED" } });
  });
});
