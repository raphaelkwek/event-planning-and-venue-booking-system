import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { InMemoryProvider, OpenFeature } from "@openfeature/server-sdk";
import {
  FLAG_DEFAULTS,
  FLAG_DOMAIN,
  chooseSource,
  evaluateAll,
  flagSource,
  initFlags,
  isEnabled,
  shutdownFlags,
} from "../../src/shared/flags/index.js";

// EN-15 cards T1 and T2 (tests/EN-15), plus the provider-failure paths. No network and no
// database: a flag file in flagd's format is read in-process, and the failure cases use stubs.

let dir: string;
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "en15-flags-"));
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));
afterEach(async () => {
  await shutdownFlags();
});

function flagFile(name: string, defaultVariant: "on" | "off"): string {
  const path = join(dir, name);
  writeFileSync(
    path,
    JSON.stringify({
      flags: { "change-approval": { state: "ENABLED", variants: { on: true, off: false }, defaultVariant } },
    }),
  );
  return path;
}

describe("flag defaults (EN-15-T1)", () => {
  it("names change-approval as on by default (EN-15-T1)", () => {
    expect(FLAG_DEFAULTS).toEqual({ "change-approval": true });
  });

  it("uses no provider, and the defaults, when the environment names no flag source (EN-15-T1)", async () => {
    expect(chooseSource({ FLAGD_OFFLINE_FLAG_SOURCE_PATH: join(dir, "missing.json") })).toEqual({ source: "defaults" });
    expect(chooseSource({}, () => false)).toEqual({ source: "defaults" });

    const source = await initFlags({ FLAGD_OFFLINE_FLAG_SOURCE_PATH: join(dir, "missing.json") });

    expect(source).toBe("defaults");
    expect(flagSource()).toBe("defaults");
    expect(await isEnabled("change-approval")).toBe(true);
    expect(await evaluateAll()).toEqual({ "change-approval": true });
  });

  it("treats a blank FLAGD_HOST as not configured (EN-15-T1)", () => {
    expect(chooseSource({ FLAGD_HOST: "  " }, () => false)).toEqual({ source: "defaults" });
  });
});

describe("flag files in flagd format (EN-15-T2)", () => {
  it("chooses flagd when FLAGD_HOST is set, before any file (EN-15-T2)", () => {
    expect(chooseSource({ FLAGD_HOST: "flagd.internal", FLAGD_OFFLINE_FLAG_SOURCE_PATH: "x.json" }, () => true)).toEqual({ source: "flagd" });
  });

  it("chooses the committed flag file when nothing else is set (EN-15-T2)", () => {
    const choice = chooseSource({}, () => true);
    expect(choice.source).toBe("file");
    expect(choice.file).toMatch(/flags[\\/]flags\.flagd\.json$/);
  });

  it("reads a flag turned off in the file (EN-15-T2)", async () => {
    const source = await initFlags({ FLAGD_OFFLINE_FLAG_SOURCE_PATH: flagFile("off.json", "off") });

    expect(source).toBe("file");
    expect(await isEnabled("change-approval")).toBe(false);
    expect(await evaluateAll({ targetingKey: "u1", role: "EVENT_COORDINATOR" })).toEqual({ "change-approval": false });
  });

  it("reads a flag turned on in the file (EN-15-T2)", async () => {
    await initFlags({ FLAGD_OFFLINE_FLAG_SOURCE_PATH: flagFile("on.json", "on") });
    expect(await isEnabled("change-approval")).toBe(true);
  });

  it("reads the committed flags/flags.flagd.json, which has change-approval on (EN-15-T2)", async () => {
    const source = await initFlags({});

    expect(source).toBe("file");
    expect(await isEnabled("change-approval")).toBe(true);
  });
});

describe("failures fall back to the default", () => {
  it("answers with the default when the flag is missing from the file", async () => {
    const path = join(dir, "empty.json");
    writeFileSync(path, JSON.stringify({ flags: {} }));

    await initFlags({ FLAGD_OFFLINE_FLAG_SOURCE_PATH: path });

    expect(await isEnabled("change-approval")).toBe(true);
  });

  it("answers with the default when the provider throws", async () => {
    await OpenFeature.setProviderAndWait(
      FLAG_DOMAIN,
      new InMemoryProvider({
        "change-approval": { disabled: false, variants: { on: true, off: false }, defaultVariant: "off", contextEvaluator: () => { throw new Error("boom"); } },
      }),
    );

    expect(await isEnabled("change-approval")).toBe(true);
  });

  it("falls back to the defaults when the flag service is not ready in time", async () => {
    // Nothing listens on port 1, so the connection fails: initFlags logs it and carries on.
    const source = await initFlags({ FLAGD_HOST: "127.0.0.1", FLAGD_PORT: "1", FLAGD_DEADLINE_MS: "100" });

    expect(source).toBe("flagd");
    expect(await isEnabled("change-approval")).toBe(true);
  }, 15_000);
});
