import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { AxeBuilder } from "@axe-core/playwright";
import { test as base, expect, type Page, type TestInfo } from "@playwright/test";
import { ACCOUNTS, SEED_PASSWORD, type AccountKey } from "./accounts.js";
import { tokenFor } from "./api.js";

/**
 * What every journey shares: signing in through the real sign-in screen, an accessibility check
 * of each screen it visits, and names no other run has used.
 */

/** WCAG 2.1 A and AA, the level the brief's accessibility requirement is read as. */
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const FAILING_IMPACTS = new Set(["serious", "critical"]);

export interface AxeViolationRecord {
  test: string;
  project: string;
  screen: string;
  url: string;
  id: string;
  impact: string | null;
  help: string;
  helpUrl: string;
  targets: string[];
  detail: string;
}

const findingsDir = fileURLToPath(new URL("../../test-results/axe-findings/", import.meta.url));

function recordFindings(testInfo: TestInfo, records: AxeViolationRecord[]) {
  if (records.length === 0) return;
  mkdirSync(findingsDir, { recursive: true });
  const file = `${testInfo.testId}-${testInfo.project.name}-${testInfo.retry}-${Date.now()}.json`;
  writeFileSync(join(findingsDir, file), JSON.stringify(records, null, 2));
}

/**
 * Runs axe on the screen as it is now. Serious and critical violations fail the test; every
 * violation, whatever its impact, is attached to the report and written to
 * test-results/axe-findings for documentation/evidence/EN-14/axe-findings.md.
 */
export async function checkAccessibility(page: Page, testInfo: TestInfo, screen: string) {
  const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  const records: AxeViolationRecord[] = results.violations.map((violation) => ({
    test: testInfo.titlePath.slice(1).join(" › "),
    project: testInfo.project.name,
    screen,
    url: page.url().replace(/^https?:\/\/[^/]+/, ""),
    id: violation.id,
    impact: violation.impact ?? null,
    help: violation.help,
    helpUrl: violation.helpUrl,
    targets: violation.nodes.map((node) => node.target.join(" ")),
    detail: violation.nodes[0]?.failureSummary ?? "",
  }));
  recordFindings(testInfo, records);
  if (records.length > 0) {
    await testInfo.attach(`axe ${screen}`, { body: JSON.stringify(records, null, 2), contentType: "application/json" });
  }
  const failing = records.filter((record) => record.impact && FAILING_IMPACTS.has(record.impact));
  expect(
    failing.map((record) => `${record.impact} ${record.id} (${record.help}) at ${record.targets.join(", ")}`),
    `serious or critical accessibility violations on ${screen}`,
  ).toEqual([]);
}

/**
 * Signs in through the sign-in screen, as a person would, and waits for the signed-in header.
 * Only A1's journeys use it: identity limits sign-ins to 30 a minute per address, and every
 * browser sign-in reaches planning-core from the same address through the web app's proxy.
 */
export async function signInWithForm(page: Page, key: AccountKey) {
  const account = ACCOUNTS[key];
  await page.goto("/");
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(SEED_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("banner")).toContainText(account.email);
}

/**
 * Starts a journey signed in, without spending identity's sign-in budget: the token comes from
 * the fake Supabase Auth server, and the session is stored exactly as the web app stores it
 * after a sign-in (frontend/src/api/session.ts, sessionStorage "connectsphere.session"), then the
 * app is reloaded so SessionProvider reads it. The session is written once, not by an init
 * script, so signing out still ends it. A1's journeys sign in through the form instead.
 */
export async function signIn(page: Page, key: AccountKey) {
  const account = ACCOUNTS[key];
  const token = await tokenFor(key);
  const session = { userId: account.id, email: account.email, role: account.role, token, lastLoginAt: new Date().toISOString() };
  await page.goto("/");
  await page.evaluate((value) => sessionStorage.setItem("connectsphere.session", value), JSON.stringify(session));
  await page.goto("/");
  await expect(page.getByRole("banner")).toContainText(account.email);
}

export async function signOut(page: Page) {
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
}

interface Fixtures {
  a11y: (screen: string) => Promise<void>;
}

export const test = base.extend<Fixtures>({
  a11y: async ({ page }, use, testInfo) => {
    await use((screen) => checkAccessibility(page, testInfo, screen));
  },
});

export { expect };
export { uniqueName } from "./names.js";
