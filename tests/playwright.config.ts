import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";
import { FAKE_AUTH_FLAG, FAKE_AUTH_FLAG_VALUE, assertTestHarnessOnly } from "./e2e/support/fake-supabase-auth.js";
import { ANON_KEY, AUTH_URL, HOST, PORTS, WEB_URL } from "./e2e/support/stack.js";

/**
 * EN-14: the browser tests, run against an ephemeral stack (documentation/evidence/EN-14).
 *
 * Playwright starts every process itself: the fake Supabase Auth server, the Cerbos policy decision
 * point on policies/ (EN-07, the same binary `npm run dev` starts), planning-core, the
 * notification and registration services, and the web app built and served by `vite preview`.
 * They all point at DATABASE_URL, which must be a throwaway Postgres on this machine (in CI, the
 * job's own service container, built by `npm run migrate:all`). The config refuses anything
 * else, so these tests can never run against the team's shared Supabase database.
 *
 * Kafka is switched off on purpose (KAFKA_BROKERS is blanked): the services start without it,
 * planning-core's messages wait in its outboxes, and nothing reaches the team's hosted cluster.
 */
const DATABASE_URL = process.env.DATABASE_URL ?? "";
assertTestHarnessOnly({ ...process.env, [FAKE_AUTH_FLAG]: FAKE_AUTH_FLAG_VALUE, DATABASE_URL });

const isCI = Boolean(process.env.CI);
const host = HOST;
const ports = PORTS;
const authUrl = AUTH_URL;
const webUrl = WEB_URL;
const anonKey = ANON_KEY;
/** A second copy of the stack (E2E_PORT_OFFSET) keeps its own logs, results and web build. */
const suffix = process.env.E2E_PORT_OFFSET ? `-${process.env.E2E_PORT_OFFSET}` : "";

/** Each process's output goes to tests/e2e-logs/<name>.log, uploaded by CI, rather than into the test report. */
const LOG_DIR = fileURLToPath(new URL(`./e2e-logs${suffix}/`, import.meta.url));
mkdirSync(LOG_DIR, { recursive: true });
const logTo = (name: string) => `> "${join(LOG_DIR, `${name}.log`)}" 2>&1`;

/** What every process gets. Blank KAFKA_* means "not configured", even if the shell has them. */
const stackEnv: Record<string, string> = {
  DATABASE_URL,
  SUPABASE_URL: authUrl,
  SUPABASE_ANON_KEY: anonKey,
  SUPABASE_JWKS_URL: `${authUrl}/auth/v1/.well-known/jwks.json`,
  SUPABASE_SERVICE_ROLE_KEY: "",
  PLANNING_CORE_PORT: String(ports.planningCore),
  NOTIFICATION_PORT: String(ports.notification),
  REGISTRATION_PORT: String(ports.registration),
  PLANNING_CORE_URL: `http://${host}:${ports.planningCore}`,
  CERBOS_URL: `http://${host}:${ports.pdp}`,
  KAFKA_BROKERS: "",
  KAFKA_SASL_USERNAME: "",
  KAFKA_SASL_PASSWORD: "",
  LOG_LEVEL: "warn",
};

/** Its own folder, so the bundle always carries this stack's auth URL. */
const webBuild = `dist/e2e-${ports.web}`;

const service = (name: string, workspace: string, port: number) => ({
  name,
  command: `npx tsx src/index.ts ${logTo(name)}`,
  cwd: `../${workspace}`,
  url: `http://${host}:${port}/readyz`,
  env: stackEnv,
  // Never reuse a process that is already listening: it could be a teammate's `npm run dev`
  // pointed at the shared database.
  reuseExistingServer: false,
  timeout: 120_000,
});

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  outputDir: `./test-results${suffix}`,
  snapshotPathTemplate: "{testDir}/__screenshots__/{testFilePath}/{arg}-{projectName}{ext}",
  fullyParallel: false,
  // One worker: the journeys share the seeded accounts and planning-core's per-address rate
  // limits, so running them one at a time keeps every run the same.
  workers: 1,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
    toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: "disabled", caret: "hide" },
  },
  reporter: isCI
    ? [["list"], ["github"], ["html", { outputFolder: "playwright-report", open: "never" }], ["json", { outputFile: "test-results/results.json" }]]
    : [["list"], ["html", { outputFolder: `playwright-report${suffix}`, open: "never" }]],
  use: {
    baseURL: webUrl,
    timezoneId: "Asia/Singapore",
    locale: "en-SG",
    trace: "retain-on-failure",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop-1280", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
    {
      name: "tablet-768",
      grep: /@visual/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 768, height: 1024 } },
    },
    {
      name: "mobile-360",
      grep: /@visual/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 360, height: 740 }, isMobile: false },
    },
  ],
  webServer: [
    {
      name: "fake-auth",
      command: `npx tsx e2e/support/start-fake-auth.ts ${logTo("fake-auth")}`,
      cwd: ".",
      url: `${authUrl}/auth/v1/health`,
      env: {
        ...stackEnv,
        [FAKE_AUTH_FLAG]: FAKE_AUTH_FLAG_VALUE,
        E2E_AUTH_PORT: String(ports.auth),
        E2E_WEB_ORIGIN: webUrl,
      },
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      // EN-07: planning-core fails closed without it, so it starts before the services need it.
      name: "pdp",
      command: `npx tsx backend/scripts/cerbos.ts server --config=backend/cerbos/config.yaml --set=server.httpListenAddr=${host}:${ports.pdp} --set=server.grpcListenAddr=${host}:${ports.pdp + 1} ${logTo("pdp")}`,
      cwd: "..",
      url: `http://${host}:${ports.pdp}/_cerbos/health`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    service("planning-core", "backend/services/planning-core", ports.planningCore),
    service("notification", "backend/services/notification", ports.notification),
    service("registration", "backend/services/registration", ports.registration),
    {
      name: "web",
      // Built here, so the bundle always points at the fake auth server above.
      command: `npm run build -w @connectsphere/web -- --outDir ${webBuild} && npm run preview -w @connectsphere/web -- --config ../tests/e2e/support/vite-preview.config.ts --outDir ${webBuild} --host ${host} --port ${ports.web} --strictPort ${logTo("web")}`,
      cwd: "..",
      url: webUrl,
      env: stackEnv,
      reuseExistingServer: false,
      timeout: 240_000,
    },
  ],
});
