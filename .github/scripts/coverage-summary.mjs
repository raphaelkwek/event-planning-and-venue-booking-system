// SPM-116: turns each workspace's coverage-summary.json into a Markdown table
// for the CI job summary, so a pull request shows its coverage at a glance.
import { existsSync, readFileSync } from "node:fs";

const WORKSPACES = [
  ["planning-core", "backend/services/planning-core"],
  ["contracts", "backend/packages/contracts"],
  ["web", "frontend"],
];
const METRICS = ["lines", "branches", "functions", "statements"];

function percent(covered, total) {
  return total === 0 ? "100%" : `${Math.round((covered / total) * 10000) / 100}%`;
}

function row(name, totals) {
  return `| ${name} | ${METRICS.map((m) => percent(totals[m].covered, totals[m].total)).join(" | ")} |`;
}

const rows = WORKSPACES.flatMap(([name, dir]) => {
  const file = `${dir}/coverage/coverage-summary.json`;
  if (!existsSync(file)) return [`| ${name} | no report | | | |`];
  const summary = JSON.parse(readFileSync(file, "utf8"));
  const result = [row(name, summary.total)];

  const domainFiles = Object.entries(summary).filter(([path]) => /[\\/]domain[\\/]/.test(path));
  if (domainFiles.length > 0) {
    const domain = Object.fromEntries(
      METRICS.map((m) => [
        m,
        domainFiles.reduce(
          (sum, [, file]) => ({ covered: sum.covered + file[m].covered, total: sum.total + file[m].total }),
          { covered: 0, total: 0 }
        ),
      ])
    );
    result.push(row(`${name}, domain/ (must be 100%)`, domain));
  }
  return result;
});

console.log(
  [
    "### Unit test coverage",
    "",
    "| Workspace | Lines | Branches | Functions | Statements |",
    "|---|---|---|---|---|",
    ...rows,
    "",
    "The job fails below any threshold in a workspace's Vitest config. Full HTML reports are in the `coverage-reports` artifact.",
  ].join("\n")
);
