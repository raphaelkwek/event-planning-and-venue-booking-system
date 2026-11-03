import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * EN-05-T5: runs the real command, `backend/scripts/schema-compat.ts`, inside
 * a throwaway git repository, so reading the schemas at a git ref is tested
 * with real git and not a fake. The repository's base commit holds copies of
 * the committed schema files, edited per test.
 */

const script = fileURLToPath(new URL("../../../../scripts/schema-compat.ts", import.meta.url));
const schemaDir = fileURLToPath(new URL("../../schemas/", import.meta.url));
const tsxCli = createRequire(import.meta.url).resolve("tsx/cli");
const SCHEMAS = "backend/packages/contracts/schemas";
const COUNT = readdirSync(schemaDir).filter((file) => file.endsWith(".json")).length;

let sandbox = "";

function git(cwd: string, ...args: string[]) {
  return execFileSync("git", ["-c", "user.name=test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "-c", "core.autocrlf=false", ...args], {
    cwd,
    encoding: "utf8",
  });
}

function newRepo(name: string, edit: (files: Map<string, Record<string, unknown>>) => void, withSchemas = true): string {
  const cwd = join(sandbox, name);
  mkdirSync(join(cwd, SCHEMAS), { recursive: true });
  git(cwd, "init", "-q", "-b", "main");
  writeFileSync(join(cwd, "README.md"), "base\n");
  if (withSchemas) {
    const files = new Map<string, Record<string, unknown>>(
      readdirSync(schemaDir)
        .filter((file) => file.endsWith(".json"))
        .map((file) => [file, JSON.parse(readFileSync(join(schemaDir, file), "utf8")) as Record<string, unknown>]),
    );
    edit(files);
    for (const [file, schema] of files) writeFileSync(join(cwd, SCHEMAS, file), `${JSON.stringify(schema, null, 2)}\n`);
  }
  git(cwd, "add", "-A");
  git(cwd, "commit", "-q", "-m", "base");
  return cwd;
}

function run(cwd: string, ...args: string[]) {
  const result = spawnSync(process.execPath, [tsxCli, script, ...args], { cwd, encoding: "utf8" });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

beforeAll(() => {
  sandbox = mkdtempSync(join(tmpdir(), "en05-compat-"));
});

afterAll(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

describe("EN-05-T5 the command compares this branch with its base ref, using real git", () => {
  it("EN-05-T5 exits 0 when the branch changes nothing", { timeout: 60_000 }, () => {
    const cwd = newRepo("unchanged", () => undefined);
    const { status, output } = run(cwd, "compat", "--base", "HEAD");
    expect(output).toContain(`${COUNT} unchanged, 0 changed compatibly, 0 new, 0 breaking.`);
    expect(status).toBe(0);
  });

  it("EN-05-T5 exits 0 when the branch adds an optional field", { timeout: 60_000 }, () => {
    const cwd = newRepo("optional-added", (files) => {
      const schema = files.get("event.coordinator-assigned.json") as { properties: Record<string, unknown> };
      delete schema.properties.coordinatorName;
    });
    const { status, output } = run(cwd, "compat", "--base", "HEAD");
    expect(output).toContain("changed compatibly: event.coordinator-assigned");
    expect(status).toBe(0);
  });

  it("EN-05-T5 exits 1 and names the field when the branch removes a required one", { timeout: 60_000 }, () => {
    const cwd = newRepo("required-removed", (files) => {
      const schema = files.get("event.approved.json") as { properties: Record<string, unknown>; required: string[] };
      schema.properties.legacyNote = { type: "string" };
      schema.required.push("legacyNote");
    });
    const { status, output } = run(cwd, "compat", "--base", "HEAD");
    expect(output).toContain("BREAKING event.approved $.legacyNote [property-removed]");
    expect(status).toBe(1);
  });

  it("EN-05-T5 exits 1 when the branch drops a message type", { timeout: 60_000 }, () => {
    const cwd = newRepo("type-dropped", (files) => {
      files.set("event.dropped.json", { type: "object", properties: {}, additionalProperties: false });
    });
    const { status, output } = run(cwd, "compat", "--base", "HEAD");
    expect(output).toContain("BREAKING event.dropped $ [message-removed]");
    expect(status).toBe(1);
  });

  it("EN-05-T5 exits 0 and says there is nothing to compare when the base has no schema files yet", { timeout: 60_000 }, () => {
    const cwd = newRepo("no-baseline", () => undefined, false);
    const { status, output } = run(cwd, "compat", "--base", "HEAD");
    expect(output).toContain('"HEAD" has no committed schema files yet');
    expect(status).toBe(0);
  });

  it("EN-05-T5 exits non-zero and names the ref when it does not exist", { timeout: 60_000 }, () => {
    const cwd = newRepo("bad-ref", () => undefined);
    const { status, output } = run(cwd, "compat", "--base", "origin/nowhere");
    expect(output).toContain('Cannot read the schemas at "origin/nowhere"');
    expect(status).not.toBe(0);
  });

  it("EN-05-T4 check fails in a repository whose committed files are not what contracts generates", { timeout: 60_000 }, () => {
    const cwd = newRepo("drifted", (files) => {
      files.delete("event.approved.json");
      files.set("event.stale.json", { type: "object" });
    });
    const { status, output } = run(cwd, "check");
    expect(output).toContain("missing: event.approved.json is not committed");
    expect(output).toContain("stale: event.stale.json has no schema in contracts");
    expect(status).toBe(1);
  });

  it("EN-05-T4 generate writes the files that check then accepts", { timeout: 60_000 }, () => {
    const cwd = newRepo("generated", () => undefined, false);
    expect(run(cwd, "generate").status).toBe(0);
    expect(readdirSync(join(cwd, SCHEMAS)).length).toBe(COUNT);
    const { status, output } = run(cwd, "check");
    expect(output).toContain(`The ${COUNT} committed schema files match contracts.`);
    expect(status).toBe(0);
  });
});
