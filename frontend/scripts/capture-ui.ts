/**
 * Screenshots of the main screens in both themes at 360, 768 and 1440 px, for the redesign's design
 * notes (documentation/design/ui-redesign.md), with an axe check of each one.
 *
 * It needs no backend and no account: every API call the app makes is answered here, in the
 * browser, from ui-fixtures.ts, and the session is written to sessionStorage the way the app
 * stores it after a sign-in. Nothing leaves the machine.
 *
 *   npm run build -w @connectsphere/web
 *   npx vite preview --port 4317 --strictPort        (in frontend/)
 *   npx tsx frontend/scripts/capture-ui.ts [--out <dir>] [--only <screen>]
 *
 * Writes <out>/<theme>/<screen>-<width>.png and prints every axe violation (WCAG 2.2 A and AA).
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Page, type Route } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import * as fx from "./ui-fixtures.js";

const BASE = process.env.UI_BASE_URL ?? "http://127.0.0.1:4317";
const args = process.argv.slice(2);
const option = (name: string) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const OUT = option("--out") ?? "documentation/design/ui-redesign/all";
const ONLY = option("--only");
const WIDTHS = [360, 768, 1440];
const THEMES = ["dark", "light"] as const;

type Json = unknown;

function json(route: Route, body: Json, status = 200) {
  return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

/** The app's API, answered from the fixtures. Anything not listed reads as an empty page. */
function answer(url: URL, method: string): { status: number; body: Json } {
  const path = url.pathname;
  const ok = (body: Json) => ({ status: 200, body });
  if (method !== "GET") return ok({});

  if (path === "/identity/api/v1/users") {
    const ids = (url.searchParams.get("ids") ?? "").split(",").filter(Boolean);
    return ok({ items: ids.filter((id) => fx.USERS[id]).map((id) => ({ id, ...fx.USERS[id] })) });
  }
  if (path === "/notification/api/v1/notifications") {
    return ok({ items: fx.NOTIFICATIONS, unreadCount: 2, nextCursor: null });
  }

  const event = path.match(/^\/event\/api\/v1\/(.*)$/)?.[1];
  if (event !== undefined) {
    if (event === "feature-flags") return ok({ flags: {} });
    if (event === "events") return ok({ items: [fx.DRAFT_ITEM, ...fx.LIST_ITEMS], nextCursor: null });
    if (event === "events/queue") return ok({ items: fx.EVENTS.filter((e) => ["SUBMITTED", "UNDER_REVIEW", "AWAITING_CLARIFICATION"].includes(e.status)), nextCursor: null });
    if (event === "assignments") {
      return ok({ items: fx.EVENTS.filter((e) => !["REJECTED", "CANCELLED"].includes(e.status)).map((e) => ({ id: e.id, reference: e.reference, name: e.name, status: e.status, assignedCoordinatorId: e.assignedCoordinatorId })), coordinators: fx.COORDINATORS });
    }
    if (event === "assignments/unassigned") {
      return ok({ items: [{ id: "e-9", reference: "EVT-000127", name: "Capstone Demo Day", proposedStartAt: fx.EVENTS[3].proposedStartAt, proposedEndAt: fx.EVENTS[3].proposedEndAt, expectedAttendance: 140, submittedAt: fx.EVENTS[1].submittedAt, status: "SUBMITTED" }] });
    }
    if (event === "coordinators") return ok({ items: fx.COORDINATORS });
    if (event === "safety-reviews") return ok({ events: fx.SAFETY_QUEUE });
    const detail = event.match(/^events\/([^/]+)(?:\/(.*))?$/);
    if (detail) {
      const [, id, rest] = detail;
      const record = fx.EVENTS.find((e) => e.id === id) ?? fx.EVENTS[0];
      if (!rest) return ok(record);
      if (rest === "clarifications") return ok({ items: id === "e-1" ? fx.CLARIFICATIONS : [], nextCursor: null });
      if (rest === "status-history") return ok({ ...fx.STATUS_HISTORY, eventId: record.id, status: record.status });
      if (rest === "arrangement-flags") return ok({ flags: [] });
      if (rest === "change-requests") return ok({ items: [] });
      if (rest === "assignments") return ok({ items: [{ coordinatorId: record.assignedCoordinatorId, assignedBy: "u-lead", rule: "MANUAL", assignedAt: record.submittedAt, endedAt: null }] });
    }
    return ok({ items: [], nextCursor: null });
  }

  const venue = path.match(/^\/venue\/api\/v1\/(.*)$/)?.[1];
  if (venue !== undefined) {
    if (venue === "venues") return ok({ items: fx.VENUES });
    if (venue === "booking-requests/queue") return ok({ items: fx.BOOKING_QUEUE });
    const availability = venue.match(/^venues\/[^/]+\/availability$/);
    if (availability) return ok(fx.availability(url.searchParams.get("from") ?? "2026-12-07", url.searchParams.get("to") ?? "2026-12-13"));
    if (/^venues\/[^/]+$/.test(venue) && venue !== "venues/search") return ok(fx.VENUE);
    return ok({ items: [] });
  }

  const equipment = path.match(/^\/equipment\/api\/v1\/equipment\/(.*)$/)?.[1];
  if (equipment !== undefined) {
    if (equipment === "types") return ok({ items: fx.EQUIPMENT_TYPES, nextCursor: null });
    if (equipment === "request-lines") return ok({ items: fx.REQUEST_LINES, nextCursor: null });
    return ok({ items: [] });
  }
  return { status: 404, body: { error: { code: "NOT_FOUND", message: "Not in the capture fixtures.", correlationId: null } } };
}

async function mockApi(page: Page) {
  await page.route(/\/(identity|event|venue|equipment|notification)\/api\//, (route) => {
    const request = route.request();
    const { status, body } = answer(new URL(request.url()), request.method());
    return json(route, body, status);
  });
}

interface Shot {
  name: string;
  account: fx.AccountKey | null;
  path: string;
  ready: (page: Page) => Promise<unknown>;
  after?: (page: Page) => Promise<unknown>;
  widths?: number[];
}

const heading = (name: string) => (page: Page) => page.getByRole("heading", { name, exact: true }).first().waitFor();

const SHOTS: Shot[] = [
  { name: "sign-in", account: null, path: "/", ready: (page) => page.getByRole("button", { name: "Sign in" }).waitFor() },
  { name: "review-queue", account: "coordinator", path: "/#/queue", ready: heading("Review queue") },
  { name: "review-detail", account: "coordinator", path: "/#/review/e-1", ready: heading("Annual Research Symposium") },
  { name: "my-requests", account: "organiser", path: "/#/requests", ready: heading("My requests") },
  { name: "all-events", account: "coordinator", path: "/#/events", ready: heading("All events") },
  { name: "venue-availability", account: "venue", path: "/#/venues/v-1/availability", ready: (page) => page.locator("[id^=day-]").first().waitFor() },
  { name: "equipment-requests", account: "tech", path: "/#/equipment/requests", ready: heading("Equipment requests") },
  { name: "assignments", account: "lead", path: "/#/assignments", ready: (page) => page.getByText("Annual Research Symposium").first().waitFor() },
  { name: "notifications", account: "organiser", path: "/#/notifications", ready: (page) => page.getByRole("list", { name: "Notifications" }).waitFor() },
  { name: "safety-queue", account: "safety", path: "/#/safety", ready: (page) => page.getByText("Alumni Career Fair").first().waitFor() },
  {
    name: "command-palette",
    account: "coordinator",
    path: "/#/queue",
    ready: heading("Review queue"),
    after: async (page) => {
      await page.keyboard.press("Control+K");
      await page.getByRole("combobox", { name: "Screen" }).fill("ven");
    },
    widths: [1440],
  },
];

async function signIn(page: Page, account: fx.AccountKey | null, theme: string) {
  await page.goto(`${BASE}/`);
  await page.evaluate(
    ({ session, theme }) => {
      localStorage.setItem("connectsphere.theme", theme);
      if (session) sessionStorage.setItem("connectsphere.session", JSON.stringify(session));
      else sessionStorage.removeItem("connectsphere.session");
    },
    { session: account ? { ...fx.ACCOUNTS[account], token: "capture", lastLoginAt: new Date().toISOString() } : null, theme }
  );
}

async function main() {
  const browser = await chromium.launch();
  let violations = 0;
  for (const theme of THEMES) {
    mkdirSync(join(OUT, theme), { recursive: true });
    for (const shot of SHOTS.filter((entry) => !ONLY || entry.name === ONLY)) {
      for (const width of shot.widths ?? WIDTHS) {
        const context = await browser.newContext({ viewport: { width, height: width < 600 ? 780 : 900 }, timezoneId: "Asia/Singapore", locale: "en-SG" });
        const page = await context.newPage();
        await mockApi(page);
        await signIn(page, shot.account, theme);
        await page.goto(`${BASE}${shot.path}`);
        // A change of hash alone doesn't reload the app, and the app reads the session when it loads.
        await page.reload();
        await shot.ready(page);
        if (shot.after) await shot.after(page);
        await page.evaluate(() => document.fonts.ready);
        await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running" || a.effect?.getTiming().iterations === Infinity));
        await page.screenshot({ path: join(OUT, theme, `${shot.name}-${width}.png`), fullPage: shot.name !== "command-palette" });
        const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
        for (const violation of results.violations) {
          violations += 1;
          console.log(`${theme} ${shot.name} ${width}: ${violation.impact} ${violation.id} — ${violation.help}`);
          for (const node of violation.nodes.slice(0, 4)) console.log(`    ${node.target.join(" ")} :: ${node.failureSummary?.split("\n").slice(1).join(" ")}`);
        }
        await context.close();
      }
    }
  }
  await browser.close();
  console.log(violations === 0 ? "axe: no violations" : `axe: ${violations} violation(s)`);
  process.exitCode = violations === 0 ? 0 : 1;
}

void main();
