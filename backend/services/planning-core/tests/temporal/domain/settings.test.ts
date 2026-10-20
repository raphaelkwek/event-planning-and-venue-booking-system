import { describe, expect, it } from "vitest";
import { connectionOptionsFor, DEFAULT_TASK_QUEUE, temporalSettingsFromEnv } from "../../../src/temporal/domain/settings.js";

/**
 * EN-11 — the TEMPORAL_* variables (implementation.md §10). Like KAFKA_*, an
 * unset address means "run without it", so a laptop without a namespace still
 * runs `npm run dev`. Problems name the variable, never its value.
 */

const cloud = {
  TEMPORAL_ADDRESS: "ap-southeast-1.aws.api.temporal.io:7233",
  TEMPORAL_NAMESPACE: "connectsphere.a1b2c",
  TEMPORAL_API_KEY: "secret-key-value",
};

describe("temporalSettingsFromEnv", () => {
  it.each([{}, { TEMPORAL_ADDRESS: "" }, { TEMPORAL_ADDRESS: "   " }, { TEMPORAL_ADDRESS: "replace-with-your-namespace-endpoint:7233" }])(
    "is not configured without an address, or with the .env.example placeholder: %o",
    (vars) => {
      expect(temporalSettingsFromEnv(vars)).toEqual({ status: "not_configured" });
    }
  );

  it("reads a Temporal Cloud namespace with an API key, on the default task queue", () => {
    expect(temporalSettingsFromEnv(cloud)).toEqual({
      status: "configured",
      address: "ap-southeast-1.aws.api.temporal.io:7233",
      namespace: "connectsphere.a1b2c",
      apiKey: "secret-key-value",
      taskQueue: DEFAULT_TASK_QUEUE,
    });
    expect(DEFAULT_TASK_QUEUE).toBe("planning-core");
  });

  it("trims every value and takes the task queue it is given", () => {
    const settings = temporalSettingsFromEnv({
      TEMPORAL_ADDRESS: " localhost:7233 ",
      TEMPORAL_NAMESPACE: " default ",
      TEMPORAL_TASK_QUEUE: " my-queue ",
    });
    expect(settings).toEqual({ status: "configured", address: "localhost:7233", namespace: "default", apiKey: null, taskQueue: "my-queue" });
  });

  it("treats a blank API key or task queue as unset", () => {
    expect(temporalSettingsFromEnv({ ...cloud, TEMPORAL_API_KEY: " ", TEMPORAL_TASK_QUEUE: "" })).toMatchObject({
      apiKey: null,
      taskQueue: DEFAULT_TASK_QUEUE,
    });
  });

  it("refuses an address without a port, or a namespace that is missing, naming each and showing no value", () => {
    const settings = temporalSettingsFromEnv({ TEMPORAL_ADDRESS: "no-port.example", TEMPORAL_API_KEY: "secret-key-value" });
    expect(settings).toEqual({
      status: "invalid",
      problems: ["TEMPORAL_ADDRESS must be host:port", "TEMPORAL_NAMESPACE is not set"],
    });
    expect(JSON.stringify(settings)).not.toContain("secret-key-value");
    expect(JSON.stringify(settings)).not.toContain("no-port.example");
  });

  it("refuses the .env.example placeholders for the namespace and the API key", () => {
    const settings = temporalSettingsFromEnv({
      TEMPORAL_ADDRESS: cloud.TEMPORAL_ADDRESS,
      TEMPORAL_NAMESPACE: "replace-with-your-namespace",
      TEMPORAL_API_KEY: "replace-with-your-api-key",
    });
    expect(settings).toEqual({
      status: "invalid",
      problems: ["TEMPORAL_NAMESPACE still has the .env.example placeholder", "TEMPORAL_API_KEY still has the .env.example placeholder"],
    });
  });
});

describe("connectionOptionsFor", () => {
  it("turns TLS on and sends the API key, with the namespace header Temporal Cloud routes by", () => {
    const settings = temporalSettingsFromEnv(cloud);
    expect(settings.status).toBe("configured");
    if (settings.status !== "configured") return;
    expect(connectionOptionsFor(settings)).toEqual({
      address: "ap-southeast-1.aws.api.temporal.io:7233",
      tls: true,
      apiKey: "secret-key-value",
      metadata: { "temporal-namespace": "connectsphere.a1b2c" },
    });
  });

  it("connects in plain text without an API key, as a self-hosted server allows", () => {
    expect(
      connectionOptionsFor({ status: "configured", address: "localhost:7233", namespace: "default", apiKey: null, taskQueue: "q" })
    ).toEqual({ address: "localhost:7233" });
  });
});
