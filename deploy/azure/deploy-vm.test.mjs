// ADR-0016 amendment (Azure): the parts of `npm run deploy:vm` that need no VM. Run by
// `npm run test:scripts`. Fake values are built at run time.
import { test } from "node:test";
import assert from "node:assert/strict";
import { apiHost, containerEnv, hostCaddyfile, PORTS } from "./deploy-vm.mjs";

const fake = (label) => `${label}-${"k".repeat(12)}`;

test("DEPLOY-T19 each environment gets its own API host on the VM's address, or under a DuckDNS name", () => {
  assert.equal(apiHost("staging", { host: "20.1.2.3" }), "api.staging.20.1.2.3.sslip.io");
  assert.equal(apiHost("production", { host: "20.1.2.3" }), "api.20.1.2.3.sslip.io");
  assert.equal(apiHost("staging", { host: "20.1.2.3", domain: "connectsphere-x.duckdns.org" }), "api.staging.connectsphere-x.duckdns.org");
  assert.notEqual(PORTS.staging, PORTS.production);
});

test("DEPLOY-T19 the host Caddy routes each host to its own environment's container only", () => {
  const caddyfile = hostCaddyfile({ host: "20.1.2.3" });
  assert.match(caddyfile, /api\.staging\.20\.1\.2\.3\.sslip\.io \{\n\treverse_proxy 127\.0\.0\.1:7861\n\}/);
  assert.match(caddyfile, /api\.20\.1\.2\.3\.sslip\.io \{\n\treverse_proxy 127\.0\.0\.1:7862\n\}/);
  assert.equal((caddyfile.match(/reverse_proxy/g) ?? []).length, 2);
});

test("DEPLOY-T19 the container's env file holds the Space values, its own web origin for CORS, and a smaller Redpanda", () => {
  const space = { DATABASE_URL: fake("db"), MIGRATE_DATABASE_URL: fake("mig"), SUPABASE_URL: "https://x.supabase.co", SUPABASE_ANON_KEY: fake("anon"), SUPABASE_SERVICE_ROLE_KEY: fake("svc") };
  const text = containerEnv(space, "https://connectsphere-staging.vercel.app");
  const keys = text.trim().split("\n").map((line) => line.split("=")[0]);
  assert.deepEqual(keys, [...Object.keys(space), "CORS_ALLOWED_ORIGINS", "REDPANDA_MEMORY"]);
  assert.ok(text.includes("CORS_ALLOWED_ORIGINS=https://connectsphere-staging.vercel.app\n"));
  assert.ok(text.includes("REDPANDA_MEMORY=512M\n"));
  assert.throws(() => containerEnv({ ...space, SUPABASE_ANON_KEY: "a\nb" }, "https://x.vercel.app"), /SUPABASE_ANON_KEY contains a line break/);
});
