import { appendFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { ROLES, type Role } from "@connectsphere/contracts";
import type { Permission } from "../../src/shared/authz/gate.js";
import { pdp, type PolicyResource } from "../../src/shared/authz/pdp.js";
import { resolveAccessScope } from "../../src/modules/identity/index.js";
import { asCaller } from "../../src/modules/event/repo/requestRole.js";
import { EVENT_END, EVENT_START } from "../support/eventDates.js";
import { cleanLineFixtures, createBulkType, createEvent, insertLineDirect } from "../support/lineFixtures.js";
import { newVenue, pendingRequest } from "../support/s3Fixtures.js";
import { deleteSeededEvents, seedEvent } from "../support/seedEvent.js";
import { cleanVenueFixtures } from "../support/venueFixtures.js";
import { answeringRoutes, PUBLIC_ROUTES, routesOf, SESSION_ROUTES, type ServedRoute } from "../support/routeTable.js";
import { testDb } from "../support/testDb.js";

/**
 * EN-07.3 (EN-07-T11): the generated authorisation matrix. Every route planning-core
 * serves (read off the router, the table the OpenAPI test checks) × every role ×
 * a related and an unrelated record. The expected outcome is the Cerbos PDP's own
 * decision for that case, and the HTTP response must match it:
 *
 * - the role's reach for the route's action is NEVER: 403 ROLE_NOT_AUTHORISED;
 * - otherwise, on a route that addresses a record: Cerbos decides with the
 *   attributes the record really has (its owner, assigned coordinator, venue
 *   staff), and row-level security decides whether the caller's claims reach its
 *   event (ADR-0010: Cerbos for actions, RLS for rows). Both yes: the response is
 *   neither 401, 403, 404 nor 503 (a 400, 409 or 422 still means "let in"). Either
 *   no: 403 or 404, and nothing of the record;
 * - a route that addresses no record: anything but 401, 403, 404 or 503.
 *
 * A route added without a policy gate fails here (no gate to read) and in
 * routePermissions.unit.test.ts. Needs a throwaway database and a real PDP (CI).
 */

const { subjects, caller } = vi.hoisted(() => {
  const subjects = new Map<string, { id: string; role: string }>();
  const caller = (subject: string) => {
    const found = subjects.get(subject);
    if (!found) throw new Error(`no matrix principal ${subject}`);
    return { id: found.id, email: `${subject.toLowerCase()}@connectsphere.test`, role: found.role };
  };
  return { subjects, caller };
});

vi.mock("../../src/shared/auth/verifyJwt.js", () => ({
  verifyJwt: (req: { auth?: { supabaseUserId?: string }; header(name: string): string | undefined }, _res: unknown, next: () => void) => {
    req.auth = { supabaseUserId: req.header("x-matrix-subject") };
    next();
  },
}));
vi.mock("../../src/modules/event/auth/identity.js", async (actual) => ({
  ...(await actual<object>()),
  resolveCurrentUser: async (subject: string) => caller(subject),
}));
vi.mock("../../src/modules/venue/auth/identity.js", async (actual) => ({
  ...(await actual<object>()),
  resolveCurrentUser: async (subject: string) => caller(subject),
}));
vi.mock("../../src/modules/equipment/auth/identity.js", async (actual) => ({
  ...(await actual<object>()),
  resolveCurrentUser: async (subject: string) => caller(subject),
}));
vi.mock("../../src/modules/change/auth/identity.js", async (actual) => ({
  ...(await actual<object>()),
  resolveCurrentUser: async (subject: string) => caller(subject),
}));
vi.mock("../../src/modules/identity/repo/users.js", async (actual) => ({
  ...(await actual<object>()),
  findUserBySupabaseId: async (_sql: unknown, subject: string) => ({ ...caller(subject), isActive: true }),
  findRoleForUser: async (_sql: unknown, id: string) => [...subjects.values()].find((p) => p.id === id)?.role ?? null,
}));

// Each module limits requests per address, and every request here comes from one. The limits are a
// different control (they run before authentication) with tests of their own, so they are lifted.
vi.mock("express-rate-limit", async (actual) => ({
  ...(await actual<object>()),
  rateLimit: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const { app } = await import("../../src/app.js");

const sql = testDb();

/** The caller for each role, and the other people the unrelated records belong to. */
const P = Object.fromEntries(ROLES.map((role) => [role, randomUUID()])) as Record<Role, string>;
const OTHER = { organiser: randomUUID(), coordinator: randomUUID(), staff: randomUUID() };
for (const role of ROLES) subjects.set(role, { id: P[role], role });

interface World {
  event: { id: string; reference: string; ownerId: string; coordinatorId: string };
  draft: { id: string; ownerId: string };
  venue: { id: string; staffIds: string[] };
  booking: string;
  hold: string;
  line: string;
  change: string;
  block: string;
}
let type = "";
const worlds = {} as Record<"related" | "unrelated", World>;

async function buildWorld(owner: string, coordinator: string, staff: string): Promise<World> {
  const event = await createEvent(sql, { ownerId: owner, coordinatorId: coordinator, name: "Matrix event" });
  const draftId = await seedEvent(sql, { ownerId: owner, status: "DRAFT", endsAt: new Date(EVENT_END), name: "Matrix draft" });
  const venue = await newVenue(sql, staff, "Matrix Hall", "Theatre", 200);
  const booking = await pendingRequest(sql, { requestedBy: coordinator, venueId: venue.id, eventId: event.id, layout: "Theatre" });
  const [hold] = await sql<{ id: string }[]>`
    insert into venue.holds (event_id, venue_id, starts_at, ends_at, reminder_lead_minutes, requested_by, created_by, updated_by)
    values (${event.id}, ${venue.id}, ${EVENT_START}, ${EVENT_END}, 60, ${coordinator}, ${coordinator}, ${coordinator})
    returning id
  `;
  const line = await insertLineDirect(sql, { event, equipmentTypeId: type, requestedBy: coordinator });
  const [change] = await sql<{ id: string }[]>`
    insert into change.change_requests (event_id, event_reference, requested_by, reason, created_by, updated_by)
    values (${event.id}, ${event.reference}, ${owner}, 'Matrix change', ${owner}, ${owner})
    returning id
  `;
  // S1: a change request always proposes at least one field; this one, more guests.
  await sql`
    insert into change.change_request_fields (request_id, field_name, current_value, proposed_value)
    values (${change!.id}, 'expectedAttendance', ${sql.json(150)}, ${sql.json(160)})
  `;
  const blockFrom = new Date(new Date(EVENT_END).getTime() + 7 * 24 * 3600 * 1000);
  const [block] = await sql<{ id: string }[]>`
    insert into venue.unavailability_blocks (venue_id, starts_at, ends_at, reason_type, description, status, created_by, updated_by)
    values (${venue.id}, ${blockFrom}, ${new Date(blockFrom.getTime() + 3600 * 1000)}, 'MAINTENANCE', 'Matrix block', 'ACTIVE', ${staff}, ${staff})
    returning id
  `;
  return {
    event: { id: event.id, reference: event.reference, ownerId: owner, coordinatorId: coordinator },
    draft: { id: draftId, ownerId: owner },
    venue: { id: venue.id, staffIds: [staff] },
    booking: booking.id,
    hold: hold!.id,
    line,
    change: change!.id,
    block: block!.id,
  };
}

async function cleanUp() {
  const owners = [P.EVENT_ORGANISER, OTHER.organiser];
  const events = sql`select id from event.events where owner_id in ${sql(owners)}`;
  const requests = sql`select id from change.change_requests where event_id in (${events})`;
  await sql`delete from change.outbox where message_key in (select id::text from (${events}) e)`;
  await sql`delete from change.change_request_fields where request_id in (${requests})`;
  await sql`delete from change.change_requests where event_id in (${events})`;
  for (const staff of [P.VENUE_STAFF, OTHER.staff]) {
    await sql`delete from venue.venue_history where venue_id in (select id from venue.venues where created_by = ${staff})`;
    await cleanVenueFixtures(sql, staff);
  }
  await cleanLineFixtures(sql, owners, [P.TECH_SUPPORT_STAFF]);
  await deleteSeededEvents(sql, owners);
}

/** The record a route addresses, from its path, its query or its body. */
type RecordKind = "event" | "draft" | "change" | "venue" | "block" | "type" | "line" | "booking" | "hold" | "eventQuery" | "none";

interface Recipe {
  record: RecordKind;
  url: (w: World) => string;
  body?: (w: World) => object;
  /** When the route also asks another action of the policies itself (G2's preview). */
  decides?: string;
  /** Roles the route reads the record's event for under scope ALL, as the reviewer of their own queue (U1). */
  staffRows?: Role[];
}

const later = new Date(new Date(EVENT_END).getTime() + 14 * 24 * 3600 * 1000);
const PERIOD = { startsAt: EVENT_START, endsAt: EVENT_END };

/**
 * Only what a route needs beyond its path: a query or body that gets a permitted
 * caller past validation to the record, so the refusal tested is the record's. Every
 * other route's record comes from its path (inferRecipe).
 */
const OVERRIDES: Record<string, Partial<Recipe>> = {
  "PUT /api/v1/event-drafts/{id}": { body: () => ({ name: "Matrix draft, saved" }) },
  "POST /api/v1/events/{id}/reject": { body: () => ({ reason: "Matrix rejection" }) },
  "POST /api/v1/events/{id}/clarifications": { body: () => ({ message: "Matrix question" }) },
  "POST /api/v1/events/{id}/clarifications/respond": { body: () => ({ message: "Matrix answer" }) },
  "POST /api/v1/change-requests/{id}/decision": { body: () => ({ decision: "APPROVE" }) },
  "GET /api/v1/change-requests/{id}/impact": { decides: "preview_change_impact" },
  // U1: the Safety Officer reads the event under review whatever their own scope holds.
  "GET /api/v1/events/{id}/safety-review": { staffRows: ["SAFETY_OFFICER"] },
  "POST /api/v1/events/{id}/safety-decision": { staffRows: ["SAFETY_OFFICER"] },
  // E2's proposal route is retired: it answers 410 to every coordinator, whatever the event.
  "POST /api/v1/events/{id}/reassignment-proposals": { record: "none" },
  "POST /api/v1/events/{id}/cancellation": { body: () => ({ reason: "Matrix cancellation" }) },
  "GET /api/v1/venues/{id}/suitability": { record: "eventQuery", url: (w) => `/api/v1/venues/${w.venue.id}/suitability?eventId=${w.event.id}` },
  "GET /api/v1/venues/search/prefill": { record: "eventQuery", url: (w) => `/api/v1/venues/search/prefill?eventId=${w.event.id}` },
  "GET /api/v1/equipment/request-lines": { record: "eventQuery", url: (w) => `/api/v1/equipment/request-lines?eventId=${w.event.id}` },
  "POST /api/v1/equipment/request-lines": { record: "eventQuery", url: () => "/api/v1/equipment/request-lines", body: (w) => ({ eventId: w.event.id, lines: [] }) },
  "GET /api/v1/booking-requests": { record: "eventQuery", url: (w) => `/api/v1/booking-requests?eventId=${w.event.id}` },
  "POST /api/v1/booking-requests": {
    record: "eventQuery",
    url: () => "/api/v1/booking-requests",
    body: (w) => ({ eventId: w.event.id, venueId: w.venue.id, ...PERIOD, layout: "Theatre", expectedAttendance: 80, facilities: [], accessibilityFeatures: [] }),
  },
  "GET /api/v1/holds": { record: "eventQuery", url: (w) => `/api/v1/holds?eventId=${w.event.id}` },
  "POST /api/v1/holds": {
    record: "eventQuery",
    url: () => "/api/v1/holds",
    body: (w) => ({ eventId: w.event.id, venueId: w.venue.id, startsAt: later.toISOString(), endsAt: new Date(later.getTime() + 3600_000).toISOString(), reminderLeadMinutes: 60 }),
  },
  "GET /api/v1/access-scope/{resource}": { record: "none", url: () => "/api/v1/access-scope/events" },
  "POST /api/v1/permissions/check": { record: "none", body: () => ({ checks: [{ kind: "event", action: "view" }] }) },
};

function inferRecipe(route: ServedRoute): Recipe {
  const fill = (w: World) =>
    route.path
      .replace(/^\/api\/v1\/event-drafts\/\{id\}/, `/api/v1/event-drafts/${w.draft.id}`)
      .replace(/^\/api\/v1\/events\/\{id\}/, `/api/v1/events/${w.event.id}`)
      .replace(/^\/api\/v1\/change-requests\/\{id\}/, `/api/v1/change-requests/${w.change}`)
      .replace(/^\/api\/v1\/venues\/\{id\}/, `/api/v1/venues/${w.venue.id}`)
      .replace("{blockId}", w.block)
      .replace(/^\/api\/v1\/equipment\/types\/\{id\}/, `/api/v1/equipment/types/${type}`)
      .replace(/^\/api\/v1\/equipment\/request-lines\/\{id\}/, `/api/v1/equipment/request-lines/${w.line}`)
      .replace(/^\/api\/v1\/booking-requests\/\{id\}/, `/api/v1/booking-requests/${w.booking}`)
      .replace(/^\/api\/v1\/holds\/\{id\}/, `/api/v1/holds/${w.hold}`);
  const record: RecordKind = route.path.includes("{blockId}")
    ? "block"
    : (
        [
          [/^\/api\/v1\/event-drafts\/\{id\}/, "draft"],
          [/^\/api\/v1\/events\/\{id\}/, "event"],
          [/^\/api\/v1\/change-requests\/\{id\}/, "change"],
          [/^\/api\/v1\/venues\/\{id\}/, "venue"],
          [/^\/api\/v1\/equipment\/types\/\{id\}/, "type"],
          [/^\/api\/v1\/equipment\/request-lines\/\{id\}/, "line"],
          [/^\/api\/v1\/booking-requests\/\{id\}/, "booking"],
          [/^\/api\/v1\/holds\/\{id\}/, "hold"],
        ] as const
      ).find(([pattern]) => pattern.test(route.path))?.[1] ?? "none";
  return { record, url: fill, ...OVERRIDES[`${route.method} ${route.path}`] };
}

/** The attributes the services hold for a record, as the policies read them (policies/README.md). */
function resourceFor(kind: string, record: RecordKind, w: World): PolicyResource | null {
  const event = { ownerId: w.event.ownerId, assignedCoordinatorId: w.event.coordinatorId, pendingNomineeId: null, registrationOpen: false };
  switch (record) {
    case "none":
      return null;
    case "type":
      return { kind, id: type, attr: {} };
    case "venue":
    case "block":
      return { kind, id: w.venue.id, attr: { venueStaffIds: w.venue.staffIds } };
    case "draft":
      return { kind, id: w.draft.id, attr: { ...event, ownerId: w.draft.ownerId, assignedCoordinatorId: null } };
    default:
      if (kind === "venue") return { kind, id: w.venue.id, attr: { venueStaffIds: w.venue.staffIds } };
      return { kind, id: `${record}-of-${w.event.id}`, attr: { ...event, venueStaffIds: w.venue.staffIds } };
  }
}

/**
 * Which claims reach the record's event (RLS, migration event/0025): the caller's own
 * A3 scope; for Venue Staff on their bookings and holds, and Technical Support on
 * equipment lines, the module reads the event behind their own record (scope ALL).
 */
async function rowsReach(role: Role, recipe: Recipe, w: World): Promise<boolean> {
  const { record } = recipe;
  if (["none", "type", "venue", "block"].includes(record)) return true;
  const eventId = record === "draft" ? w.draft.id : w.event.id;
  const staffRecord =
    (recipe.staffRows ?? []).includes(role) ||
    (role === "VENUE_STAFF" && (record === "booking" || record === "hold")) ||
    (role === "TECH_SUPPORT_STAFF" && (record === "line" || record === "eventQuery"));
  const scope = staffRecord ? ({ scopeType: "ALL" } as const) : resolveAccessScope(role, P[role], "events");
  const rows = await asCaller(sql, scope, P[role], (tx) => tx`select 1 from event.events where id = ${eventId}`);
  return rows.length > 0;
}

type Expected = "ROLE_REFUSED" | "HIDDEN" | "LET_IN";

interface Outcome {
  route: string;
  role: Role;
  variant: "related" | "unrelated" | "-";
  expected: Expected;
  status: number;
  code: string | null;
  ok: boolean;
}

function matches(expected: Expected, status: number, code: string | null): boolean {
  if (expected === "ROLE_REFUSED") return status === 403 && code === "ROLE_NOT_AUTHORISED";
  if (expected === "HIDDEN") return status === 403 || status === 404;
  return ![401, 403, 404, 503].includes(status) && status < 500;
}

async function send(route: ServedRoute, recipe: Recipe, role: Role, w: World) {
  const method = route.method.toLowerCase() as "get" | "post" | "put" | "patch";
  let call = request(app)[method](recipe.url(w)).set("x-matrix-subject", role);
  if (recipe.body) call = call.send(recipe.body(w));
  else if (method !== "get") call = call.send({});
  return call;
}

/** GETs first, then changes, and the cancellation last: no case's write may hide another's record. */
function ordered(routes: ServedRoute[]): ServedRoute[] {
  const rank = (route: ServedRoute) => (route.method === "GET" ? 0 : route.path.endsWith("/cancellation") ? 2 : 1);
  return [...routes].sort((a, b) => rank(a) - rank(b));
}

const outcomes: Outcome[] = [];

beforeAll(async () => {
  await cleanUp();
  type = (await createBulkType(sql, P.TECH_SUPPORT_STAFF, `Matrix chairs ${randomUUID().slice(0, 8)}`, 20)).id;
  worlds.related = await buildWorld(P.EVENT_ORGANISER, P.EVENT_COORDINATOR, P.VENUE_STAFF);
  worlds.unrelated = await buildWorld(OTHER.organiser, OTHER.coordinator, OTHER.staff);
}, 60_000);

afterAll(async () => {
  await cleanUp();
  await sql.end();
});

describe.skipIf(!process.env.CERBOS_URL)("the generated authorisation matrix (EN-07.3)", () => {
  const routes = ordered(
    answeringRoutes(routesOf(app)).filter(
      (route) => !PUBLIC_ROUTES.includes(`${route.method} ${route.path}`) && `${route.method} ${route.path}` !== "POST /api/v1/auth/logout"
    )
  );

  it("EN-07-T11 covers every gated and session route", () => {
    expect(routes.length).toBeGreaterThan(80);
  });

  it(
    "EN-07-T11 every route × role × related and unrelated record answers as the Cerbos PDP decides",
    async () => {
      for (const route of routes) {
        const key = `${route.method} ${route.path}`;
        const session = SESSION_ROUTES.includes(key);
        const permission: Permission | undefined = route.permissions[0];
        expect(session || permission, `${key} has no policy gate`).toBeTruthy();
        const recipe = inferRecipe(route);

        for (const role of ROLES) {
          const principal = { id: P[role], role };
          const reach = session ? "ALWAYS" : await pdp.reach(principal, permission!.kind, permission!.action);
          const variants = recipe.record === "none" ? (["-"] as const) : (["related", "unrelated"] as const);
          for (const variant of variants) {
            const w = worlds[variant === "-" ? "related" : variant];
            let expected: Expected;
            if (reach === "NEVER") expected = "ROLE_REFUSED";
            else if (session || recipe.record === "none") expected = "LET_IN";
            else {
              const resource = resourceFor(permission!.kind, recipe.record, w)!;
              const allowed = await pdp.allows(principal, resource, recipe.decides ?? permission!.action);
              expected = allowed && (await rowsReach(role, recipe, w)) ? "LET_IN" : "HIDDEN";
            }
            const response = await send(route, recipe, role, w);
            const code = (response.body as { error?: { code?: string } })?.error?.code ?? null;
            // A refusal gives nothing of the record away: not even its event's reference.
            const leaked = expected !== "LET_IN" && JSON.stringify(response.body ?? {}).includes(w.event.reference);
            const ok = matches(expected, response.status, code) && !leaked;
            outcomes.push({ route: key, role, variant, expected, status: response.status, code: leaked ? `${code} (leaked the reference)` : code, ok });
          }
        }
      }

      const summary = process.env.GITHUB_STEP_SUMMARY;
      if (summary) {
        const cell = (o: Outcome) => `${o.status}${o.ok ? "" : " ✗"}`;
        const lines = ["### EN-07 authorisation matrix", "", `| Route | ${ROLES.join(" | ")} |`, `|---|${ROLES.map(() => "---").join("|")}|`];
        for (const route of [...new Set(outcomes.map((o) => o.route))]) {
          const row = ROLES.map((role) =>
            outcomes
              .filter((o) => o.route === route && o.role === role)
              .map((o) => (o.variant === "-" ? cell(o) : `${o.variant[0]}:${cell(o)}`))
              .join(" ")
          );
          lines.push(`| \`${route}\` | ${row.join(" | ")} |`);
        }
        appendFileSync(summary, `${lines.join("\n")}\n\n${outcomes.length} cases, ${outcomes.filter((o) => !o.ok).length} mismatches.\n`);
      }

      const mismatches = outcomes.filter((o) => !o.ok).map((o) => `${o.route} as ${o.role} (${o.variant}): expected ${o.expected}, got ${o.status} ${o.code ?? ""}`);
      expect(mismatches).toEqual([]);
      expect(outcomes.length).toBeGreaterThan(800);
    },
    600_000
  );
});
