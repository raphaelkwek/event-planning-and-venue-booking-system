// ADR-0016 amendment: the parts of `npm run deploy:space` that need no network. Run by
// `npm run test:scripts`. Every fake value is built at run time, so no secret scanner mistakes a
// test for a leak; the secrets directory is a fake one in a temp dir, never the real one.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DeployError, loadEnvironment, masker, parseEnvFile, requireKeys, spaceFor, spaceReadme, withPassword, writeContext } from "./deploy-space.mjs";

const fake = (label) => `${label}-${"k".repeat(12)}`;
const PASSWORD = ["p@ss", "w/rd", "#1"].join(":");
const REF = "abcdefghijklmnopqrst";
const pooler = (port) => `postgresql://postgres.${REF}:[YOUR-PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:${port}/postgres`;

function fakeSecretsDir({ shared = {}, staging = {} } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "fake-secrets-"));
  const lines = (values) => Object.entries(values).map(([k, v]) => `${k}=${v}`).join("\r\n");
  writeFileSync(join(dir, "shared.env"), `# tokens\r\n${lines({ HF_TOKEN: fake("hf"), VERCEL_TOKEN: fake("vercel"), ...shared })}\r\n`);
  writeFileSync(
    join(dir, "staging.env"),
    [
      "# the staging Supabase project",
      lines({
        DB_PASSWORD: PASSWORD,
        DATABASE_URL: pooler(6543),
        MIGRATE_DATABASE_URL: pooler(5432),
        SUPABASE_URL: `https://${REF}.supabase.co/`,
        SUPABASE_ANON_KEY: fake("anon"),
        SUPABASE_SERVICE_ROLE_KEY: fake("service"),
        ...staging,
      }),
      "",
    ].join("\n")
  );
  return dir;
}

test("DEPLOY-T18 the secrets files are read with comments, CRLF, quotes and = in values", () => {
  assert.deepEqual(parseEnvFile('# comment\r\nA=1\r\n\r\nB="two words"\nC=x=y\n  # indented comment\n'), { A: "1", B: "two words", C: "x=y" });
  assert.throws(() => parseEnvFile("not a pair\n"), DeployError);
});

test("DEPLOY-T18 a blank key is refused, naming every blank key and no value", () => {
  assert.throws(() => requireKeys({ A: "1", B: "", C: "replace-with-x" }, ["A", "B", "C", "D"], "staging.env"), /staging\.env has no value for B, C, D/);
  const dir = fakeSecretsDir({ shared: { VERCEL_TOKEN: "" } });
  try {
    assert.throws(() => loadEnvironment(dir, "staging"), (error) => error instanceof DeployError && /shared\.env has no value for VERCEL_TOKEN/.test(error.message) && !error.message.includes(fake("hf")));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("DEPLOY-T18 the database password replaces [YOUR-PASSWORD] URL-encoded, and the Space gets the five values", () => {
  assert.equal(withPassword(pooler(5432), PASSWORD, "MIGRATE_DATABASE_URL"), pooler(5432).replace("[YOUR-PASSWORD]", encodeURIComponent(PASSWORD)));
  assert.throws(() => withPassword(`https://${REF}.supabase.co`, PASSWORD, "DATABASE_URL"), /DATABASE_URL has neither/);
  const dir = fakeSecretsDir();
  try {
    const loaded = loadEnvironment(dir, "staging");
    assert.deepEqual(Object.keys(loaded.space), ["DATABASE_URL", "MIGRATE_DATABASE_URL", "SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"]);
    assert.ok(loaded.space.DATABASE_URL.includes(`:${encodeURIComponent(PASSWORD)}@`));
    assert.ok(loaded.space.DATABASE_URL.endsWith(":6543/postgres"));
    assert.equal(loaded.space.SUPABASE_URL, `https://${REF}.supabase.co`);
    assert.throws(() => loadEnvironment(dir, "dev"), /--env must be staging or production/);
    assert.throws(() => loadEnvironment(dir, "production"), /cannot read/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("DEPLOY-T18 every secret, and its URL-encoded and base64 forms, is masked in output", () => {
  const token = fake("hf");
  const mask = masker([token, PASSWORD, ""]);
  const line = `push https://x:${encodeURIComponent(PASSWORD)}@h ${Buffer.from(token).toString("base64")} and ${token} and ${PASSWORD}`;
  const masked = mask(line);
  assert.ok(!masked.includes(token) && !masked.includes(PASSWORD) && !masked.includes(encodeURIComponent(PASSWORD)));
  assert.ok(!masked.includes(Buffer.from(token).toString("base64")));
  assert.equal(masked.split("***").length - 1, 4);
});

test("DEPLOY-T18 each environment has its own public Space host, and the Space repository builds the Dockerfile", () => {
  assert.deepEqual(spaceFor("Joash_L", "staging"), {
    repo: "Joash_L/connectsphere-staging",
    name: "connectsphere-staging",
    host: "joash-l-connectsphere-staging.hf.space",
    origin: "https://joash-l-connectsphere-staging.hf.space",
  });
  assert.equal(spaceFor("joash", "production").host, "joash-connectsphere-production.hf.space");
  const readme = spaceReadme("staging");
  assert.match(readme, /^---\ntitle: ConnectSphere staging\nsdk: docker\napp_port: 7860\n/);
  const dir = mkdtempSync(join(tmpdir(), "space-context-"));
  try {
    const count = writeContext(dir, "staging");
    assert.ok(count > 100);
    // From the commit, with LF line endings even on a Windows checkout: start.sh runs in the container.
    assert.equal(readFileSync(join(dir, "Dockerfile"), "utf8"), readFileSync(join(dir, "deploy/space/Dockerfile"), "utf8"));
    assert.ok(!readFileSync(join(dir, "deploy/space/start.sh"), "utf8").includes(String.fromCharCode(13)));
    assert.match(readFileSync(join(dir, "Dockerfile"), "utf8"), /start\.sh/);
    for (const file of ["package-lock.json", "backend/scripts/migrate.ts", "deploy/space/start.sh", "deploy/cerbos/config.yaml", "policies/resources/venue.yaml"]) {
      assert.ok(readFileSync(join(dir, file)).length > 0, file);
    }
    assert.throws(() => readFileSync(join(dir, "frontend/src/App.tsx")));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
