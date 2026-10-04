import { describe, expect, it } from "vitest";
import { homedir } from "node:os";
import { join } from "node:path";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { kafkaSettingsFromEnv, KafkaConfigError, redact, toClientConfig } from "../src/config.js";

/** SPM-113 and EN-04.2: the KAFKA_* variables, and only those, configure Kafka. */

const filled = {
  KAFKA_BROKERS: "kafka-dev.example.aivencloud.com:12345",
  KAFKA_SASL_MECHANISM: "scram-sha-256",
  KAFKA_SASL_USERNAME: "example-user",
  KAFKA_SASL_PASSWORD: "s3cret-pa55",
};

const noFile = () => {
  throw new Error("no file should be read");
};

describe("toClientConfig", () => {
  it("splits a comma-separated broker list", () => {
    const config = toClientConfig({ ...filled, KAFKA_BROKERS: " b1:9092, b2:9092 " }, noFile);
    expect(config.brokers).toEqual(["b1:9092", "b2:9092"]);
  });

  it("passes the SASL mechanism and credentials through", () => {
    expect(toClientConfig(filled, noFile).sasl).toEqual({
      mechanism: "scram-sha-256",
      username: "example-user",
      password: "s3cret-pa55",
    });
  });

  it("names every missing variable, and never a value", () => {
    try {
      toClientConfig({ KAFKA_SASL_PASSWORD: "s3cret-pa55" }, noFile);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(KafkaConfigError);
      expect((error as KafkaConfigError).problems).toEqual([
        "KAFKA_BROKERS is not set",
        "KAFKA_SASL_MECHANISM is not set",
        "KAFKA_SASL_USERNAME is not set",
      ]);
      expect((error as Error).message).not.toContain("s3cret-pa55");
    }
  });

  it("treats a placeholder copied from .env.example as not filled in", () => {
    expect(() =>
      toClientConfig({ ...filled, KAFKA_SASL_PASSWORD: "replace-with-kafka-password-or-api-secret" }, noFile),
    ).toThrow("KAFKA_SASL_PASSWORD still has the .env.example placeholder");
  });

  it("refuses a mechanism kafkajs does not support, listing the ones it does", () => {
    expect(() => toClientConfig({ ...filled, KAFKA_SASL_MECHANISM: "gssapi" }, noFile)).toThrow(
      /KAFKA_SASL_MECHANISM must be one of plain, scram-sha-256, scram-sha-512/,
    );
  });

  it("uses the system's trusted CAs when no CA file is given", () => {
    expect(toClientConfig(filled, noFile).ssl).toBe(true);
  });

  it("trusts the CA certificate in KAFKA_SSL_CA_PATH, expanding ~ to the home folder", () => {
    const read: string[] = [];
    const config = toClientConfig({ ...filled, KAFKA_SSL_CA_PATH: "~/.connectsphere/kafka/ca.pem" }, (path) => {
      read.push(path);
      return "-----BEGIN CERTIFICATE-----";
    });
    expect(read).toEqual([join(homedir(), ".connectsphere/kafka/ca.pem")]);
    expect(config.ssl).toEqual({ ca: ["-----BEGIN CERTIFICATE-----"] });
  });

  it("reads a CA path without ~ as it is", () => {
    const read: string[] = [];
    toClientConfig({ ...filled, KAFKA_SSL_CA_PATH: "/etc/kafka/ca.pem" }, (path) => {
      read.push(path);
      return "pem";
    });
    expect(read).toEqual(["/etc/kafka/ca.pem"]);
  });

  it("reads the CA file from disk when no reader is passed in", () => {
    const path = join(mkdtempSync(join(tmpdir(), "kafka-ca-")), "ca.pem");
    writeFileSync(path, "-----BEGIN CERTIFICATE-----");
    expect(toClientConfig({ ...filled, KAFKA_SSL_CA_PATH: path }).ssl).toEqual({ ca: ["-----BEGIN CERTIFICATE-----"] });
  });

  it("says which file it could not read when the CA path is wrong", () => {
    expect(() =>
      toClientConfig({ ...filled, KAFKA_SSL_CA_PATH: "/nowhere/ca.pem" }, () => {
        throw new Error("ENOENT");
      }),
    ).toThrow(/KAFKA_SSL_CA_PATH: cannot read \/nowhere\/ca\.pem/);
  });
});

describe("kafkaSettingsFromEnv: deciding at startup whether Kafka is on", () => {
  it("is not configured when KAFKA_BROKERS is unset, so a laptop without Kafka still runs", () => {
    expect(kafkaSettingsFromEnv({ DATABASE_URL: "postgres://x" }, noFile)).toEqual({ status: "not_configured" });
  });

  it("is not configured when KAFKA_BROKERS is still the .env.example placeholder", () => {
    expect(kafkaSettingsFromEnv({ ...filled, KAFKA_BROKERS: "replace-with-bootstrap-server:port" }, noFile)).toEqual({
      status: "not_configured",
    });
  });

  it("is invalid, naming the problems, when brokers are set but the rest is not", () => {
    expect(kafkaSettingsFromEnv({ KAFKA_BROKERS: "b:1" }, noFile)).toEqual({
      status: "invalid",
      problems: ["KAFKA_SASL_MECHANISM is not set", "KAFKA_SASL_USERNAME is not set", "KAFKA_SASL_PASSWORD is not set"],
    });
  });

  it("is configured with the client settings when everything is set", () => {
    const settings = kafkaSettingsFromEnv(filled, noFile);
    expect(settings.status).toBe("configured");
    expect(settings.status === "configured" && settings.config.brokers).toEqual([filled.KAFKA_BROKERS]);
  });
});

describe("redact", () => {
  it("replaces the username and password wherever they appear", () => {
    expect(redact("auth failed for example-user with s3cret-pa55", filled)).toBe(
      "auth failed for [KAFKA_SASL_USERNAME] with [KAFKA_SASL_PASSWORD]",
    );
  });

  it("leaves text alone when no credentials are set", () => {
    expect(redact("broker down", {})).toBe("broker down");
  });
});
