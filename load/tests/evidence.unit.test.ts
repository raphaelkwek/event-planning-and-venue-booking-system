import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT } from "../support/stack.js";
import type { RunResult } from "../support/report.js";

/**
 * EN-18-T8 (and the write-ups of EN-20): the evidence is committed, whole, and names the runs it came from.
 * This cannot show a result is true, only that it is there, passed, and points at the run that produced it
 * and that nothing that was not run is presented as run.
 */

const EN18 = join(REPO_ROOT, "documentation/evidence/EN-18");
const EN20 = join(REPO_ROOT, "documentation/evidence/EN-20");
const RUN_URL = /https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/actions\/runs\/\d+/;
const SCENARIOS = ["smoke", "spike-1", "spike-2", "spike-3", "soak", "stress"] as const;

const readme = readFileSync(join(EN18, "README.md"), "utf8");
const headline = RUN_URL.exec(readme)?.[0];

describe("EN-18 evidence (EN-18-T8)", () => {
  it("names the run the committed files came from", () => {
    expect(headline).toBeDefined();
  });

  it.each(SCENARIOS)("%s: has the k6 summary, the harness's result and its write-up, and passed", (name) => {
    for (const file of ["k6-summary.json", "result.json", "result.md"]) expect(existsSync(join(EN18, name, file)), `${name}/${file}`).toBe(true);
    const result = JSON.parse(readFileSync(join(EN18, name, "result.json"), "utf8")) as RunResult;
    expect(result.ok, `${name} must have passed its checks`).toBe(true);
    expect(result.checks.length).toBeGreaterThan(3);
    expect(result.runner.runUrl, `${name} names its run`).toBe(headline);
    expect(JSON.parse(readFileSync(join(EN18, name, "k6-summary.json"), "utf8")).metrics.http_reqs.values.count).toBeGreaterThan(0);
    expect(readme, `the write-up covers ${name}`).toContain(`${name}`);
  });

  it("states what the spike achieved, and says the HPA was not demonstrated", () => {
    expect(readme).toMatch(/Rate achieved/);
    expect(readme).toMatch(/not demonstrated/i);
    expect(readme).toMatch(/identity stand-in|Identity is a stand-in/i);
  });
});

describe("EN-20 evidence", () => {
  const PARTS = ["## Hypothesis", "## Injection", "## Pass condition", "## Actual result", "## Fix log"];
  const RAN = ["2-broker-outage.md", "3-slow-database.md", "4-public-outage.md", "5-duplicate-delivery.md"];
  const NOT_RUN = ["1-crash-mid-cancellation.md", "6-partition-and-reduced-capacity.md"];

  it.each([...RAN, ...NOT_RUN])("%s has a hypothesis, an injection, a pass condition, a result and a fix log", (file) => {
    const text = readFileSync(join(EN20, file), "utf8");
    for (const part of PARTS) expect(text, `${file} needs ${part}`).toContain(part);
  });

  it.each(RAN)("%s names the run it came from", (file) => {
    const text = readFileSync(join(EN20, file), "utf8");
    expect(text).toMatch(RUN_URL);
    expect(text).toMatch(/\*\*Status:\*\* Run in CI/);
  });

  it.each(NOT_RUN)("%s says it was not run, and names what blocks it", (file) => {
    const text = readFileSync(join(EN20, file), "utf8");
    expect(text).toMatch(/\*\*Status:\*\* Not run/);
    expect(text).toMatch(/\*\*Not run\.\*\*/);
    expect(text).not.toMatch(RUN_URL);
  });
});
