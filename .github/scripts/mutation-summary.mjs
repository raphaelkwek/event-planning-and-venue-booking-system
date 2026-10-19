// EN-06.2: turns each workspace's Stryker JSON report into a Markdown table for
// the CI job summary, so a pull request shows its mutation score at a glance.
// The score is the share of planted bugs some test caught: killed and timed-out
// mutants over every mutant a test could have caught (survived and no coverage too).
import { existsSync, readFileSync } from "node:fs";

const WORKSPACES = [
  ["planning-core", "backend/services/planning-core"],
  ["notification", "backend/services/notification"],
];
const CAUGHT = new Set(["Killed", "Timeout"]);
const COUNTED = new Set(["Killed", "Timeout", "Survived", "NoCoverage"]);

function score(caught, counted) {
  return counted === 0 ? "n/a" : `${Math.round((caught / counted) * 10000) / 100}%`;
}

const rows = WORKSPACES.flatMap(([name, dir]) => {
  const file = `${dir}/reports/mutation/mutation.json`;
  if (!existsSync(file)) return [`| ${name} | not run (no domain code changed) | | | |`];
  const report = JSON.parse(readFileSync(file, "utf8"));
  const statuses = Object.values(report.files).flatMap((f) => f.mutants.map((m) => m.status));
  const count = (wanted) => statuses.filter((s) => wanted.has(s)).length;
  const survived = statuses.filter((s) => s === "Survived").length;
  const noCoverage = statuses.filter((s) => s === "NoCoverage").length;
  return [
    `| ${name} | **${score(count(CAUGHT), count(COUNTED))}** | ${count(CAUGHT)} | ${survived} | ${noCoverage} |`,
  ];
});

console.log(
  [
    "### Mutation score (domain code, Stryker)",
    "",
    "The build fails below 80%. Open the `mutation-reports` artifact to see each surviving mutant.",
    "",
    "| Workspace | Score | Caught | Survived | No coverage |",
    "|---|---|---|---|---|",
    ...rows,
  ].join("\n"),
);
