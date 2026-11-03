import { describe, expect, it } from "vitest";
import {
  DEFAULT_ADMIT_PER_SECOND,
  DEFAULT_TOKEN_TTL_SECONDS,
  MAX_ADMIT_PER_SECOND,
  MAX_TOKEN_TTL_SECONDS,
  MIN_SIGNING_KEY_LENGTH,
  MIN_TOKEN_TTL_SECONDS,
  admissionExpiresAt,
  assignSlot,
  entryState,
  estimatedWaitSeconds,
  keepsPlace,
  queuePosition,
  readSigningKey,
  readWaitingRoomSettings,
  slotIntervalMs,
} from "../../src/domain/waitingRoom.js";

/**
 * EN-19 — the waiting room's rules: the rate it admits at, the slot a joiner
 * gets, where an entry stands at a given instant, and the settings.
 */

const T0 = new Date("2026-12-05T02:00:00.000Z");
const at = (ms: number) => new Date(T0.getTime() + ms);

describe("readWaitingRoomSettings", () => {
  it("EN-19-T13 defaults to 100 admissions a second per event and a 300 second token", () => {
    expect(readWaitingRoomSettings({})).toEqual({ admitPerSecond: 100, tokenTtlSeconds: 300 });
    expect(DEFAULT_ADMIT_PER_SECOND).toBe(100);
    expect(DEFAULT_TOKEN_TTL_SECONDS).toBe(300);
    // Five flagged events at the default rate use the 500 requests a second EN-18 tests.
    expect(5 * DEFAULT_ADMIT_PER_SECOND).toBe(500);
  });

  it("EN-19-T13 treats an empty or blank setting as unset", () => {
    expect(readWaitingRoomSettings({ WAITING_ROOM_ADMIT_PER_SECOND: "", WAITING_ROOM_TOKEN_TTL_SECONDS: "  " })).toEqual({ admitPerSecond: 100, tokenTtlSeconds: 300 });
  });

  it("EN-19-T13 uses valid settings, including both ends of their range", () => {
    expect(readWaitingRoomSettings({ WAITING_ROOM_ADMIT_PER_SECOND: "50", WAITING_ROOM_TOKEN_TTL_SECONDS: "60" })).toEqual({ admitPerSecond: 50, tokenTtlSeconds: 60 });
    expect(readWaitingRoomSettings({ WAITING_ROOM_ADMIT_PER_SECOND: "1", WAITING_ROOM_TOKEN_TTL_SECONDS: String(MIN_TOKEN_TTL_SECONDS) })).toEqual({ admitPerSecond: 1, tokenTtlSeconds: MIN_TOKEN_TTL_SECONDS });
    expect(readWaitingRoomSettings({ WAITING_ROOM_ADMIT_PER_SECOND: String(MAX_ADMIT_PER_SECOND), WAITING_ROOM_TOKEN_TTL_SECONDS: String(MAX_TOKEN_TTL_SECONDS) })).toEqual({
      admitPerSecond: MAX_ADMIT_PER_SECOND,
      tokenTtlSeconds: MAX_TOKEN_TTL_SECONDS,
    });
  });

  it("EN-19-T13 refuses nonsense, naming the setting", () => {
    for (const bad of ["0", "-1", "1.5", "abc", String(MAX_ADMIT_PER_SECOND + 1)]) {
      expect(() => readWaitingRoomSettings({ WAITING_ROOM_ADMIT_PER_SECOND: bad }), bad).toThrow(/WAITING_ROOM_ADMIT_PER_SECOND must be a whole number from 1 to 1000/);
    }
    for (const bad of [String(MIN_TOKEN_TTL_SECONDS - 1), String(MAX_TOKEN_TTL_SECONDS + 1), "five minutes", "-300"]) {
      expect(() => readWaitingRoomSettings({ WAITING_ROOM_TOKEN_TTL_SECONDS: bad }), bad).toThrow(/WAITING_ROOM_TOKEN_TTL_SECONDS must be a whole number from 10 to 3600/);
    }
  });
});

describe("readSigningKey", () => {
  it("is empty when unset, which switches the waiting room off for flagged events", () => {
    expect(readSigningKey({})).toBe("");
    expect(readSigningKey({ WAITING_ROOM_SIGNING_KEY: "   " })).toBe("");
  });

  it("accepts a key of at least 32 characters and refuses a shorter one", () => {
    const key = "s".repeat(MIN_SIGNING_KEY_LENGTH);
    expect(readSigningKey({ WAITING_ROOM_SIGNING_KEY: ` ${key} ` })).toBe(key);
    expect(() => readSigningKey({ WAITING_ROOM_SIGNING_KEY: key.slice(1) })).toThrow(/at least 32 characters/);
  });
});

describe("slotIntervalMs", () => {
  it("is 1/N of a second, rounded up so the rate can only be at or below N", () => {
    expect(slotIntervalMs(1)).toBe(1000);
    expect(slotIntervalMs(50)).toBe(20);
    expect(slotIntervalMs(100)).toBe(10);
    expect(slotIntervalMs(300)).toBe(4); // 3.33 ms rounded up: 250 a second, never more than 300
    expect(slotIntervalMs(1000)).toBe(1);
  });
});

describe("assignSlot", () => {
  it("EN-19-T6 admits the first joiner of an idle gate at once, and moves the gate on by one interval", () => {
    expect(assignSlot(T0, at(-5000), 20)).toEqual({ admitAt: T0, nextSlotAt: at(20) });
  });

  it("EN-19-T6 gives a joiner arriving while others wait the gate's slot, one interval after the last", () => {
    expect(assignSlot(T0, at(100), 20)).toEqual({ admitAt: at(100), nextSlotAt: at(120) });
  });

  it("EN-19-T6 never admits more than N in any second, however many join at the same instant", () => {
    const interval = slotIntervalMs(50);
    let gate = T0;
    const slots: number[] = [];
    for (let i = 0; i < 500; i++) {
      const slot = assignSlot(T0, gate, interval);
      slots.push(slot.admitAt.getTime());
      gate = slot.nextSlotAt;
    }
    expect(slots[0]).toBe(T0.getTime());
    for (let i = 1; i < slots.length; i++) expect(slots[i]! - slots[i - 1]!).toBe(interval);
    // The busiest one-second window holds at most 50 admissions.
    const busiest = Math.max(...slots.map((start, i) => slots.filter((s, j) => j >= i && s < start + 1000).length));
    expect(busiest).toBeLessThanOrEqual(50);
    expect(slots.at(-1)! - slots[0]!).toBe(499 * interval);
  });

  it("starts the idle gate from now, so a queue that emptied does not bank a burst", () => {
    const gate = at(-60_000);
    const first = assignSlot(T0, gate, 10);
    const second = assignSlot(T0, first.nextSlotAt, 10);
    expect(second.admitAt.getTime() - first.admitAt.getTime()).toBe(10);
  });
});

describe("entryState", () => {
  const entry = { admitAt: at(1000), consumedAt: null };

  it("EN-19-T8 waits until the slot, is admitted from it, and is expired once the token's life is over", () => {
    expect(entryState(entry, at(999), 60)).toBe("WAITING");
    expect(entryState(entry, at(1000), 60)).toBe("ADMITTED");
    expect(entryState(entry, at(1000 + 59_999), 60)).toBe("ADMITTED");
    expect(entryState(entry, at(1000 + 60_000), 60)).toBe("EXPIRED");
    expect(entryState(entry, at(1000 + 61_000), 60)).toBe("EXPIRED");
  });

  it("EN-19-T9 is used once spent, whatever the time", () => {
    const spent = { admitAt: at(1000), consumedAt: at(2000) };
    for (const ms of [0, 1500, 2000, 100_000]) expect(entryState(spent, at(ms), 60)).toBe("USED");
  });

  it("expires at the slot plus the token's life", () => {
    expect(admissionExpiresAt(at(1000), 60)).toEqual(at(61_000));
  });
});

describe("estimatedWaitSeconds", () => {
  it("EN-19-T7 rounds up to whole seconds and is 0 once the slot has come", () => {
    expect(estimatedWaitSeconds(at(3000), T0)).toBe(3);
    expect(estimatedWaitSeconds(at(2001), T0)).toBe(3);
    expect(estimatedWaitSeconds(at(1), T0)).toBe(1);
    expect(estimatedWaitSeconds(T0, T0)).toBe(0);
    expect(estimatedWaitSeconds(at(-5000), T0)).toBe(0);
  });
});

describe("queuePosition and keepsPlace", () => {
  it("EN-19-T7 is one more than those waiting ahead, and 0 for anyone no longer waiting", () => {
    expect(queuePosition("WAITING", 0)).toBe(1);
    expect(queuePosition("WAITING", 41)).toBe(42);
    for (const state of ["ADMITTED", "EXPIRED", "USED"] as const) expect(queuePosition(state, 7)).toBe(0);
  });

  it("EN-19-T12 keeps the place of an attendee who is waiting or admitted, not of one who is expired or has used it", () => {
    expect(keepsPlace("WAITING")).toBe(true);
    expect(keepsPlace("ADMITTED")).toBe(true);
    expect(keepsPlace("EXPIRED")).toBe(false);
    expect(keepsPlace("USED")).toBe(false);
  });
});
