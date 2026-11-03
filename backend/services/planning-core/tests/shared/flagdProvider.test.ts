import { afterAll, describe, expect, it } from "vitest";
import { OpenFeature } from "@openfeature/server-sdk";
import { FLAG_DOMAIN, flagSource, initFlags, isEnabled, shutdownFlags } from "../../src/shared/flags/index.js";

// EN-15-T8. CI starts ghcr.io/open-feature/flagd serving the committed flags/flags.flagd.json on
// port 8013 and sets FLAGD_INTEGRATION_HOST. Elsewhere (no Docker locally, ADR-0012) this skips.
const host = process.env.FLAGD_INTEGRATION_HOST;

afterAll(shutdownFlags);

describe.skipIf(!host)("the flagd provider against a real flagd (EN-15-T8)", () => {
  it("reads change-approval from flagd, not from the default in the code (EN-15-T8)", async () => {
    const source = await initFlags({ FLAGD_HOST: host, FLAGD_PORT: "8013" });
    expect(source).toBe("flagd");
    expect(flagSource()).toBe("flagd");

    // The default passed here is false, so a true answer can only have come from flagd's file.
    const details = await OpenFeature.getClient(FLAG_DOMAIN).getBooleanDetails("change-approval", false);

    expect(details.value).toBe(true);
    expect(details.variant).toBe("on");
    expect(details.errorCode).toBeUndefined();
    expect(await isEnabled("change-approval")).toBe(true);
  });
});
