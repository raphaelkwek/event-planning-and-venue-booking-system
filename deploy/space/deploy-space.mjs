#!/usr/bin/env node
// ADR-0016 amendment: deploy one environment to a free Hugging Face Docker Space and its web app to
// Vercel, from a laptop.
//
//   npm run deploy:space -- --env staging
//   npm run deploy:space -- --env production      # only after staging is up; the script checks
//
// It reads the values from C:\Users\Joash Lau\connectsphere-secrets\ (shared.env, <env>.env; outside
// the repository, never committed) or CONNECTSPHERE_SECRETS_DIR, and never prints one: every line
// it or a tool it runs prints is masked. In order, it:
//   1. finds the HF account and works out the Space's public host;
//   2. builds and deploys the SPA to the environment's Vercel project (created if missing), with
//      VITE_API_BASE_URL set to the Space, and reads the project's production origin;
//   3. creates the Space if missing (Docker SDK, public), sets its secrets and its CORS origin;
//   4. pushes the Space repository (the Dockerfile and the source it builds);
//   5. waits for the Space to run, then smoke-tests the API and the web app.
//
//   node deploy/space/deploy-space.mjs --context-only <dir>   # just write the Space repository (CI)
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

export const ENVIRONMENTS = ["staging", "production"];
export const DEFAULT_SECRETS_DIR = "C:\\Users\\Joash Lau\\connectsphere-secrets";
export const SHARED_KEYS = ["HF_TOKEN", "VERCEL_TOKEN"];
export const ENV_KEYS = ["DB_PASSWORD", "DATABASE_URL", "MIGRATE_DATABASE_URL", "SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"];
const PASSWORD_PLACEHOLDER = "[YOUR-PASSWORD]";
const VERCEL_CLI = "vercel@65.10.0";
const HF = "https://huggingface.co";

/** The files the Space builds from: what the Dockerfile copies, nothing else. */
export const CONTEXT_PATHS = ["package.json", "package-lock.json", "frontend/package.json", "backend", "policies", "deploy/space", "deploy/cerbos/config.yaml"];

export class DeployError extends Error {}

/** KEY=value lines; `#` starts a comment line; surrounding quotes are dropped. Values are never logged. */
export function parseEnvFile(text) {
  const values = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const at = line.indexOf("=");
    if (at <= 0) throw new DeployError("a line in the secrets file is not KEY=value");
    const key = line.slice(0, at).trim();
    let value = line.slice(at + 1).trim();
    if (value.length >= 2 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

/** Throws naming every key that is missing, blank or still a placeholder. */
export function requireKeys(values, keys, file) {
  const blank = keys.filter((key) => !values[key] || values[key].startsWith("replace-with"));
  if (blank.length > 0) throw new DeployError(`${file} has no value for ${blank.join(", ")}`);
  return values;
}

/** Supabase shows the URIs with [YOUR-PASSWORD]; the password goes in URL-encoded. */
export function withPassword(uri, password, key) {
  if (!uri.includes(PASSWORD_PLACEHOLDER)) {
    if (/^postgres(ql)?:\/\/[^:/@]+:[^@]+@/.test(uri)) return uri;
    throw new DeployError(`${key} has neither ${PASSWORD_PLACEHOLDER} nor a password in it`);
  }
  return uri.replaceAll(PASSWORD_PLACEHOLDER, encodeURIComponent(password));
}

/** The secrets of one environment, ready for the Space. */
export function loadEnvironment(dir, environment, read = (path) => readFileSync(path, "utf8"), sharedKeys = SHARED_KEYS) {
  if (!ENVIRONMENTS.includes(environment)) throw new DeployError("--env must be staging or production");
  const read1 = (name) => {
    const path = join(dir, name);
    let text;
    try {
      text = read(path);
    } catch {
      throw new DeployError(`cannot read ${path}`);
    }
    return parseEnvFile(text);
  };
  const shared = requireKeys(read1("shared.env"), sharedKeys, "shared.env");
  const env = requireKeys(read1(`${environment}.env`), ENV_KEYS, `${environment}.env`);
  const supabaseUrl = env.SUPABASE_URL.replace(/\/+$/, "");
  if (!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(supabaseUrl)) throw new DeployError(`${environment}.env: SUPABASE_URL is not https://<ref>.supabase.co`);
  return {
    hfToken: shared.HF_TOKEN,
    vercelToken: shared.VERCEL_TOKEN,
    space: {
      DATABASE_URL: withPassword(env.DATABASE_URL, env.DB_PASSWORD, "DATABASE_URL"),
      MIGRATE_DATABASE_URL: withPassword(env.MIGRATE_DATABASE_URL, env.DB_PASSWORD, "MIGRATE_DATABASE_URL"),
      SUPABASE_URL: supabaseUrl,
      SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
    },
    supabaseAccessToken: shared.SUPABASE_ACCESS_TOKEN,
    secrets: [shared.HF_TOKEN, shared.VERCEL_TOKEN, shared.SUPABASE_ACCESS_TOKEN, env.DB_PASSWORD, encodeURIComponent(env.DB_PASSWORD), env.SUPABASE_SERVICE_ROLE_KEY, env.SUPABASE_ANON_KEY],
  };
}

/** The Space's repository name and its public host (owner-name.hf.space, as Hugging Face forms it). */
export function spaceFor(owner, environment) {
  const name = `connectsphere-${environment}`;
  const host = `${owner}-${name}`.toLowerCase().replace(/[^a-z0-9-]/g, "-") + ".hf.space";
  return { repo: `${owner}/${name}`, name, host, origin: `https://${host}` };
}

/** Replaces every secret (and its base64 and URL-encoded forms) in text with ***. */
export function masker(secrets) {
  const forms = new Set();
  for (const secret of secrets.filter((s) => s && s.length >= 4)) {
    forms.add(secret);
    forms.add(encodeURIComponent(secret));
    forms.add(Buffer.from(secret).toString("base64"));
  }
  const ordered = [...forms].sort((a, b) => b.length - a.length);
  return (text) => ordered.reduce((out, form) => out.split(form).join("***"), String(text));
}

/** The Space's README: Hugging Face reads the SDK and the port from its front matter. */
export function spaceReadme(environment) {
  return [
    "---",
    `title: ConnectSphere ${environment}`,
    "sdk: docker",
    "app_port: 7860",
    "pinned: false",
    "startup_duration_timeout: 30m",
    "---",
    "",
    `The ConnectSphere ${environment} backend (ADR-0016). Built from the Dockerfile here, which`,
    "deploy/space/deploy-space.mjs writes from the GitHub repository; do not edit this Space by hand.",
    "",
  ].join("\n");
}

/**
 * Writes the Space repository: the files the Dockerfile needs, the Dockerfile at the root and the
 * README. They come from the commit (git archive), not the working tree, so what deploys is what is
 * committed, with LF line endings even on a Windows checkout (start.sh must run in the container).
 */
export function writeContext(dir, environment, repoRoot = process.cwd(), ref = "HEAD") {
  // core.autocrlf would convert to CRLF on a Windows checkout; the blobs are stored with LF.
  const archive = spawnSync("git", ["-c", "core.autocrlf=false", "-c", "core.eol=lf", "archive", "--format=tar", ref, "--", ...CONTEXT_PATHS], {
    cwd: repoRoot,
    maxBuffer: 512 * 1024 * 1024,
  });
  if (archive.status !== 0) throw new DeployError("git archive failed; run from the repository");
  mkdirSync(dir, { recursive: true });
  const tarFile = join(dir, ".context.tar");
  writeFileSync(tarFile, archive.stdout);
  const extracted = spawnSync("tar", ["-xf", ".context.tar"], { cwd: dir });
  rmSync(tarFile, { force: true });
  if (extracted.status !== 0) throw new DeployError("tar could not unpack the Space repository");
  const listed = spawnSync("git", ["ls-tree", "-r", "--name-only", ref, "--", ...CONTEXT_PATHS], { cwd: repoRoot, encoding: "utf8" });
  cpSync(join(dir, "deploy/space/Dockerfile"), join(dir, "Dockerfile"));
  writeFileSync(join(dir, "README.md"), spaceReadme(environment));
  return listed.stdout.split(/\r?\n/).filter(Boolean).length;
}

function parseArgs(argv) {
  const args = {};
  if (argv[0] === "--probe") return { probe: true };
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i];
    if (!["--env", "--context-only", "--web-origin"].includes(flag)) throw new DeployError(`unknown argument ${flag}`);
    if (argv[i + 1] === undefined) throw new DeployError(`${flag} needs a value`);
    args[flag.slice(2)] = argv[i + 1];
  }
  return args;
}

// ---- the deployment (needs the network, the HF token and the Vercel token) -------------------

export function makeLog(mask) {
  return (...parts) => console.log(mask(parts.join(" ")));
}

async function hf(token, path, init = {}) {
  const response = await fetch(`${HF}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init.headers },
  });
  const text = await response.text();
  let body = {};
  try {
    body = JSON.parse(text);
  } catch {
    body = { error: text.slice(0, 200) };
  }
  return { status: response.status, body };
}

/** Runs a tool with its output masked; throws with the masked tail when it fails. */
export function run(command, args, { cwd, env, mask, log, allowFailure = false, shell = false }) {
  const result = spawnSync(command, args, { cwd, env: { ...process.env, ...env }, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, shell });
  const output = mask(`${result.stdout ?? ""}${result.stderr ?? ""}`).trim();
  if (result.status !== 0 && !allowFailure) {
    throw new DeployError(`${command} ${mask(args.filter((a) => !a.startsWith("--token")).slice(0, 3).join(" "))} failed:\n${output.split("\n").slice(-15).join("\n")}`);
  }
  if (log && output) log(output.split("\n").slice(-5).join("\n"));
  return { status: result.status, stdout: mask(result.stdout ?? "").trim(), output };
}

function vercelCli(log, mask) {
  const tools = join(process.cwd(), "node_modules", ".cache", "connectsphere-vercel");
  const pkg = join(tools, "node_modules", "vercel", "package.json");
  if (!existsSync(pkg)) {
    log(`installing ${VERCEL_CLI} into node_modules/.cache (once)`);
    // No secret in these arguments; Windows needs a shell to run npm.cmd.
    run("npm", ["install", "--prefix", `"${tools}"`, VERCEL_CLI, "--no-audit", "--no-fund", "--loglevel=error"], { mask, env: {}, shell: true });
  }
  const bin = JSON.parse(readFileSync(pkg, "utf8")).bin;
  return join(tools, "node_modules", "vercel", typeof bin === "string" ? bin : bin.vercel ?? bin.vc);
}

export async function deployWeb({ environment, token, apiOrigin, space, log, mask, cwd }) {
  const project = environment === "production" ? "connectsphere" : "connectsphere-staging";
  const cli = vercelCli(log, mask);
  // cwd: a clean checkout to build in; vercel build runs vercel.json's `npm ci` there.
  const vc = (args, extra = {}) => run(process.execPath, [cli, ...args, "--token", token], { mask, cwd, ...extra, env: { VERCEL_TELEMETRY_DISABLED: "1", ...extra.env } });
  const added = vc(["project", "add", project], { allowFailure: true });
  if (added.status !== 0 && !/already exists/i.test(added.output)) throw new DeployError(`Vercel would not create ${project}: ${added.output.split("\n").slice(-3).join(" ")}`);
  vc(["link", "--yes", "--project", project]);
  vc(["pull", "--yes", "--environment=production"]);
  log(`building the web app for ${environment} (VITE_API_BASE_URL=${apiOrigin})`);
  vc(["build", "--prod"], { env: { VITE_API_BASE_URL: apiOrigin, VITE_SUPABASE_URL: space.SUPABASE_URL, VITE_SUPABASE_ANON_KEY: space.SUPABASE_ANON_KEY } });
  const deployed = vc(["deploy", "--prebuilt", "--prod"]);
  const url = deployed.stdout.split(/\s+/).find((word) => /^https:\/\/\S+\.vercel\.app$/.test(word));
  if (!url) throw new DeployError("vercel deploy printed no deployment URL");
  const response = await fetch(`https://api.vercel.com/v13/deployments/${new URL(url).host}`, { headers: { Authorization: `Bearer ${token}` } });
  const body = await response.json().catch(() => ({}));
  const aliases = (body.alias ?? []).filter((alias) => alias.endsWith(".vercel.app")).sort((a, b) => a.length - b.length);
  const origin = aliases.length > 0 ? `https://${aliases[0]}` : url;
  log(`web app deployed: ${origin}`);
  return origin;
}

async function setUpSpace({ token, space, owner, environment, values, webOrigin, log }) {
  const created = await hf(token, "/api/repos/create", { method: "POST", body: JSON.stringify({ type: "space", name: space.name, sdk: "docker", private: false }) });
  if (created.status === 200) log(`created the Space ${space.repo}`);
  else if (created.status === 409) log(`the Space ${space.repo} exists`);
  else throw new DeployError(`Hugging Face would not create ${space.repo} (${created.status})`);
  for (const [key, value] of Object.entries(values)) {
    const set = await hf(token, `/api/spaces/${space.repo}/secrets`, { method: "POST", body: JSON.stringify({ key, value }) });
    if (set.status !== 200) throw new DeployError(`could not set the Space secret ${key} (${set.status})`);
  }
  log(`Space secrets set: ${Object.keys(values).join(", ")}`);
  const variable = await hf(token, `/api/spaces/${space.repo}/variables`, { method: "POST", body: JSON.stringify({ key: "CORS_ALLOWED_ORIGINS", value: webOrigin }) });
  if (variable.status !== 200) throw new DeployError(`could not set the Space variable CORS_ALLOWED_ORIGINS (${variable.status})`);
  log(`Space variable CORS_ALLOWED_ORIGINS=${webOrigin} (${environment})`);
  void owner;
}

/** Pushes a directory as the Space repository's whole main branch; the token travels in a header, never in a URL or argument. */
function pushDir({ token, owner, repo, dir, message, mask, log }) {
  const git = (args) =>
    run("git", ["-c", "user.name=ConnectSphere deploy", "-c", "user.email=deploy@connectsphere.invalid", "-c", "core.autocrlf=false", ...args], {
      cwd: dir,
      mask,
      env: {
        GIT_TERMINAL_PROMPT: "0",
        GIT_CONFIG_COUNT: "1",
        GIT_CONFIG_KEY_0: `http.${HF}/.extraheader`,
        GIT_CONFIG_VALUE_0: `Authorization: Basic ${Buffer.from(`${owner}:${token}`).toString("base64")}`,
      },
    });
  git(["init", "-q", "-b", "main"]);
  git(["add", "-A"]);
  git(["commit", "-q", "-m", message]);
  git(["push", "-q", "--force", `${HF}/spaces/${repo}`, "HEAD:main"]);
  log(`pushed to ${HF}/spaces/${repo}`);
}

function pushSpace({ token, owner, space, environment, mask, log }) {
  const dir = mkdtempSync(join(tmpdir(), "connectsphere-space-"));
  try {
    const count = writeContext(dir, environment);
    log(`Space repository: ${count} files`);
    pushDir({ token, owner, repo: space.repo, dir, message: `Deploy ConnectSphere ${environment}`, mask, log });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** The hosts and ports the probe Space tries: Supabase's poolers in Singapore, and the project's own hosts. */
export function probeTargets(supabaseUrl) {
  const targets = [];
  for (const host of ["aws-0-ap-southeast-1.pooler.supabase.com", "aws-1-ap-southeast-1.pooler.supabase.com"]) {
    targets.push([host, 5432], [host, 6543]);
  }
  const ref = /^https:\/\/([a-z0-9]+)\.supabase\.co/.exec(supabaseUrl ?? "")?.[1];
  if (ref) targets.push([`${ref}.supabase.co`, 443], [`db.${ref}.supabase.co`, 5432]);
  return targets;
}

/** A tiny Space: one port, a second process, and a TCP check of each target, reported as JSON. */
export function probeFiles(targets) {
  return {
    "README.md": ["---", "title: ConnectSphere probe", "sdk: docker", "app_port: 7860", "---", "", "A throwaway probe (deploy-space.mjs --probe).", ""].join("\n"),
    Dockerfile: ["FROM python:3.12-slim", "COPY app.py /app.py", "USER 1000", 'CMD ["python", "/app.py"]', ""].join("\n"),
    "app.py": [
      "import json, os, socket, subprocess, sys",
      "from http.server import BaseHTTPRequestHandler, HTTPServer",
      `TARGETS = json.loads(${JSON.stringify(JSON.stringify(targets))})`,
      'child = subprocess.Popen([sys.executable, "-c", "import time\\nwhile True: time.sleep(60)"])',
      "def check(host, port):",
      "    try:",
      "        with socket.create_connection((host, port), timeout=8):",
      '            return "open"',
      "    except Exception as error:",
      "        return type(error).__name__",
      "class Handler(BaseHTTPRequestHandler):",
      "    def do_GET(self):",
      '        body = json.dumps({"uid": os.getuid(), "child_alive": child.poll() is None, "tcp": {f"{h}:{p}": check(h, p) for h, p in TARGETS}}).encode()',
      "        self.send_response(200)",
      '        self.send_header("Content-Type", "application/json")',
      "        self.end_headers()",
      "        self.wfile.write(body)",
      'HTTPServer(("0.0.0.0", 7860), Handler).serve_forever()',
      "",
    ].join("\n"),
  };
}

async function probe({ dir: secretsDir }) {
  const read = (name) => {
    try {
      return parseEnvFile(readFileSync(join(secretsDir, name), "utf8"));
    } catch {
      return {};
    }
  };
  const shared = requireKeys(read("shared.env"), ["HF_TOKEN"], "shared.env");
  const staging = read("staging.env");
  const mask = masker([shared.HF_TOKEN, shared.VERCEL_TOKEN, staging.DB_PASSWORD]);
  const log = makeLog(mask);
  const who = await hf(shared.HF_TOKEN, "/api/whoami-v2");
  if (who.status !== 200 || !who.body.name) throw new DeployError(`the HF token was refused (${who.status})`);
  const space = spaceFor(who.body.name, "probe");
  const created = await hf(shared.HF_TOKEN, "/api/repos/create", { method: "POST", body: JSON.stringify({ type: "space", name: space.name, sdk: "docker", private: false }) });
  if (created.status !== 200 && created.status !== 409) throw new DeployError(`Hugging Face would not create ${space.repo} (${created.status}${created.body.error ? `: ${created.body.error}` : ""})`);
  const dir = mkdtempSync(join(tmpdir(), "connectsphere-probe-"));
  try {
    for (const [name, text] of Object.entries(probeFiles(probeTargets(staging.SUPABASE_URL)))) writeFileSync(join(dir, name), text);
    pushDir({ token: shared.HF_TOKEN, owner: who.body.name, repo: space.repo, dir, message: "Probe", mask, log });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  await waitForSpace({ token: shared.HF_TOKEN, space, log });
  let report = null;
  await retryUntil(
    async () => {
      const response = await fetch(`${space.origin}/`);
      if (response.status !== 200) return `got ${response.status}`;
      report = await response.json();
      return true;
    },
    5,
    `${space.origin} never answered`
  );
  log(`probe ${space.origin}: ${JSON.stringify(report)}`);
  const deleted = await hf(shared.HF_TOKEN, "/api/repos/delete", { method: "DELETE", body: JSON.stringify({ type: "space", name: space.name }) });
  log(deleted.status === 200 ? `deleted the probe Space ${space.repo}` : `could not delete the probe Space ${space.repo} (${deleted.status}); delete it by hand`);
}

async function waitForSpace({ token, space, log }) {
  const deadline = Date.now() + 40 * 60_000;
  let last = "";
  await new Promise((resolve) => setTimeout(resolve, 15_000));
  while (Date.now() < deadline) {
    const { body } = await hf(token, `/api/spaces/${space.repo}/runtime`);
    const stage = body.stage ?? "UNKNOWN";
    if (stage !== last) log(`Space ${space.repo}: ${stage}`);
    last = stage;
    if (stage === "RUNNING") return;
    if (["BUILD_ERROR", "RUNTIME_ERROR", "CONFIG_ERROR", "NO_APP_FILE"].includes(stage)) {
      throw new DeployError(`the Space stopped at ${stage}; see its logs at ${HF}/spaces/${space.repo}?logs=container`);
    }
    await new Promise((resolve) => setTimeout(resolve, 15_000));
  }
  throw new DeployError(`the Space did not reach RUNNING in 40 minutes (last: ${last})`);
}

async function retryUntil(check, minutes, what) {
  const deadline = Date.now() + minutes * 60_000;
  let reason = "";
  while (Date.now() < deadline) {
    try {
      const ok = await check();
      if (ok === true) return;
      reason = ok;
    } catch (error) {
      reason = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 10_000));
  }
  throw new DeployError(`${what}: ${reason}`);
}

/** The same checks as deploy/release/smoke-api.sh, plus the Space's public /healthz. */
export async function smokeApi(base, origin, log) {
  await retryUntil(async () => (await fetch(`${base}/healthz`)).status === 200 || "no 200 from /healthz", 10, `${base}/healthz`);
  await retryUntil(
    async () => {
      const response = await fetch(`${base}/identity/api/v1/users/me`);
      const body = await response.text();
      return (response.status === 401 && body.includes('"error"')) || `got ${response.status}`;
    },
    10,
    "planning-core never answered through the Space"
  );
  const failures = [];
  for (const path of ["/notification/api/v1/notifications"]) {
    const response = await fetch(`${base}${path}`);
    if (response.status !== 401) failures.push(`${path}: ${response.status}, expected 401`);
  }
  const registration = await fetch(`${base}/registration/api/v1/smoke-check-does-not-exist`);
  if ((await registration.text()) === "404 page not found") failures.push("/registration/api/v1 is not routed to registration");
  for (const path of ["/readyz", "/metrics", "/identity/healthz", "/identity/readyz", "/registration/healthz", "/notification/metrics"]) {
    const response = await fetch(`${base}${path}`);
    if (response.status !== 404 || (await response.text()) !== "404 page not found") failures.push(`${path} is reachable`);
  }
  const preflight = async (from) =>
    (await fetch(`${base}/identity/api/v1/users/me`, { method: "OPTIONS", headers: { Origin: from, "Access-Control-Request-Method": "GET", "Access-Control-Request-Headers": "authorization" } })).headers.get(
      "access-control-allow-origin"
    );
  if ((await preflight(origin)) !== origin) failures.push(`CORS does not allow ${origin}`);
  if (await preflight("https://not-connectsphere.invalid")) failures.push("CORS allows a foreign origin");
  if (failures.length > 0) throw new DeployError(`smoke test of ${base}: ${failures.join("; ")}`);
  log(`smoke test of ${base}: API routes, nothing else exposed, CORS for ${origin} only`);
}

export async function smokeWeb(origin, apiHost, log) {
  const shell = await (await fetch(`${origin}/`)).text();
  if (!shell.includes('id="root"')) throw new DeployError(`${origin}/ is not the app shell`);
  const asset = /\/assets\/[^"]*\.js/.exec(shell)?.[0];
  if (!asset || !(await (await fetch(`${origin}${asset}`)).text()).includes(apiHost)) throw new DeployError(`the web app at ${origin} does not call ${apiHost}`);
  const route = await fetch(`${origin}/set-password`);
  if (route.status !== 200) throw new DeployError(`${origin} has no SPA fallback`);
  log(`smoke test of ${origin}: the shell, built for ${apiHost}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.probe) {
    await probe({ dir: process.env.CONNECTSPHERE_SECRETS_DIR || DEFAULT_SECRETS_DIR });
    return;
  }
  if (args["context-only"]) {
    const count = writeContext(args["context-only"], args.env ?? "staging");
    console.log(`wrote the Space repository (${count} files) to ${args["context-only"]}`);
    return;
  }
  if (!args.env) throw new DeployError("--env staging or --env production is required");
  const dir = process.env.CONNECTSPHERE_SECRETS_DIR || DEFAULT_SECRETS_DIR;
  const loaded = loadEnvironment(dir, args.env);
  const mask = masker(loaded.secrets);
  const log = makeLog(mask);

  const who = await hf(loaded.hfToken, "/api/whoami-v2");
  if (who.status !== 200 || !who.body.name) throw new DeployError(`the HF token was refused (${who.status})`);
  const owner = who.body.name;
  const space = spaceFor(owner, args.env);
  log(`environment ${args.env}: Space ${space.repo}, API ${space.origin}`);

  if (args.env === "production") {
    const staging = spaceFor(owner, "staging");
    const runtime = await hf(loaded.hfToken, `/api/spaces/${staging.repo}/runtime`);
    const health = await fetch(`${staging.origin}/healthz`).catch(() => ({ status: 0 }));
    if (runtime.body.stage !== "RUNNING" || health.status !== 200) {
      throw new DeployError("staging is not up (deploy and check it first: npm run deploy:space -- --env staging)");
    }
    log("staging is up, so production may go");
  }

  const webOrigin = args["web-origin"] ?? (await deployWeb({ environment: args.env, token: loaded.vercelToken, apiOrigin: space.origin, space: loaded.space, log, mask }));
  await setUpSpace({ token: loaded.hfToken, space, owner, environment: args.env, values: loaded.space, webOrigin, log });
  pushSpace({ token: loaded.hfToken, owner, space, environment: args.env, mask, log });
  await waitForSpace({ token: loaded.hfToken, space, log });
  await smokeApi(space.origin, webOrigin, log);
  await smokeWeb(webOrigin, space.host, log);
  log(`${args.env} is live: web ${webOrigin}, API ${space.origin}`);
  log(`add ${space.origin} to deploy/space/spaces.txt so the keep-awake job pings it`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    // A DeployError's message is already masked. Anything else shows only its type and code, so
    // no value can reach the terminal through an unexpected error.
    const detail = error instanceof DeployError ? error.message : `failed with ${error?.name ?? "an error"}${error?.code ? ` (${error.code})` : ""}`;
    console.error(`deploy:space: ${detail}`);
    process.exit(1);
  });
}
