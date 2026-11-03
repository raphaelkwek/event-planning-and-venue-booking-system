import { describe, expect, it } from "vitest";
import {
  checkLink,
  fieldChangeEntries,
  GENESIS_HASH,
  statusChangeEntry,
  summariseChains,
  verificationReport,
  type StoredLink,
} from "../../../src/modules/event/domain/eventStream.js";

/** EN-03 (ADR-0007) — the stream's pure rules: what an entry holds, and when a chain is intact. */

const A = "aaaaaaaa-0000-4000-8000-000000000001";
const B = "bbbbbbbb-0000-4000-8000-000000000002";
const h = (char: string) => char.repeat(64);

/** A chain that is intact: each entry's prev_hash is the hash before it, and its hash is what it stores. */
function chain(aggregateId: string, hashes: string[]): StoredLink[] {
  return hashes.map((hash, index) => ({
    aggregateId,
    version: index + 1,
    prevHash: index === 0 ? GENESIS_HASH : hashes[index - 1]!,
    hash,
    recomputedHash: hash,
  }));
}

describe("an entry to append", () => {
  it("is 64 zeros before the first entry", () => {
    expect(GENESIS_HASH).toBe("0000000000000000000000000000000000000000000000000000000000000000");
  });

  it("records a status change with both statuses, the actor, the role and the action, at the transaction's time", () => {
    expect(
      statusChangeEntry({
        previousStatus: "SUBMITTED",
        newStatus: "UNDER_REVIEW",
        actorUserId: A,
        actorRole: "EVENT_COORDINATOR",
        triggeringAction: "OPEN_FOR_REVIEW",
      })
    ).toStrictEqual({
      type: "STATUS_CHANGE",
      previousStatus: "SUBMITTED",
      newStatus: "UNDER_REVIEW",
      fieldName: null,
      previousValue: null,
      newValue: null,
      actorUserId: A,
      actorRole: "EVENT_COORDINATOR",
      triggeringAction: "OPEN_FOR_REVIEW",
      occurredAt: null,
    });
  });

  it("records one field change per field, in order, each with the actor, the role and the action", () => {
    const at = new Date("2026-11-03T01:02:03.000Z");
    expect(
      fieldChangeEntries(
        [
          { fieldName: "purpose", previousValue: "Old", newValue: "New" },
          { fieldName: "description", previousValue: null, newValue: "Added" },
        ],
        { userId: B, role: "EVENT_ORGANISER" },
        "UPDATE_DETAILS",
        at
      )
    ).toStrictEqual([
      {
        type: "FIELD_CHANGE",
        previousStatus: null,
        newStatus: null,
        fieldName: "purpose",
        previousValue: "Old",
        newValue: "New",
        actorUserId: B,
        actorRole: "EVENT_ORGANISER",
        triggeringAction: "UPDATE_DETAILS",
        occurredAt: at,
      },
      {
        type: "FIELD_CHANGE",
        previousStatus: null,
        newStatus: null,
        fieldName: "description",
        previousValue: null,
        newValue: "Added",
        actorUserId: B,
        actorRole: "EVENT_ORGANISER",
        triggeringAction: "UPDATE_DETAILS",
        occurredAt: at,
      },
    ]);
  });

  it("leaves a field change's time to the transaction when none is given, and records nothing for no changes", () => {
    const [entry] = fieldChangeEntries(
      [{ fieldName: "purpose", previousValue: "a", newValue: "b" }],
      { userId: B, role: "EVENT_ORGANISER" },
      "RESPOND_TO_CLARIFICATION"
    );
    expect(entry!.occurredAt).toBeNull();
    expect(fieldChangeEntries([], { userId: B, role: "EVENT_ORGANISER" }, "UPDATE_DETAILS")).toEqual([]);
  });
});

describe("checking one link (EN-03-T15 to T17)", () => {
  const [first, second] = chain(A, [h("1"), h("2")]) as [StoredLink, StoredLink];

  it("accepts an event's first entry: version 1, pointing at the genesis hash, with the hash it stores", () => {
    expect(checkLink(null, first)).toBeNull();
  });

  it("accepts the next entry: one version on, pointing at the previous entry's hash", () => {
    expect(checkLink(first, second)).toBeNull();
  });

  it("accepts the first entry of another event after a different event's chain", () => {
    const [other] = chain(B, [h("3")]);
    expect(checkLink(second, other!)).toBeNull();
  });

  it("refuses an edited entry: its stored hash no longer matches what it stores", () => {
    expect(checkLink(first, { ...second, recomputedHash: h("9") })).toStrictEqual({
      aggregateId: A,
      version: 2,
      fault: "HASH_MISMATCH",
      reason: "its stored hash does not match its contents, so the entry was changed",
    });
  });

  it("refuses the entry after one whose hash was rewritten to match an edit", () => {
    const rewritten = { ...first, hash: h("8"), recomputedHash: h("8") };
    expect(checkLink(rewritten, second)).toStrictEqual({
      aggregateId: A,
      version: 2,
      fault: "PREVIOUS_HASH_MISMATCH",
      reason: "its prev_hash is not the hash of version 1, so an earlier entry was changed",
    });
  });

  it("refuses a first entry that does not point at the genesis hash", () => {
    expect(checkLink(null, { ...first, prevHash: h("7") })).toStrictEqual({
      aggregateId: A,
      version: 1,
      fault: "PREVIOUS_HASH_MISMATCH",
      reason: "its prev_hash is not the genesis hash",
    });
  });

  it("refuses a gap: version 3 straight after version 1 (just above the next version)", () => {
    expect(checkLink(first, { ...second, version: 3 })).toStrictEqual({
      aggregateId: A,
      version: 3,
      fault: "VERSION_OUT_OF_SEQUENCE",
      reason: "expected version 2 here, found 3, so an entry is missing",
    });
  });

  it("refuses a repeated version (just below the next version)", () => {
    expect(checkLink(first, { ...second, version: 1 })?.fault).toBe("VERSION_OUT_OF_SEQUENCE");
  });

  it("refuses an event whose first entry was removed: its chain starts at version 2", () => {
    expect(checkLink(null, second)).toStrictEqual({
      aggregateId: A,
      version: 2,
      fault: "VERSION_OUT_OF_SEQUENCE",
      reason: "expected version 1 here, found 2, so an entry is missing",
    });
  });

  it("checks the version before the hashes, and the link before the entry's own hash", () => {
    const everythingWrong = { ...second, version: 5, prevHash: h("6"), recomputedHash: h("5") };
    expect(checkLink(first, everythingWrong)?.fault).toBe("VERSION_OUT_OF_SEQUENCE");
    expect(checkLink(first, { ...everythingWrong, version: 2 })?.fault).toBe("PREVIOUS_HASH_MISMATCH");
  });
});

describe("walking every chain", () => {
  it("counts the entries and the events, and finds nothing broken in intact chains", () => {
    const links = [...chain(A, [h("1"), h("2"), h("3")]), ...chain(B, [h("4")])];
    expect(summariseChains(links)).toStrictEqual({ entries: 4, events: 2, brokenLink: null });
  });

  it("stops at the first broken link, counting what it checked up to it", () => {
    const links = [...chain(A, [h("1")]), ...chain(B, [h("2"), h("3"), h("4")])];
    links[2] = { ...links[2]!, recomputedHash: h("0") };
    links[3] = { ...links[3]!, recomputedHash: h("0") };

    expect(summariseChains(links)).toStrictEqual({
      entries: 3,
      events: 2,
      brokenLink: {
        aggregateId: B,
        version: 2,
        fault: "HASH_MISMATCH",
        reason: "its stored hash does not match its contents, so the entry was changed",
      },
    });
  });

  it("reports an empty store as intact", () => {
    expect(summariseChains([])).toStrictEqual({ entries: 0, events: 0, brokenLink: null });
  });
});

describe("what the command prints", () => {
  const intact = { entries: 4, events: 2, brokenLink: null, projectionMismatch: null };

  it("passes an intact store and says what it checked", () => {
    expect(verificationReport(intact)).toStrictEqual({
      ok: true,
      lines: [
        "Checked 4 stream entries across 2 events.",
        "Every chain is intact.",
        "Every history row matches its stream entry.",
      ],
    });
  });

  it("says entry and event for one of each, and entries and events for none", () => {
    expect(verificationReport({ ...intact, entries: 1, events: 1 }).lines[0]).toBe("Checked 1 stream entry across 1 event.");
    expect(verificationReport({ ...intact, entries: 0, events: 0 }).lines[0]).toBe("Checked 0 stream entries across 0 events.");
  });

  it("fails on a broken link, naming the event, the version, the fault and why", () => {
    const report = verificationReport({
      ...intact,
      brokenLink: { aggregateId: A, version: 2, fault: "HASH_MISMATCH", reason: "it was changed" },
    });
    expect(report).toStrictEqual({
      ok: false,
      lines: [
        "Checked 4 stream entries across 2 events, stopping at the first broken link.",
        `First broken link: event ${A} version 2 (HASH_MISMATCH): it was changed.`,
        "Every history row matches its stream entry.",
      ],
    });
  });

  it("fails on a history row that disagrees with its entry, or has none (EN-03-T19)", () => {
    const disagrees = verificationReport({
      ...intact,
      projectionMismatch: { historyId: B, eventId: A, hasEntry: true },
    });
    const missing = verificationReport({
      ...intact,
      projectionMismatch: { historyId: B, eventId: A, hasEntry: false },
    });

    expect(disagrees.ok).toBe(false);
    expect(disagrees.lines[2]).toBe(`History row ${B} of event ${A} does not match its stream entry.`);
    expect(missing.ok).toBe(false);
    expect(missing.lines[2]).toBe(`History row ${B} of event ${A} has no stream entry.`);
    expect(missing.lines[1]).toBe("Every chain is intact.");
  });
});
