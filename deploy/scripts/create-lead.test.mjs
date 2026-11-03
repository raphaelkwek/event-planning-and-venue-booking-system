// ADR-0016: the guard in front of `npm run lead:create`. Run by `npm run test:scripts`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkProject, generatePassword, LeadError, parseArgs } from "./create-lead.mjs";

const REF = "abcdefghijklmnopqrst";
const good = {
  projectRef: REF,
  supabaseUrl: `https://${REF}.supabase.co`,
  databaseUrl: `postgres://postgres.${REF}:pw@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres`,
  serviceRoleKey: "service-role-key",
};

test("DEPLOY-T14 the Auth URL and the database URL of the named project are accepted", () => {
  assert.deepEqual(checkProject(good), { supabaseUrl: `https://${REF}.supabase.co` });
  assert.deepEqual(checkProject({ ...good, databaseUrl: `postgresql://postgres:pw@db.${REF}.supabase.co:5432/postgres` }), {
    supabaseUrl: `https://${REF}.supabase.co`,
  });
});

test("DEPLOY-T14 another project's URL is refused before any request, naming the variable only", () => {
  const other = "zzzzzzzzzzzzzzzzzzzz";
  assert.throws(() => checkProject({ ...good, supabaseUrl: `https://${other}.supabase.co` }), /SUPABASE_URL is not/);
  assert.throws(
    () => checkProject({ ...good, databaseUrl: `postgres://postgres.${other}:pw@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres` }),
    (error) => error instanceof LeadError && /MIGRATE_DATABASE_URL/.test(error.message) && !error.message.includes(other)
  );
  assert.throws(() => checkProject({ ...good, serviceRoleKey: "" }), /SUPABASE_SERVICE_ROLE_KEY/);
  assert.throws(() => checkProject({ ...good, projectRef: "short" }), /project ref/);
  assert.throws(() => checkProject({ ...good, supabaseUrl: undefined }), /SUPABASE_URL/);
});

test("DEPLOY-T14 the arguments need a project ref and an email", () => {
  assert.deepEqual(parseArgs(["--project-ref", REF, "--email", "Lead@Example.org"]), {
    projectRef: REF,
    email: "lead@example.org",
    displayName: "Event Coordinator Lead",
  });
  assert.throws(() => parseArgs(["--email", "lead@example.org"]), /--project-ref/);
  assert.throws(() => parseArgs(["--project-ref", REF, "--email", "not-an-email"]), /--email/);
  assert.throws(() => parseArgs(["--project-ref", REF, "--email", "a@b.co", "--role", "X"]), /unknown argument/);
});

test("DEPLOY-T14 a generated password is long and has every character class", () => {
  const password = generatePassword();
  assert.ok(password.length >= 28);
  assert.match(password, /[A-Z]/);
  assert.match(password, /[a-z]/);
  assert.match(password, /[0-9]/);
  assert.match(password, /[^A-Za-z0-9]/);
  assert.notEqual(password, generatePassword());
});
