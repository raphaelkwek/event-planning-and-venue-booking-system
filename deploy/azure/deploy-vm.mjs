#!/usr/bin/env node
// ADR-0016 amendment (Azure): deploy one environment to the Azure VM (deploy/azure/create-vm.sh)
// and its web app to Vercel, from a laptop.
//
//   npm run deploy:vm -- --env staging
//   npm run deploy:vm -- --env production      # only while staging answers; the script checks
//   npm run deploy:vm -- --env staging && npm run deploy:vm -- --env production    # redeploy both
//
// Options: --host <VM address> (default: the static IP connectsphere-ip in connectsphere-rg, read
// with az), --user [azureuser], --key [~/.ssh/connectsphere-azure], --domain <base> (DuckDNS
// instead of sslip.io: api.staging.<base> and api.<base>), --seed (staging only: the demo users),
// --lead <email> (invite the first Event Coordinator Lead).
//
// The VM runs one container per environment, the single-container image of deploy/space (the
// services, the worker, Redpanda, Temporal, Cerbos and Caddy on 7860), staging on 127.0.0.1:7861
// and production on 127.0.0.1:7862, and a host Caddy on 80 and 443 that takes the certificates and
// routes by host. Values come from C:\Users\Joash Lau\connectsphere-secrets\ (shared.env, <env>.env),
// go to the VM over SSH into /etc/connectsphere/<env>.env (mode 600), and are never printed.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  DEFAULT_SECRETS_DIR,
  DeployError,
  deployWeb,
  loadEnvironment,
  makeLog,
  masker,
  run,
  smokeApi,
  smokeWeb,
  writeContext,
} from "../space/deploy-space.mjs";

export const PORTS = { staging: 7861, production: 7862 };
const CADDY_IMAGE = "docker.io/library/caddy:2.10.2@sha256:c3d7ee5d2b11f9dc54f947f68a734c84e9c9666c92c88a7f30b9cba5da182adb";
// Two environments share 4 GB: Redpanda reserves less than on a Space.
const REDPANDA_MEMORY = "512M";

/** The environment's public API host. sslip.io resolves a name with the IP in it to that IP. */
export function apiHost(environment, { host, domain }) {
  const base = domain ?? `${host}.sslip.io`;
  return environment === "production" ? `api.${base}` : `api.staging.${base}`;
}

/** The host Caddy's configuration: one site per environment, each to its own container. */
export function hostCaddyfile(options) {
  return ["staging", "production"]
    .map((environment) => `${apiHost(environment, options)} {\n\treverse_proxy 127.0.0.1:${PORTS[environment]}\n}\n`)
    .join("\n");
}

/** The container's env file. Values are written as they are: docker's --env-file takes no quoting. */
export function containerEnv(space, webOrigin, alsoOrigins = []) {
  // TRUST_PROXY_HOPS: the host Caddy and the container's Caddy stand in front, so registration's per-address limits read the client.
  const values = { ...space, CORS_ALLOWED_ORIGINS: [webOrigin, ...alsoOrigins].join(","), REDPANDA_MEMORY, TRUST_PROXY_HOPS: "2" };
  for (const [key, value] of Object.entries(values)) {
    if (/[\r\n]/.test(value)) throw new DeployError(`${key} contains a line break`);
  }
  return Object.entries(values).map(([key, value]) => `${key}=${value}`).join("\n") + "\n";
}

function parseArgs(argv) {
  const args = { seed: false };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === "--seed") args.seed = true;
    else if (["--env", "--host", "--user", "--key", "--domain", "--lead", "--web-origin", "--also-origin"].includes(flag)) {
      if (argv[i + 1] === undefined) throw new DeployError(`${flag} needs a value`);
      args[flag.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = argv[i + 1];
      i += 1;
    } else throw new DeployError(`unknown argument ${flag}`);
  }
  if (!["staging", "production"].includes(args.env)) throw new DeployError("--env staging or --env production is required");
  if (args.seed && args.env !== "staging") throw new DeployError("--seed applies the demo users, which only staging gets");
  // --also-origin: more web origins the API accepts (an older Vercel alias), comma-separated.
  args.alsoOrigins = (args.alsoOrigin ?? "").split(",").map((o) => o.trim()).filter(Boolean);
  for (const origin of args.alsoOrigins) {
    if (!/^https:\/\/[a-z0-9.-]+$/.test(origin)) throw new DeployError(`--also-origin ${origin} is not an https origin`);
  }
  return args;
}

function vmAddress(log) {
  const result = spawnSync("az", ["network", "public-ip", "show", "-g", "connectsphere-rg", "-n", "connectsphere-ip", "--query", "ipAddress", "-o", "tsv"], {
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  const address = result.stdout?.trim();
  if (result.status !== 0 || !/^\d+\.\d+\.\d+\.\d+$/.test(address ?? "")) throw new DeployError("give --host: az could not read the static IP connectsphere-ip in connectsphere-rg");
  log(`VM address from az: ${address}`);
  return address;
}

async function configureAuthUrls({ token, supabaseUrl, webOrigin, alsoOrigins = [], log }) {
  if (!token) {
    log("no SUPABASE_ACCESS_TOKEN in shared.env: set Authentication, URL Configuration by hand (runbook)");
    return;
  }
  const ref = new URL(supabaseUrl).hostname.split(".")[0];
  const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ site_url: webOrigin, uri_allow_list: [webOrigin, ...alsoOrigins].map((o) => `${o}/**`).join(",") }),
  });
  if (!response.ok) throw new DeployError(`Supabase would not set the Auth URLs of ${ref} (${response.status})`);
  log(`Supabase Auth of ${ref}: Site URL ${webOrigin}, redirect ${[webOrigin, ...alsoOrigins].map((o) => `${o}/**`).join(", ")}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const loaded = loadEnvironment(process.env.CONNECTSPHERE_SECRETS_DIR || DEFAULT_SECRETS_DIR, args.env, undefined, ["VERCEL_TOKEN"]);
  const mask = masker(loaded.secrets);
  const log = makeLog(mask);
  const host = args.host ?? vmAddress(log);
  const user = args.user ?? "azureuser";
  const key = args.key ?? join(homedir(), ".ssh", "connectsphere-azure");
  const api = apiHost(args.env, { host, domain: args.domain });
  const container = `connectsphere-${args.env}`;
  const ssh = (command, options = {}) =>
    run("ssh", ["-i", key, "-o", "StrictHostKeyChecking=accept-new", "-o", "BatchMode=yes", "-o", "ServerAliveInterval=30", `${user}@${host}`, command], { mask, ...options });
  log(`environment ${args.env}: API https://${api}, container ${container} on 127.0.0.1:${PORTS[args.env]}`);

  if (args.env === "production") {
    const staging = await fetch(`https://${apiHost("staging", { host, domain: args.domain })}/healthz`).catch(() => ({ status: 0 }));
    if (staging.status !== 200) throw new DeployError("staging is not up (deploy and check it first: npm run deploy:vm -- --env staging)");
    log("staging is up, so production may go");
  }

  const docker = ssh("docker version --format '{{.Server.Version}}'", { allowFailure: true });
  if (docker.status !== 0) throw new DeployError("Docker is not ready on the VM yet (cloud-init installs it in the first minutes after create-vm.sh)");
  log(`VM ${host}: Docker ${docker.stdout}`);

  // The image of this commit, built on the VM (it is arm64) from the same Space repository CI builds.
  const commit = spawnSync("git", ["rev-parse", "--short=12", "HEAD"], { encoding: "utf8" }).stdout.trim();
  const image = `connectsphere-space:${commit}`;
  if (ssh(`docker image inspect ${image} > /dev/null 2>&1`, { allowFailure: true }).status === 0) {
    log(`image ${image} is already on the VM`);
  } else {
    const dir = mkdtempSync(join(tmpdir(), "connectsphere-vm-"));
    try {
      const count = writeContext(join(dir, "context"), args.env);
      // Relative paths only: Git Bash's tar reads "C:\..." as a remote host.
      const tarFile = join(dir, "context.tar");
      const tar = spawnSync("tar", ["-cf", "context.tar", "-C", "context", "."], { cwd: dir, encoding: "utf8" });
      if (tar.status !== 0) throw new DeployError(`tar could not pack the build context: ${(tar.stderr ?? "").trim().slice(0, 200)}`);
      log(`building ${image} on the VM from ${count} files (several minutes)`);
      const built = spawnSync("ssh", ["-i", key, "-o", "BatchMode=yes", "-o", "ServerAliveInterval=30", `${user}@${host}`, `docker build -q -t ${image} -`], {
        input: readFileSync(tarFile),
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
      });
      rmSync(tarFile, { force: true });
      if (built.status !== 0) throw new DeployError(`the image did not build:\n${mask(`${built.stdout}${built.stderr}`).split("\n").slice(-25).join("\n")}`);
      log(`built ${image}`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  // The web app is built in a throwaway worktree of this commit, so vercel build's `npm ci` leaves
  // this checkout's node_modules alone.
  let webOrigin = args.webOrigin;
  if (!webOrigin) {
    // The long form of the temp path: Vite's bundler rejects Windows 8.3 short names (JOASHL~1).
    const tree = mkdtempSync(join(realpathSync.native(tmpdir()), "connectsphere-web-"));
    rmSync(tree, { recursive: true, force: true });
    run("git", ["worktree", "add", "--detach", tree, "HEAD"], { mask });
    try {
      webOrigin = await deployWeb({ environment: args.env, token: loaded.vercelToken, apiOrigin: `https://${api}`, space: loaded.space, log, mask, cwd: tree });
    } finally {
      run("git", ["worktree", "remove", "--force", tree], { mask, allowFailure: true });
    }
  }
  await configureAuthUrls({ token: loaded.supabaseAccessToken, supabaseUrl: loaded.space.SUPABASE_URL, webOrigin, alsoOrigins: args.alsoOrigins, log });

  // The env file goes over stdin, never as an argument. Once setup-deploy-user.sh has run, the
  // connectsphere group (the admin user and the deploy gate) shares it; before that, the admin user only.
  const envPath = `/etc/connectsphere/${args.env}.env`;
  const upload = spawnSync(
    "ssh",
    ["-i", key, "-o", "BatchMode=yes", `${user}@${host}`, `if getent group connectsphere > /dev/null; then sudo install -d -m 2770 -o root -g connectsphere /etc/connectsphere; else sudo install -d -m 0700 -o "$(id -u)" -g "$(id -g)" /etc/connectsphere; fi && umask 007 && cat > ${envPath} && chmod 660 ${envPath}`],
    { input: containerEnv(loaded.space, webOrigin, args.alsoOrigins), encoding: "utf8" }
  );
  if (upload.status !== 0) throw new DeployError(`could not write ${envPath}: ${mask(upload.stderr ?? "").trim()}`);
  log(`wrote ${envPath} (mode 660, the admin user and the deploy gate only): ${Object.keys(loaded.space).join(", ")}, CORS_ALLOWED_ORIGINS, REDPANDA_MEMORY`);

  ssh(`docker rm -f ${container} > /dev/null 2>&1; docker run -d --name ${container} --restart unless-stopped --env-file ${envPath} -p 127.0.0.1:${PORTS[args.env]}:7860 ${image} > /dev/null`);
  log(`started ${container} from ${image}`);

  // The host Caddy: both environments' hosts, certificates from Let's Encrypt (ZeroSSL as Caddy's fallback).
  const caddyfile = spawnSync("ssh", ["-i", key, "-o", "BatchMode=yes", `${user}@${host}`, "cat > /etc/connectsphere/Caddyfile"], { input: hostCaddyfile({ host, domain: args.domain }), encoding: "utf8" });
  if (caddyfile.status !== 0) throw new DeployError("could not write the host Caddyfile");
  const reload = ssh("docker exec caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile", { allowFailure: true });
  if (reload.status !== 0) {
    ssh(
      `docker rm -f caddy > /dev/null 2>&1; docker run -d --name caddy --restart unless-stopped --network host -v /etc/connectsphere/Caddyfile:/etc/caddy/Caddyfile:ro -v caddy_data:/data -v caddy_config:/config ${CADDY_IMAGE} > /dev/null`
    );
    log("started the host Caddy on 80 and 443");
  } else {
    log("reloaded the host Caddy");
  }

  await smokeApi(`https://${api}`, webOrigin, log);
  for (const port of [8090, 8091, 8092]) {
    const ready = ssh(`docker exec ${container} curl -fsS http://127.0.0.1:${port}/readyz`, { allowFailure: true });
    if (!/"database":"ok"/.test(ready.stdout) || !/"kafka":"reachable"/.test(ready.stdout)) throw new DeployError(`the service on ${port} is not ready: ${ready.stdout}`);
    log(`:${port}/readyz ${ready.stdout}`);
  }
  const cerbos = ssh(`docker exec ${container} curl -fsS http://127.0.0.1:3592/_cerbos/health`, { allowFailure: true });
  if (!cerbos.stdout.includes("SERVING")) throw new DeployError("Cerbos is not serving");
  log(`cerbos ${cerbos.stdout}`);
  await smokeWeb(webOrigin, api, log);

  if (args.seed) {
    ssh(`docker exec ${container} sh -c 'cd /app && DATABASE_URL="$MIGRATE_DATABASE_URL" node migrate.mjs all --seed > /dev/null'`);
    ssh(`docker exec ${container} sh -c 'cd /app && npx --no-install tsx backend/services/planning-core/migrations/identity/seed/seed-auth-users.ts'`, { log });
    log("staging: the demo users (identity seeds and their Supabase Auth users) are in place");
  }
  if (args.lead) {
    run(process.execPath, ["deploy/scripts/create-lead.mjs", "--project-ref", new URL(loaded.space.SUPABASE_URL).hostname.split(".")[0], "--email", args.lead, "--display-name", "Event Coordinator Lead", "--redirect-to", webOrigin], {
      mask,
      log,
      env: { SUPABASE_URL: loaded.space.SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: loaded.space.SUPABASE_SERVICE_ROLE_KEY, MIGRATE_DATABASE_URL: loaded.space.MIGRATE_DATABASE_URL },
    });
  }
  log(`${args.env} is live: web ${webOrigin}, API https://${api}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    const detail = error instanceof DeployError ? error.message : `failed with ${error?.name ?? "an error"}${error?.code ? ` (${error.code})` : ""}`;
    console.error(`deploy:vm: ${detail}`);
    process.exit(1);
  });
}
