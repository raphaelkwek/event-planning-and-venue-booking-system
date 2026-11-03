// ADR-0016: the guard in front of `npm run lead:create`. Run by `npm run test:scripts`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkProject, inviteRequest, LeadError, parseArgs } from "./create-lead.mjs";

const REF = "abcdefghijklmnopqrst";
// Fake values built at run time, so no secret scanner mistakes a test for a leak.
const fakePassword = "p".repeat(12);
const pooler = (user) => ["postgres://", user, ":", fakePassword, "@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres"].join("");
const good = {
  projectRef: REF,
  supabaseUrl: `https://${REF}.supabase.co`,
  databaseUrl: pooler(`postgres.${REF}`),
  serviceRoleKey: "s".repeat(12),
};

test("DEPLOY-T14 the Auth URL and the database URL of the named project are accepted", () => {
  assert.deepEqual(checkProject(good), { supabaseUrl: `https://${REF}.supabase.co` });
  assert.deepEqual(checkProject({ ...good, databaseUrl: ["postgresql://postgres:", fakePassword, `@db.${REF}.supabase.co:5432/postgres`].join("") }), {
    supabaseUrl: `https://${REF}.supabase.co`,
  });
});

test("DEPLOY-T14 another project's URL is refused before any request, naming the variable only", () => {
  const other = "zzzzzzzzzzzzzzzzzzzz";
  assert.throws(() => checkProject({ ...good, supabaseUrl: `https://${other}.supabase.co` }), /SUPABASE_URL is not/);
  assert.throws(
    () => checkProject({ ...good, databaseUrl: pooler(`postgres.${other}`) }),
    (error) => error instanceof LeadError && /MIGRATE_DATABASE_URL/.test(error.message) && !error.message.includes(other)
  );
  assert.throws(() => checkProject({ ...good, serviceRoleKey: "" }), /SUPABASE_SERVICE_ROLE_KEY/);
  assert.throws(() => checkProject({ ...good, projectRef: "short" }), /project ref/);
  assert.throws(() => checkProject({ ...good, supabaseUrl: undefined }), /SUPABASE_URL/);
});

test("DEPLOY-T14 the arguments need a project ref and an email, and take the web origin to return to", () => {
  assert.deepEqual(parseArgs(["--project-ref", REF, "--email", "Lead@Example.org"]), {
    projectRef: REF,
    email: "lead@example.org",
    displayName: "Event Coordinator Lead",
    redirectTo: null,
  });
  assert.equal(parseArgs(["--project-ref", REF, "--email", "a@b.co", "--redirect-to", "https://connectsphere-staging-g9.vercel.app"]).redirectTo,
    "https://connectsphere-staging-g9.vercel.app");
  assert.throws(() => parseArgs(["--email", "lead@example.org"]), /--project-ref/);
  assert.throws(() => parseArgs(["--project-ref", REF, "--email", "not-an-email"]), /--email/);
  assert.throws(() => parseArgs(["--project-ref", REF, "--email", "a@b.co", "--role", "X"]), /unknown argument/);
  assert.throws(() => parseArgs(["--project-ref", REF, "--email", "a@b.co", "--redirect-to", "https://x.vercel.app/login"]), /--redirect-to/);
  assert.throws(() => parseArgs(["--project-ref", REF, "--email", "a@b.co", "--redirect-to", "http://x.vercel.app"]), /--redirect-to/);
});

test("DEPLOY-T14 the Lead is invited through Supabase Auth's admin invite, with no password anywhere", () => {
  const request = inviteRequest({
    supabaseUrl: `https://${REF}.supabase.co`,
    email: "lead@example.org",
    displayName: "Lead One",
    redirectTo: "https://connectsphere-staging-g9.vercel.app",
  });
  assert.equal(request.url, `https://${REF}.supabase.co/auth/v1/invite?redirect_to=${encodeURIComponent("https://connectsphere-staging-g9.vercel.app/#/set-password")}`);
  assert.deepEqual(request.body, { email: "lead@example.org", data: { display_name: "Lead One" } });
  // No password in what is sent: the link goes to the web app's Set your password screen instead.
  assert.ok(!/password/i.test(JSON.stringify(request.body)));
  assert.equal(inviteRequest({ supabaseUrl: `https://${REF}.supabase.co`, email: "a@b.co", displayName: "A", redirectTo: null }).url,
    `https://${REF}.supabase.co/auth/v1/invite`);
});
