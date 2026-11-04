/**
 * Assembles the Week 12 zip (Week 4 project instructions: one .zip, numbered sub-folders 1-7) and
 * the manifest that ticks each required part as present, placeholder or missing.
 * Called from build-submission.ts; the spreadsheets for folders 3 and 4 are made there.
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import JSZip from "jszip";

export type PartStatus = "present" | "placeholder" | "missing";
export interface Part {
  folder: string;
  part: string;
  status: PartStatus;
  detail: string;
}

export const FOLDERS = {
  backlog: "1. Product Backlog",
  design: "2. System Design (C4)",
  tests: "3. Test Cases",
  meetings: "4. Sprint Meetings",
  deck: "5. Slide Deck",
  release: "6. Software Release",
  readme: "7. README and Git Access",
} as const;

/** Kept out of the release tree: dependencies, the example submissions, local-only notes. */
export const RELEASE_EXCLUDES = ["*.zip", "node_modules", "HANDOFF.local.md"];
const OPEN_ITEM = /\bTODO\b/;
const FIXED_DATE = new Date("2026-11-04T00:00:00Z");

/** A placeholder file is only finished once no TODO is left in it. */
export function placeholderStatus(text: string): PartStatus {
  return OPEN_ITEM.test(text) ? "placeholder" : "present";
}

export interface CoverageCounts {
  repository: { url: string; commit: string; commit_date: string };
  e2e_cards: { total: number; per_status: Record<string, number> };
  unit_tests: { total: number; files: number; per_status: Record<string, number>; cases_run: number };
  integration_tests: { total: number; files: number; per_status: Record<string, number>; cases_run: number };
  playwright_browser_tests: { test_calls_in_specs: number; spec_files: number };
  integration_status_source: { url: string; headSha: string; date: string };
}

const n = (v: number) => v.toLocaleString("en-US");
const statusList = (s: Record<string, number>) => Object.entries(s).map(([k, v]) => `${n(v)} ${k}`).join(", ");

/** The coverage statement, using only numbers that counts.json (made from CI and a local run) holds. */
export function renderCoverageStatement(c: CoverageCounts): string {
  return [
    "# Coverage statement",
    "",
    `Source: \`counts.json\`, measured on commit \`${c.repository.commit.slice(0, 8)}\` (${c.repository.commit_date}).`,
    "",
    "| Level | Count | Result |",
    "|---|---|---|",
    `| Unit tests | ${n(c.unit_tests.total)} tests in ${c.unit_tests.files} files (${n(c.unit_tests.cases_run)} cases run) | ${statusList(c.unit_tests.per_status)} (local run) |`,
    `| Integration tests | ${n(c.integration_tests.total)} tests in ${c.integration_tests.files} files (${n(c.integration_tests.cases_run)} cases run) | ${statusList(c.integration_tests.per_status)}; CI run ${c.integration_status_source.url} (${c.integration_status_source.date}, head ${c.integration_status_source.headSha.slice(0, 8)}) |`,
    `| Browser (Playwright) tests | ${c.playwright_browser_tests.test_calls_in_specs} tests in ${c.playwright_browser_tests.spec_files} spec files | run in CI |`,
    `| Functional test cards | ${n(c.e2e_cards.total)} | ${statusList(c.e2e_cards.per_status)} |`,
    "",
    "Gates CI enforces on every pull request (see `.github/workflows/ci.yml` and `mutation.yml`): domain code at 100% unit coverage, a mutation score of at least 80% on changed domain files, lint and typecheck, squawk migration lint, gitleaks and CodeQL. This statement gives counts and results only; it does not claim a line-coverage percentage that CI does not print.",
    "",
    "Cards that are `Not Executed` or `Blocked` are listed as such in `Functional Test Cases.xlsx`; none is recorded as passed without a test that ran.",
    "",
  ].join("\n");
}

/** Normalises an origin URL (ssh or https) to the browsable https URL. */
export function normaliseGitUrl(remote: string): string {
  return remote.trim().replace(/^git@github\.com:/, "https://github.com/").replace(/\.git$/, "");
}

function listFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? listFiles(join(dir, e.name)) : [join(dir, e.name)],
  );
}

interface Ctx {
  repo: string;
  out: string;
  deliverables: string | null;
  ref: string;
  parts: Part[];
}

const add = (ctx: Ctx, folder: string, part: string, status: PartStatus, detail: string) =>
  ctx.parts.push({ folder, part, status, detail });

/** Copies one file in; records present, or missing with where it was expected. */
function copyIn(ctx: Ctx, from: string | null, toDir: string, toName: string, folder: string, part: string) {
  if (from && existsSync(from)) {
    mkdirSync(toDir, { recursive: true });
    copyFileSync(from, join(toDir, toName));
    add(ctx, folder, part, "present", toName);
  } else {
    add(ctx, folder, part, "missing", `expected ${from ?? "a --deliverables folder"}`);
  }
}

function placeholder(ctx: Ctx, rel: string, toDir: string, toName: string, folder: string, part: string) {
  const text = readFileSync(join(ctx.repo, rel), "utf8");
  mkdirSync(toDir, { recursive: true });
  writeFileSync(join(toDir, toName), text);
  add(ctx, folder, part, placeholderStatus(text), toName);
}

function copyTree(ctx: Ctx, from: string, to: string, folder: string, part: string) {
  rmSync(to, { recursive: true, force: true });
  if (!existsSync(from)) return add(ctx, folder, part, "missing", `${relative(ctx.repo, from)} not found`);
  cpSync(from, to, { recursive: true });
  add(ctx, folder, part, "present", `${listFiles(to).length} files`);
}

function assembleBacklog(ctx: Ctx) {
  const dir = join(ctx.out, FOLDERS.backlog);
  const src = (f: string) => join(ctx.repo, "documentation/backlog", f);
  copyIn(ctx, src("jira-export.json"), dir, "jira-export.json", FOLDERS.backlog, "Product backlog export (JSON, from Jira SPM)");
  copyIn(ctx, src("jira-export.xlsx"), dir, "jira-export.xlsx", FOLDERS.backlog, "Product backlog export (Excel, from Jira SPM)");
}

function assembleDesign(ctx: Ctx) {
  const dir = join(ctx.out, FOLDERS.design);
  copyTree(ctx, join(ctx.repo, "documentation/c4"), join(dir, "C4"), FOLDERS.design, "C4 model (Structurizr DSL, README, rendered diagrams)");
  copyTree(ctx, join(ctx.repo, "documentation/adr"), join(dir, "Architecture Decision Records"), FOLDERS.design, "Architecture decision records");
}

function assembleTests(ctx: Ctx) {
  const dir = join(ctx.out, FOLDERS.tests);
  const f = FOLDERS.tests;
  for (const [file, part] of [
    ["Functional Test Cases.xlsx", "Functional test cases (Excel, all stories)"],
    ["Automated Test Traceability.xlsx", "Story to automated test traceability (Excel)"],
  ]) add(ctx, f, part, existsSync(join(dir, file)) ? "present" : "missing", file);

  const cardsDir = join(dir, "Test Cards (Markdown)");
  rmSync(cardsDir, { recursive: true, force: true });
  const tests = join(ctx.repo, "tests");
  const cards = listFiles(tests).filter((p) => p.endsWith(".md"));
  for (const card of cards) {
    const to = join(cardsDir, relative(tests, card));
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(card, to);
  }
  add(ctx, f, "Test cards, one file per case (tests/)", cards.length ? "present" : "missing", `${cards.length} files`);
  copyTree(ctx, join(ctx.repo, "documentation/traceability"), join(dir, "Traceability CSV"), f, "Traceability matrix (CSV per story)");

  const d = ctx.deliverables;
  copyIn(ctx, d && join(d, "Unit Test Scripts - ConnectSphere.xlsx"), dir, "Unit Test Scripts - ConnectSphere.xlsx", f, "Unit test script (Excel)");
  copyIn(ctx, d && join(d, "End-to-End Test Scripts - ConnectSphere.xlsx"), dir, "End-to-End Test Scripts - ConnectSphere.xlsx", f, "End-to-end test script (Excel)");
  const counts = d && join(d, "counts.json");
  if (counts && existsSync(counts)) {
    copyFileSync(counts, join(dir, "counts.json"));
    writeFileSync(join(dir, "Coverage Statement.md"), renderCoverageStatement(JSON.parse(readFileSync(counts, "utf8"))));
    add(ctx, f, "Coverage statement with CI numbers", "present", "Coverage Statement.md, from counts.json");
  } else {
    add(ctx, f, "Coverage statement with CI numbers", "missing", "counts.json not found in --deliverables");
  }
}

function assembleMeetings(ctx: Ctx) {
  const dir = join(ctx.out, FOLDERS.meetings);
  const f = FOLDERS.meetings;
  for (const [file, part] of [
    ["2. Sprint Updates.xlsx", "Sprint updates (stand-up log)"],
    ["3. Sprint Backlogs.xlsx", "Sprint backlogs and goals, Sprints 1 to 4"],
    ["5. Sprint 1 Review & Retrospective.md", "Sprint 1 review and retrospective"],
  ]) add(ctx, f, part, existsSync(join(dir, file)) ? "present" : "missing", file);

  const d = ctx.deliverables;
  for (let s = 1; s <= 4; s++) {
    const name = `ConnectSphere Sprint ${s}.docx`;
    copyIn(ctx, d && join(d, "Sprint docs", name), join(dir, "Sprint docs"), name, f, `Sprint ${s} document`);
  }
  for (const ceremony of ["Daily Stand-up", "Sprint Review", "Sprint Retrospective"]) {
    for (const ext of ["md", "docx"]) {
      const name = `Sprint 4 - ${ceremony} Script.${ext}`;
      copyIn(ctx, d && join(d, name), join(dir, "Sprint 4 Meeting Scripts"), name, f, `Sprint 4 ${ceremony.toLowerCase()} script (.${ext})`);
    }
  }
  copyIn(ctx, d && join(d, "IS212 Week 11 - ConnectSphere.pptx"), dir, "Week 11 Slides.pptx", f, "Week 11 slides");
  placeholder(ctx, "documentation/week12-submission/recordings-required.md", dir, "6. Final Sprint Recordings - PLACEHOLDER.md", f, "Final sprint recordings: planning, review, retro, one stand-up (unlisted video links)");
}

function assembleDeck(ctx: Ctx) {
  const pdf = ctx.deliverables && join(ctx.deliverables, "IS212 Week 11 - ConnectSphere.pdf");
  copyIn(ctx, pdf, join(ctx.out, FOLDERS.deck), "ConnectSphere Slide Deck.pdf", FOLDERS.deck, "Slide deck (PDF)");
  if (ctx.parts[ctx.parts.length - 1].status === "present") {
    ctx.parts[ctx.parts.length - 1].detail = "PDF of the Week 11 deck; whether it follows the eLearn template is a human check";
  }
}

function assembleRelease(ctx: Ctx) {
  const dir = join(ctx.out, FOLDERS.release);
  const f = FOLDERS.release;
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const excludes = RELEASE_EXCLUDES.flatMap((p) => [`:(exclude,glob)**/${p}`, `:(exclude)${p}`]);
  const tar = execFileSync("git", ["-C", ctx.repo, "archive", "--format=tar", ctx.ref, "--", ".", ...excludes], { maxBuffer: 1 << 30 });
  execFileSync("tar", ["-xf", "-"], { cwd: dir, input: tar });
  const count = listFiles(dir).length;
  add(ctx, f, `Source tree (git archive of ${ctx.ref})`, count ? "present" : "missing", `${count} files, without node_modules and example zips`);
  add(ctx, f, "README with run instructions", existsSync(join(dir, "README.md")) ? "present" : "missing", "README.md");
  const hasTests = existsSync(join(dir, "backend")) && existsSync(join(dir, "tests"));
  add(ctx, f, "Unit and integration test classes", hasTests ? "present" : "missing", "beside the code under backend/ and frontend/, plus tests/");
  const workflows = listFiles(join(dir, ".github/workflows"));
  add(ctx, f, "CI pipeline files", workflows.length ? "present" : "missing", workflows.map((w) => basename(w)).join(", "));
}

function assembleReadme(ctx: Ctx) {
  const dir = join(ctx.out, FOLDERS.readme);
  placeholder(ctx, "documentation/week12-submission/git-access.md", dir, "README.md", FOLDERS.readme, "README with the Git repository link and instructor access");
  const last = ctx.parts[ctx.parts.length - 1];
  const remote = normaliseGitUrl(execFileSync("git", ["-C", ctx.repo, "remote", "get-url", "origin"], { encoding: "utf8" }));
  if (readFileSync(join(dir, "README.md"), "utf8").includes(remote)) {
    last.detail = "repository link present; instructor access has to be granted and recorded by the repository owner";
  } else {
    last.status = "missing";
    last.detail = `link does not match origin ${remote}`;
  }
}

export function assemblePackage(opts: { repo: string; out: string; deliverables: string | null; ref: string }): Part[] {
  const ctx: Ctx = { ...opts, parts: [] };
  assembleBacklog(ctx);
  assembleDesign(ctx);
  assembleTests(ctx);
  assembleMeetings(ctx);
  assembleDeck(ctx);
  assembleRelease(ctx);
  assembleReadme(ctx);
  return ctx.parts;
}

const MARK: Record<PartStatus, string> = { present: "[x] present", placeholder: "[~] PLACEHOLDER", missing: "[ ] MISSING" };

export function renderManifest(parts: Part[], zipFiles: Record<string, number>, ref: string): string {
  const count = (s: PartStatus) => parts.filter((p) => p.status === s).length;
  const lines = [
    "# ConnectSphere submission manifest",
    "",
    `Built by \`npm run submission:build\` from \`${ref}\`.`,
    "",
    `Parts: ${count("present")} present, ${count("placeholder")} placeholder, ${count("missing")} missing.`,
    "",
  ];
  for (const folder of Object.values(FOLDERS)) {
    lines.push(`## ${folder}`, "", `Files in the zip: ${zipFiles[folder] ?? 0}`, "", "| Status | Required part | Detail |", "|---|---|---|");
    for (const p of parts.filter((x) => x.folder === folder)) {
      lines.push(`| ${MARK[p.status]} | ${p.part} | ${p.detail.replace(/\|/g, "/")} |`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

/** Zips the numbered folders plus MANIFEST.md, with fixed timestamps so a rebuild gives the same bytes. */
export async function writeZip(out: string, manifest: string, zipPath: string): Promise<Record<string, number>> {
  const zip = new JSZip();
  const perFolder: Record<string, number> = {};
  for (const folder of Object.values(FOLDERS)) {
    const root = join(out, folder);
    const files = listFiles(root).sort();
    perFolder[folder] = files.length;
    for (const file of files) {
      zip.file(`${folder}/${relative(root, file).split("\\").join("/")}`, readFileSync(file), { date: FIXED_DATE });
    }
  }
  zip.file("MANIFEST.md", manifest, { date: FIXED_DATE });
  const buf = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
  mkdirSync(dirname(zipPath), { recursive: true });
  writeFileSync(zipPath, buf);
  return perFolder;
}
