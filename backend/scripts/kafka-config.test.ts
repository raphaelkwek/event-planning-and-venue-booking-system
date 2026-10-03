import { test } from "node:test";
import assert from "node:assert/strict";
import { homedir } from "node:os";
import { join } from "node:path";
import { kafkaVarsFrom, toClientConfig, redact, KafkaConfigError } from "./kafka-config.ts";

const filled = {
  KAFKA_BROKERS: "kafka-dev.example.aivencloud.com:12345",
  KAFKA_SASL_MECHANISM: "scram-sha-256",
  KAFKA_SASL_USERNAME: "example-user",
  KAFKA_SASL_PASSWORD: "s3cret-pa55",
};

const noFile = () => {
  throw new Error("no file should be read");
};

test("keeps only the KAFKA_ variables from the .env text", () => {
  const vars = kafkaVarsFrom(
    "DATABASE_URL=postgres://u:p@h/db\nKAFKA_BROKERS=b:1\nSUPABASE_SERVICE_ROLE_KEY=k\nKAFKA_SASL_USERNAME=u\n",
  );
  assert.deepEqual(vars, { KAFKA_BROKERS: "b:1", KAFKA_SASL_USERNAME: "u" });
});

test("splits a comma-separated broker list", () => {
  const config = toClientConfig({ ...filled, KAFKA_BROKERS: " b1:9092, b2:9092 " }, noFile);
  assert.deepEqual(config.brokers, ["b1:9092", "b2:9092"]);
});

test("passes the SASL mechanism and credentials through", () => {
  const config = toClientConfig(filled, noFile);
  assert.deepEqual(config.sasl, {
    mechanism: "scram-sha-256",
    username: "example-user",
    password: "s3cret-pa55",
  });
});

test("names every missing variable, and never a value", () => {
  assert.throws(
    () => toClientConfig({ KAFKA_SASL_PASSWORD: "s3cret-pa55" }, noFile),
    (error: unknown) => {
      assert.ok(error instanceof KafkaConfigError);
      assert.deepEqual(error.problems, [
        "KAFKA_BROKERS is not set",
        "KAFKA_SASL_MECHANISM is not set",
        "KAFKA_SASL_USERNAME is not set",
      ]);
      assert.ok(!error.message.includes("s3cret-pa55"));
      return true;
    },
  );
});

test("treats a placeholder copied from .env.example as not filled in", () => {
  assert.throws(
    () => toClientConfig({ ...filled, KAFKA_SASL_PASSWORD: "replace-with-kafka-password-or-api-secret" }, noFile),
    (error: unknown) => {
      assert.ok(error instanceof KafkaConfigError);
      assert.deepEqual(error.problems, ["KAFKA_SASL_PASSWORD still has the .env.example placeholder"]);
      return true;
    },
  );
});

test("refuses a mechanism kafkajs does not support, listing the ones it does", () => {
  assert.throws(
    () => toClientConfig({ ...filled, KAFKA_SASL_MECHANISM: "gssapi" }, noFile),
    /KAFKA_SASL_MECHANISM must be one of plain, scram-sha-256, scram-sha-512/,
  );
});

test("uses the system's trusted CAs when no CA file is given", () => {
  assert.equal(toClientConfig(filled, noFile).ssl, true);
});

test("trusts the CA certificate in KAFKA_SSL_CA_PATH, expanding ~ to the home folder", () => {
  const read: string[] = [];
  const config = toClientConfig({ ...filled, KAFKA_SSL_CA_PATH: "~/.connectsphere/kafka/ca.pem" }, (path) => {
    read.push(path);
    return "-----BEGIN CERTIFICATE-----";
  });
  assert.deepEqual(read, [join(homedir(), ".connectsphere/kafka/ca.pem")]);
  assert.deepEqual(config.ssl, { ca: ["-----BEGIN CERTIFICATE-----"] });
});

test("says which file it could not read when the CA path is wrong", () => {
  assert.throws(
    () =>
      toClientConfig({ ...filled, KAFKA_SSL_CA_PATH: "/nowhere/ca.pem" }, () => {
        throw new Error("ENOENT");
      }),
    /KAFKA_SSL_CA_PATH: cannot read \/nowhere\/ca\.pem/,
  );
});

test("redacts the username and password from any text it prints", () => {
  assert.equal(
    redact("auth failed for example-user with s3cret-pa55", filled),
    "auth failed for [KAFKA_SASL_USERNAME] with [KAFKA_SASL_PASSWORD]",
  );
});
