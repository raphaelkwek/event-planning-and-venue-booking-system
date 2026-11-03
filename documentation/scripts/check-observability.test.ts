import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

/**
 * EN-17-T10. Three promises the SLO files make to the people on call:
 *   1. every alert has a runbook that has the sections the on-call needs;
 *   2. every dashboard is valid JSON and queries only metrics that exist;
 *   3. a metric "exists" when the service source emits it or a recording rule defines it.
 */

const REPO = fileURLToPath(new URL("../../", import.meta.url));
const path = (...parts: string[]) => join(REPO, ...parts);

const RUNBOOK_SECTIONS = ["## Symptoms", "## First checks", "## Mitigation", "## Escalation", "## Dashboards"];

/** Metrics the services emit; each must also appear in the service source. */
const EMITTED: Record<string, string> = {
  http_request_duration_seconds: "backend/packages/observability/src/metrics.ts",
  http_requests_total: "backend/packages/observability/src/metrics.ts",
  notification_visibility_lag_seconds: "backend/services/notification/src/metrics.ts",
  registration_over_admission_seats: "backend/services/registration/src/overAdmission.ts",
  registration_invariant_check_success: "backend/services/registration/src/overAdmission.ts",
};
/** Written by Prometheus itself rather than by a service. */
const PROMETHEUS_OWN = ["up"];
const SUFFIXES = ["", "_bucket", "_count", "_sum"];

const FUNCTIONS = new Set([
  "sum", "rate", "histogram_quantile", "topk", "by", "and", "or", "on", "without", "avg", "max", "min", "increase", "irate",
]);

interface Rule { alert?: string; record?: string; expr: string; annotations?: Record<string, string> }
interface RuleFile { groups: { name: string; rules: Rule[] }[] }

function rulesIn(file: string): Rule[] {
  return (parse(readFileSync(path("observability/prometheus/rules", file), "utf8")) as RuleFile).groups.flatMap((g) => g.rules);
}

function knownMetrics(): Set<string> {
  const known = new Set<string>(PROMETHEUS_OWN);
  for (const base of Object.keys(EMITTED)) for (const suffix of SUFFIXES) known.add(base + suffix);
  for (const rule of rulesIn("recording.yml")) known.add(rule.record!);
  return known;
}

/** The metric names a PromQL expression reads: what is left after labels, strings and functions are removed. */
export function metricsIn(expr: string): string[] {
  const bare = expr
    .replace(/"[^"]*"/g, "")
    .replace(/\{[^}]*\}/g, "")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/\b(by|without|on)\s*\([^)]*\)/g, "");
  const tokens = bare.match(/[a-zA-Z_:][a-zA-Z0-9_:]*/g) ?? [];
  return [...new Set(tokens.filter((t) => !FUNCTIONS.has(t)))];
}

test("EN-17-T10 metricsIn finds metric names and ignores labels, strings, windows and functions", () => {
  assert.deepEqual(
    metricsIn('1 - sum by (service) (rate(http_requests_total{route!~"/a|/b",status="5xx"}[28d])) / 0.05'),
    ["http_requests_total"],
  );
  assert.deepEqual(metricsIn("sli:x:ratio_rate1h / 0.001"), ["sli:x:ratio_rate1h"]);
});

test("EN-17-T10 every metric the SLOs rely on is emitted by the service source", () => {
  for (const [metric, file] of Object.entries(EMITTED)) {
    assert.ok(existsSync(path(file)), `${file} is missing`);
    assert.ok(readFileSync(path(file), "utf8").includes(`"${metric}"`), `${file} does not define ${metric}`);
  }
});

test("EN-17-T10 every alert has a runbook with the required sections", () => {
  const alerts = rulesIn("alerts.yml").filter((r) => r.alert);
  assert.ok(alerts.length >= 11, `expected at least 11 alerts, found ${alerts.length}`);
  for (const rule of alerts) {
    const name = rule.alert!;
    assert.ok(rule.annotations?.runbook_url?.endsWith(`/documentation/runbooks/${name}.md`), `${name}: runbook_url must end in /documentation/runbooks/${name}.md`);
    const file = path("documentation/runbooks", `${name}.md`);
    assert.ok(existsSync(file), `${name}: documentation/runbooks/${name}.md does not exist`);
    const text = readFileSync(file, "utf8");
    for (const section of RUNBOOK_SECTIONS) assert.ok(text.includes(section), `${name}: runbook lacks "${section}"`);
    const dashboard = rule.annotations?.dashboard ?? "";
    assert.ok(existsSync(path(dashboard)), `${name}: dashboard annotation ${dashboard} does not exist`);
    assert.ok(text.includes(dashboard), `${name}: runbook does not link ${dashboard}`);
  }
});

test("EN-17-T10 there is no runbook without an alert", () => {
  const names = new Set(rulesIn("alerts.yml").filter((r) => r.alert).map((r) => r.alert));
  for (const file of readdirSync(path("documentation/runbooks")).filter((f) => f.endsWith(".md") && f !== "README.md")) {
    assert.ok(names.has(file.replace(/\.md$/, "")), `${file} documents an alert that does not exist`);
  }
});

test("EN-17-T10 rules query only known metrics", () => {
  const known = knownMetrics();
  for (const rule of [...rulesIn("recording.yml"), ...rulesIn("alerts.yml")]) {
    for (const metric of metricsIn(rule.expr)) assert.ok(known.has(metric), `${rule.alert ?? rule.record}: unknown metric ${metric}`);
  }
});

interface Panel { title: string; targets?: { expr: string }[] }
interface Dashboard { uid?: string; title?: string; panels?: Panel[] }

test("EN-17-T10 every dashboard is valid JSON with a uid and panels, and queries only known metrics", () => {
  const dir = path("observability/grafana/dashboards");
  const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
  assert.ok(files.length >= 5, `expected a dashboard per SLO area, found ${files.length}`);
  const known = knownMetrics();
  const uids = new Set<string>();
  for (const file of files) {
    const dashboard = JSON.parse(readFileSync(join(dir, file), "utf8")) as Dashboard;
    assert.ok(dashboard.uid && dashboard.title, `${file}: uid and title are required`);
    assert.ok(!uids.has(dashboard.uid), `${file}: uid ${dashboard.uid} is used twice`);
    uids.add(dashboard.uid);
    assert.ok((dashboard.panels ?? []).length > 0, `${file}: no panels`);
    for (const panel of dashboard.panels!) {
      assert.ok((panel.targets ?? []).length > 0, `${file}: panel "${panel.title}" has no query`);
      for (const target of panel.targets!) {
        for (const metric of metricsIn(target.expr)) assert.ok(known.has(metric), `${file}: panel "${panel.title}" queries unknown metric ${metric}`);
      }
    }
  }
});

test("EN-17-T10 the files this check reads are where the CI job expects them", () => {
  for (const dir of ["observability/prometheus/rules", "observability/prometheus/tests", "documentation/runbooks"]) {
    assert.ok(statSync(path(dir)).isDirectory(), `${relative(REPO, path(dir))} is missing`);
  }
});
