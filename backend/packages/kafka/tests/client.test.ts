import { describe, expect, it, vi } from "vitest";
import { Kafka, logLevel } from "kafkajs";
import { createKafka, kafkaLogCreator, probeFor } from "../src/client.js";

/** EN-04.2: building a service's Kafka client from its settings. */

const config = {
  brokers: ["b:1"],
  ssl: true as const,
  sasl: { mechanism: "scram-sha-256" as const, username: "example-user", password: "s3cret-pa55" },
};

const fakeLog = () => ({ error: vi.fn(), warn: vi.fn() });

describe("createKafka", () => {
  it("builds no client when the service has no Kafka settings", () => {
    expect(createKafka({ status: "not_configured" }, { clientId: "x", log: fakeLog() })).toBeNull();
  });

  it("builds no client, and logs the problems, when the settings are incomplete", () => {
    const log = fakeLog();
    expect(createKafka({ status: "invalid", problems: ["KAFKA_SASL_PASSWORD is not set"] }, { clientId: "x", log })).toBeNull();
    expect(log.error).toHaveBeenCalledWith(expect.stringContaining("incomplete"), {
      problems: ["KAFKA_SASL_PASSWORD is not set"],
    });
  });

  it("builds a client, without connecting yet, when the settings are complete", () => {
    expect(createKafka({ status: "configured", config }, { clientId: "x", log: fakeLog() })).toBeInstanceOf(Kafka);
  });
});

describe("probeFor", () => {
  it("has no probe without a client, so /readyz says not configured", () => {
    expect(probeFor(null)).toBeUndefined();
  });

  it("has a probe with one", () => {
    expect(probeFor(createKafka({ status: "configured", config }, { clientId: "x", log: fakeLog() }))).toBeTypeOf(
      "function",
    );
  });
});

describe("kafkaLogCreator", () => {
  it("passes kafkajs errors to the service's logger with the credentials redacted", () => {
    const log = fakeLog();
    kafkaLogCreator({ KAFKA_SASL_PASSWORD: "s3cret-pa55" }, log)({
      namespace: "Connection",
      level: logLevel.ERROR,
      label: "ERROR",
      log: { timestamp: "", message: "auth failed with s3cret-pa55", error: "bad s3cret-pa55" },
    });
    expect(log.error).toHaveBeenCalledWith("kafkajs: auth failed with [KAFKA_SASL_PASSWORD]", {
      error: "bad [KAFKA_SASL_PASSWORD]",
    });
  });

  it("passes kafkajs warnings on as warnings", () => {
    const log = fakeLog();
    kafkaLogCreator({}, log)({ namespace: "x", level: logLevel.WARN, label: "WARN", log: { timestamp: "", message: "slow" } });
    expect(log.warn).toHaveBeenCalledWith("kafkajs: slow");
  });
});
