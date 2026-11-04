// ADR-0016 amendment (Azure): the parts of `npm run deploy:vm` that need no VM. Run by
// `npm run test:scripts`. Fake values are built at run time.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { apiHost, containerEnv, hostCaddyfile, PORTS, replaceContainerCommand, TEMPORAL_STATE_DIR, temporalVolume } from "./deploy-vm.mjs";

/** A file of the repository, with LF line endings even on a Windows checkout. */
const repoFile = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8").replace(/
/g, "
");

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
  assert.deepEqual(keys, [...Object.keys(space), "CORS_ALLOWED_ORIGINS", "REDPANDA_MEMORY", "TRUST_PROXY_HOPS"]);
  assert.ok(text.includes("CORS_ALLOWED_ORIGINS=https://connectsphere-staging.vercel.app\n"));
  assert.ok(text.includes("REDPANDA_MEMORY=512M\n"));
  assert.throws(() => containerEnv({ ...space, SUPABASE_ANON_KEY: "a\nb" }, "https://x.vercel.app"), /SUPABASE_ANON_KEY contains a line break/);
  // An older alias can be kept working: CORS then allows both, the canonical origin first.
  const both = containerEnv(space, "https://connectsphere-is212.vercel.app", ["https://connectsphere-blush.vercel.app"]);
  assert.ok(both.includes("CORS_ALLOWED_ORIGINS=https://connectsphere-is212.vercel.app,https://connectsphere-blush.vercel.app\n"));
});

test("EN-11-T6 the deploy gate and deploy:vm mount each environment's own Temporal volume where start.sh keeps Temporal's state", () => {
  assert.equal(TEMPORAL_STATE_DIR, "/var/lib/connectsphere/temporal");
  assert.equal(temporalVolume("staging"), "connectsphere-staging-temporal");
  assert.equal(temporalVolume("production"), "connectsphere-production-temporal");

  const startSh = repoFile("deploy/space/start.sh");
  assert.match(startSh, /^TEMPORAL_STATE_DIR=\/var\/lib\/connectsphere\/temporal$/m);

  // The gate, which the Release workflow runs: the same name per environment, the same directory.
  const gate = repoFile("deploy/azure/connectsphere-vm-deploy");
  assert.match(gate, /^CONTAINER="connectsphere-\$\{ENVIRONMENT\}"$/m);
  assert.match(gate, /^TEMPORAL_STATE_DIR=\/var\/lib\/connectsphere\/temporal$/m);
  assert.match(gate, /docker run -d --name "\$CONTAINER" [^
]*-v "\$\{CONTAINER\}-temporal:\$\{TEMPORAL_STATE_DIR\}" /);

  // npm run deploy:vm, the manual path.
  for (const environment of ["staging", "production"]) {
    const command = replaceContainerCommand(environment, "connectsphere-space:abc123", `/etc/connectsphere/${environment}.env`);
    assert.ok(command.includes(`docker run -d --name connectsphere-${environment} `), command);
    assert.ok(command.includes(` -v connectsphere-${environment}-temporal:/var/lib/connectsphere/temporal `), command);
    assert.ok(command.includes(` -p 127.0.0.1:${PORTS[environment]}:7860 connectsphere-space:abc123 `), command);
  }
});

test("EN-11-T6 the image gives that directory to the user supervisord runs Temporal as, and Temporal's file is in it", () => {
  const dockerfile = repoFile("deploy/space/Dockerfile");
  const made = dockerfile.search(/install -d -o 1000 -g 1000 [^
]*\/var\/lib\/connectsphere\/temporal/);
  assert.ok(made > 0, "the Dockerfile makes /var/lib/connectsphere/temporal for uid 1000");
  assert.ok(made < dockerfile.indexOf("
USER 1000
"), "as root, before the image switches to uid 1000");
  assert.ok(repoFile("deploy/space/supervisord.conf").includes("--db-filename=%(ENV_TEMPORAL_DB_FILE)s"));
  assert.ok(repoFile("deploy/space/start.sh").includes('TEMPORAL_DB_FILE="$TEMPORAL_STATE_DIR/temporal.db"'));
});

test("EN-11-T6 both deploy paths stop the old container before removing it, so Temporal closes its file", () => {
  const gate = repoFile("deploy/azure/connectsphere-vm-deploy");
  const stop = gate.indexOf('docker stop -t 30 "$CONTAINER"');
  assert.ok(stop > 0, "the gate stops the container");
  assert.ok(stop < gate.indexOf('docker rm -f "$CONTAINER"'), "before it removes it");

  const command = replaceContainerCommand("staging", "connectsphere-space:abc123", "/etc/connectsphere/staging.env");
  assert.ok(command.startsWith("docker stop -t 30 connectsphere-staging "), command);
  assert.ok(command.indexOf("docker stop") < command.indexOf("docker rm -f connectsphere-staging"), command);
});
