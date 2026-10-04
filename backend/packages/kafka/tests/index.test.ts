import { describe, expect, it } from "vitest";
import * as kafka from "../src/index.js";

/** What both services import: one package, so the credentials code exists once. */
describe("@connectsphere/kafka", () => {
  it("exposes the settings reader, the broker probe and the client builder", () => {
    expect(Object.keys(kafka)).toEqual(
      expect.arrayContaining(["kafkaSettingsFromEnv", "toClientConfig", "redact", "brokerProbe", "createKafka", "probeFor"]),
    );
  });
});
