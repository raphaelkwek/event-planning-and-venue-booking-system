// EN-14: turns the Playwright JSON report and the axe findings into Markdown for the e2e job's
// summary: each journey's result by project, with its story tags, and every accessibility
// violation axe reported, whatever its impact (serious and critical ones also fail the test).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { markdownCell } from "./markdown-cell.mjs";

const RESULTS = "tests/test-results/results.json";
const AXE_DIR = "tests/test-results/axe-findings";

function collectSpecs(suite, file, out) {
  for (const spec of suite.specs ?? []) {
    for (const test of spec.tests ?? []) {
      out.push({ file: spec.file ?? file, title: spec.title, tags: spec.tags ?? [], project: test.projectName, status: test.status, results: test.results ?? [] });
    }
  }
  for (const child of suite.suites ?? []) collectSpecs(child, child.file ?? file, out);
}

const OUTCOME = { expected: "passed", unexpected: "failed", flaky: "flaky (passed on retry)", skipped: "skipped" };

const lines = ["### Browser tests (Playwright, ephemeral stack)", ""];

if (!existsSync(RESULTS)) {
  lines.push("No Playwright report was written: the stack or the run failed before any test finished. See the `e2e-stack-logs` artifact.");
} else {
  const report = JSON.parse(readFileSync(RESULTS, "utf8"));
  const tests = [];
  for (const suite of report.suites ?? []) collectSpecs(suite, suite.file, tests);
  const count = (status) => tests.filter((t) => t.status === status).length;
  lines.push(
    `**${count("expected")} passed, ${count("unexpected")} failed, ${count("flaky")} flaky, ${count("skipped")} skipped** across ${tests.length} test runs.`,
    "",
    "| Result | Project | Test | Tags |",
    "|---|---|---|---|",
    ...tests.map((t) => `| ${OUTCOME[t.status] ?? t.status} | ${markdownCell(t.project)} | ${markdownCell(`${t.file} › ${t.title}`)} | ${markdownCell(t.tags.join(" "))} |`),
  );
}

lines.push("", "#### Accessibility (axe, WCAG 2.1 A and AA)", "");
const findings = existsSync(AXE_DIR)
  ? readdirSync(AXE_DIR).flatMap((file) => JSON.parse(readFileSync(join(AXE_DIR, file), "utf8")))
  : [];
if (findings.length === 0) {
  lines.push("No violations on any screen visited.");
} else {
  const grouped = new Map();
  for (const finding of findings) {
    const key = `${finding.impact}|${finding.id}|${finding.screen}|${finding.project}`;
    grouped.set(key, { ...finding, count: (grouped.get(key)?.count ?? 0) + 1 });
  }
  lines.push(
    "| Impact | Rule | Screen | Project | Elements |",
    "|---|---|---|---|---|",
    ...[...grouped.values()].map((f) => `| ${markdownCell(f.impact)} | [${markdownCell(f.id)}](${f.helpUrl}) | ${markdownCell(f.screen)} | ${markdownCell(f.project)} | ${markdownCell(f.targets.slice(0, 3).join("; "))}${f.targets.length > 3 ? ` and ${f.targets.length - 3} more` : ""} |`),
  );
}

console.log(lines.join("\n"));
