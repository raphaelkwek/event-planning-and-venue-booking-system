#!/usr/bin/env node
/**
 * Loads demonstration data into ConnectSphere's STAGING environment so every core workflow can be
 * shown past sign-in (compliance fix-list item 3).
 *
 *   npm run demo:seed -- --env staging            load everything
 *   npm run demo:seed -- --env staging --only venues,equipment
 *
 * It uses the application's own API, signed in as the seeded accounts, so the state machines, the
 * history, the outbox and the notifications are the real ones. The only SQL is the three extra
 * attendee accounts' identity rows, because no API creates a user (their Supabase Auth users are
 * made through the Auth admin API, as `npm run seed:auth` does).
 *
 * Safe to run again: every record is looked up by its name first and only what is missing is made.
 * A record a person has since moved on (an event approved in the UI, say) is left where it is.
 *
 * Hard guard: it refuses to run unless the Supabase project, the database login and the API host
 * are all staging's. Connection details come from C:\Users\Joash Lau\connectsphere-secrets\staging.env
 * (override with --env-file). No secret is ever printed.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import postgres from "postgres";

// ---------------------------------------------------------------------------------------------
// The staging guard
// ---------------------------------------------------------------------------------------------
const STAGING_REF = "ersukefviuuygauatwox"; // Singapore (ap-southeast-1) since 4 Nov 2026; was wxfkaoxkwtdkrhtlqwxy in Tokyo
const STAGING_API = "https://api.staging.4.194.57.47.sslip.io";
const STAGING_API_HOST = "api.staging.4.194.57.47.sslip.io";
const SEED_PASSWORD = "ConnectSphere-Test-1234!";
const DEFAULT_ENV_FILE = path.join(os.homedir(), "connectsphere-secrets", "staging.env");

function parseArgs(argv) {
  const args = { env: null, only: null, envFile: DEFAULT_ENV_FILE };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--env") args.env = argv[++i];
    else if (argv[i] === "--only") args.only = new Set(String(argv[++i]).split(","));
    else if (argv[i] === "--env-file") args.envFile = argv[++i];
    else throw new Error(`Unknown argument ${argv[i]}`);
  }
  return args;
}

function readEnvFile(file) {
  const values = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const i = line.indexOf("=");
    values[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
  return values;
}

function refuse(reason) {
  console.error(`REFUSED: ${reason}`);
  process.exit(2);
}

function loadStagingConfig(args) {
  if (args.env !== "staging") refuse("pass --env staging. This script only ever targets staging.");
  const env = readEnvFile(args.envFile);
  for (const key of ["DB_PASSWORD", "DATABASE_URL", "SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"]) {
    if (!env[key]) refuse(`${key} is missing from the env file.`);
  }
  let supabaseHost;
  let dbUser;
  try {
    supabaseHost = new URL(env.SUPABASE_URL).host;
    dbUser = decodeURIComponent(new URL(env.DATABASE_URL.replace("[YOUR-PASSWORD]", "x")).username);
  } catch {
    refuse("SUPABASE_URL or DATABASE_URL is not a URL.");
  }
  if (supabaseHost !== `${STAGING_REF}.supabase.co`) refuse("SUPABASE_URL is not the staging project.");
  if (!dbUser.endsWith(`.${STAGING_REF}`)) refuse("DATABASE_URL does not log in to the staging project.");
  if (new URL(STAGING_API).host !== STAGING_API_HOST) refuse("The API host is not staging's.");
  return {
    supabaseUrl: env.SUPABASE_URL,
    anonKey: env.SUPABASE_ANON_KEY,
    serviceKey: env.SUPABASE_SERVICE_ROLE_KEY,
    databaseUrl: env.DATABASE_URL.replace("[YOUR-PASSWORD]", encodeURIComponent(env.DB_PASSWORD)),
  };
}

// ---------------------------------------------------------------------------------------------
// The seeded people
// ---------------------------------------------------------------------------------------------
const n = (i) => String(i).padStart(12, "0");
const ACCOUNTS = {
  organiser: { id: `00000000-0000-0000-0000-${n(1)}` },
  coordinator: { id: `00000000-0000-0000-0000-${n(2)}` },
  venuestaff: { id: `00000000-0000-0000-0000-${n(3)}` },
  techsupport: { id: `00000000-0000-0000-0000-${n(4)}` },
  attendee: { id: `00000000-0000-0000-0000-${n(5)}` },
  organiser2: { id: `00000000-0000-0000-0000-${n(7)}` },
  coordinator2: { id: `00000000-0000-0000-0000-${n(8)}` },
  lead: { id: `00000000-0000-0000-0000-${n(9)}` },
  safety: { id: `00000000-0000-0000-0000-${n(10)}` },
};
/** Extra attendees, so a registration list and a waitlist have more than one person. */
const EXTRA_ATTENDEES = [2, 3, 4].map((k) => ({
  key: `attendee${k}`,
  email: `attendee${k}@connectsphere.test`,
  id: `00000000-0000-0000-0000-${n(10 + k)}`,
  authId: `10000000-0000-0000-0000-${n(10 + k)}`,
  name: `Attendee ${["", "", "Two", "Three", "Four"][k]}`,
}));
for (const a of EXTRA_ATTENDEES) ACCOUNTS[a.key] = { id: a.id };
for (const [key, a] of Object.entries(ACCOUNTS)) a.email = a.email ?? `${key}@connectsphere.test`;

// ---------------------------------------------------------------------------------------------
// HTTP, paced and patient: the API limits requests per address.
// ---------------------------------------------------------------------------------------------
let config;
const tokens = new Map();
const PACE_MS = 350;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stats = { created: {}, existing: {}, skipped: [] };
const bump = (bucket, key) => (stats[bucket][key] = (stats[bucket][key] ?? 0) + 1);

async function tokenFor(who) {
  if (tokens.has(who)) return tokens.get(who);
  const res = await fetch(`${config.supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: config.anonKey },
    body: JSON.stringify({ email: ACCOUNTS[who].email, password: SEED_PASSWORD }),
  });
  const body = await res.json().catch(() => ({}));
  if (!body.access_token) throw new Error(`Sign-in as ${who} failed (${res.status})`);
  tokens.set(who, body.access_token);
  return body.access_token;
}

/** One call. Returns { status, body, headers }. Retries a 429 and a gateway error. */
async function call(who, method, route, body, extraHeaders = {}) {
  for (let attempt = 0; attempt < 6; attempt++) {
    await sleep(PACE_MS);
    const res = await fetch(`${STAGING_API}${route}`, {
      method,
      headers: {
        Authorization: `Bearer ${await tokenFor(who)}`,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...extraHeaders,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.status === 429 || res.status === 502 || res.status === 503 || res.status === 504) {
      const wait = Number(res.headers.get("retry-after")) || 5 * (attempt + 1);
      await sleep(wait * 1000);
      continue;
    }
    const text = await res.text();
    let parsed = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = text;
    }
    return { status: res.status, body: parsed, headers: res.headers };
  }
  throw new Error(`${who} ${method} ${route} kept being refused with a rate limit or gateway error`);
}

async function must(who, method, route, body, ok = [200, 201], headers) {
  const r = await call(who, method, route, body, headers);
  if (!ok.includes(r.status)) {
    const code = r.body?.error?.code ?? "";
    throw new Error(`${who} ${method} ${route} answered ${r.status} ${code} ${r.body?.error?.message ?? ""}`.trim());
  }
  return r.body;
}

// ---------------------------------------------------------------------------------------------
// Time: everything is written in Singapore time.
// ---------------------------------------------------------------------------------------------
const at = (date, time) => `${date}T${time}:00+08:00`;
const inDays = (days) => new Date(Date.now() + days * 86_400_000).toISOString();

// ---------------------------------------------------------------------------------------------
// Phase 0: extra attendee accounts
// ---------------------------------------------------------------------------------------------
async function seedAttendeeAccounts() {
  for (const a of EXTRA_ATTENDEES) {
    const res = await fetch(`${config.supabaseUrl}/auth/v1/admin/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: config.serviceKey, Authorization: `Bearer ${config.serviceKey}` },
      body: JSON.stringify({ id: a.authId, email: a.email, password: SEED_PASSWORD, email_confirm: true }),
    });
    if (res.status === 200 || res.status === 201) bump("created", "auth users");
    else if (res.status === 422) bump("existing", "auth users");
    else throw new Error(`Creating the auth user ${a.email} answered ${res.status}`);
  }
  const sql = postgres(config.databaseUrl, { max: 1, prepare: false, onnotice: () => undefined });
  try {
    for (const a of EXTRA_ATTENDEES) {
      const done = await sql`
        insert into identity.users (id, supabase_user_id, email, is_active, display_name)
        values (${a.id}, ${a.authId}, ${a.email}, true, ${a.name})
        on conflict (id) do nothing returning id`;
      await sql`insert into identity.user_roles (user_id, role) values (${a.id}, 'ATTENDEE') on conflict (user_id, role) do nothing`;
      bump(done.length ? "created" : "existing", "attendee identities");
    }
  } finally {
    await sql.end();
  }
}

// ---------------------------------------------------------------------------------------------
// Phase 1: venues
// ---------------------------------------------------------------------------------------------
const hours = (open, close, saturday = [open, close], sunday = null) => {
  const day = (h) => (h ? { opensAt: h[0], closesAt: h[1] } : null);
  const weekday = day([open, close]);
  return {
    monday: weekday, tuesday: weekday, wednesday: weekday, thursday: weekday, friday: weekday,
    saturday: day(saturday), sunday: day(sunday),
  };
};

const VENUES = {
  auditorium: {
    name: "SMU Administration Building Auditorium",
    building: "Administration Building, Level 1, 81 Victoria Street",
    maxCapacity: 450,
    layouts: [{ name: "Theatre", capacity: 450 }, { name: "Classroom", capacity: 220 }, { name: "Banquet", capacity: 240 }],
    facilities: ["Projector", "Wireless microphones", "Stage lighting", "Live-stream camera", "Public address system"],
    accessibilityFeatures: ["Step-free access", "Hearing loop", "Wheelchair spaces", "Accessible toilet"],
    operatingHours: hours("08:00", "22:00", ["09:00", "18:00"]),
    setupMinutes: 60, turnaroundMinutes: 30,
  },
  lectureTheatre: {
    name: "Lee Kong Chian School of Business Lecture Theatre",
    building: "Lee Kong Chian School of Business, Level 2, 50 Stamford Road",
    maxCapacity: 250,
    layouts: [{ name: "Theatre", capacity: 250 }, { name: "Classroom", capacity: 120 }],
    facilities: ["Projector", "Wireless microphones", "Lecture capture", "Whiteboards"],
    accessibilityFeatures: ["Step-free access", "Hearing loop", "Wheelchair spaces"],
    operatingHours: hours("08:00", "21:00", null),
    setupMinutes: 30, turnaroundMinutes: 15,
  },
  mootCourt: {
    name: "Yong Pung How School of Law Moot Court",
    building: "School of Law, Level 3, 55 Armenian Street",
    maxCapacity: 120,
    layouts: [{ name: "Theatre", capacity: 120 }, { name: "Boardroom", capacity: 30 }],
    facilities: ["Projector", "Wireless microphones", "Video conferencing"],
    accessibilityFeatures: ["Step-free access", "Accessible toilet"],
    operatingHours: hours("09:00", "20:00", null),
    setupMinutes: 30, turnaroundMinutes: 30,
  },
  discussionRoom: {
    name: "SCIS1 Discussion Room B1-05",
    building: "School of Computing and Information Systems 1, Basement 1",
    maxCapacity: 3,
    layouts: [{ name: "Boardroom", capacity: 3 }],
    facilities: ["Whiteboards", "Video conferencing"],
    accessibilityFeatures: ["Step-free access"],
    operatingHours: hours("08:00", "21:00", ["09:00", "17:00"]),
    setupMinutes: 0, turnaroundMinutes: 0,
  },
  campusGreen: {
    name: "SMU Campus Green",
    building: "Campus Green, between the Administration Building and the Li Ka Shing Library",
    maxCapacity: 800,
    layouts: [{ name: "Open-air standing", capacity: 800 }, { name: "Banquet", capacity: 300 }],
    facilities: ["Power outlets", "Public address system", "Covered walkway"],
    accessibilityFeatures: ["Step-free access", "Accessible toilet"],
    operatingHours: hours("08:00", "21:00", ["08:00", "21:00"], ["08:00", "21:00"]),
    setupMinutes: 120, turnaroundMinutes: 60,
  },
  annex: {
    name: "Prinsep Street Annex Hall",
    building: "Prinsep Street Annex (closed for renovation)",
    maxCapacity: 80,
    layouts: [{ name: "Classroom", capacity: 80 }],
    facilities: ["Projector"],
    accessibilityFeatures: [],
    operatingHours: hours("09:00", "18:00", null),
    setupMinutes: 15, turnaroundMinutes: 15,
    inactive: true,
  },
};
const venueIds = {};

async function seedVenues() {
  const list = await must("venuestaff", "GET", "/venue/api/v1/venues?limit=100");
  const byName = new Map((list.items ?? []).map((v) => [v.name, v]));
  for (const [key, spec] of Object.entries(VENUES)) {
    const { inactive, ...input } = spec;
    let venue = byName.get(spec.name);
    if (venue) {
      bump("existing", "venues");
    } else {
      venue = await must("venuestaff", "POST", "/venue/api/v1/venues", input);
      bump("created", "venues");
      if (inactive) {
        await must("venuestaff", "PUT", `/venue/api/v1/venues/${venue.id}`, { ...input, isActive: false });
      }
    }
    venueIds[key] = venue.id;
  }
}

// ---------------------------------------------------------------------------------------------
// Phase 2: equipment
// ---------------------------------------------------------------------------------------------
const EQUIPMENT = {
  mics: { name: "Wireless handheld microphone", description: "Handheld UHF microphone with receiver.", kind: "BULK", totalQuantity: 24, characteristics: { Type: "UHF handheld" } },
  projectors: { name: "Portable projector", description: "4,000-lumen projector with HDMI cable.", kind: "BULK", totalQuantity: 6, characteristics: { Lumens: "4000", Input: "HDMI" } },
  chairs: { name: "Folding chair", description: "Stackable folding chair.", kind: "BULK", totalQuantity: 500, characteristics: {} },
  tables: { name: "Round banquet table", description: "Seats ten; 1.8 m round.", kind: "BULK", totalQuantity: 40, characteristics: { Seats: "10" } },
  pa: { name: "Portable PA system", description: "Battery PA with two microphones.", kind: "SERIALIZED", unitLabels: ["PA-01", "PA-02", "PA-03", "PA-04"], characteristics: { Power: "Battery" } },
  cameras: { name: "Video camera kit", description: "Camera, tripod and capture card.", kind: "SERIALIZED", unitLabels: ["CAM-01", "CAM-02", "CAM-03"], characteristics: { Resolution: "4K" } },
};
const equipmentIds = {};

async function seedEquipment() {
  const list = await must("techsupport", "GET", "/equipment/api/v1/equipment/types?limit=100");
  const byName = new Map((list.items ?? []).map((t) => [t.name, t]));
  for (const [key, spec] of Object.entries(EQUIPMENT)) {
    let type = byName.get(spec.name);
    if (type) {
      bump("existing", "equipment types");
    } else {
      type = await must("techsupport", "POST", "/equipment/api/v1/equipment/types", {
        name: spec.name,
        description: spec.description,
        characteristics: spec.characteristics,
        kind: spec.kind,
        totalQuantity: spec.kind === "BULK" ? spec.totalQuantity : null,
        unitLabels: spec.unitLabels ?? [],
      });
      bump("created", "equipment types");
      await markUnavailable(key, type);
    }
    equipmentIds[key] = type.id;
  }
}

/** "Partly unavailable": four microphones in for repair, and one PA unit out of service. */
async function markUnavailable(key, type) {
  const startsAt = at("2026-12-01", "00:00");
  const endsAt = at("2027-01-31", "23:59");
  if (key === "mics") {
    await must("techsupport", "POST", `/equipment/api/v1/equipment/types/${type.id}/unavailability`, {
      unitId: null, quantity: 4, startsAt, endsAt, reason: "Four microphones sent for battery replacement",
    });
    bump("created", "equipment unavailability periods");
  }
  if (key === "pa") {
    const detail = await must("techsupport", "GET", `/equipment/api/v1/equipment/types/${type.id}`);
    const unit = (detail.units ?? []).find((u) => u.label === "PA-02");
    if (unit) {
      await must("techsupport", "POST", `/equipment/api/v1/equipment/types/${type.id}/unavailability`, {
        unitId: unit.id, quantity: null, startsAt, endsAt, reason: "Speaker cone repair",
      });
      bump("created", "equipment unavailability periods");
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Phase 3: events. Each scenario reads where the event is and does only what is left.
// ---------------------------------------------------------------------------------------------
const ORDER = ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "AWAITING_CLARIFICATION", "APPROVED", "PLANNING", "SAFETY_REVIEW", "CONFIRMED"];
const eventsByName = new Map();

async function loadEvents() {
  eventsByName.clear();
  for (const who of ["organiser", "organiser2"]) {
    let cursor = null;
    do {
      const page = await must(who, "GET", `/event/api/v1/events?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
      for (const e of page.items ?? []) eventsByName.set(e.name, { ...e, owner: who });
      cursor = page.nextCursor;
    } while (cursor);
  }
}

const fresh = (ev) => must(ev.owner, "GET", `/event/api/v1/events/${ev.id}`);
const rank = (status) => ORDER.indexOf(status);

function requestBody(spec) {
  const body = {
    name: spec.name,
    purpose: spec.purpose,
    description: spec.description,
    proposedStartAt: at(spec.date, spec.from),
    proposedEndAt: at(spec.date, spec.to),
    expectedAttendance: spec.attendance,
    venueRequirements: spec.layout ? { layout: spec.layout, facilities: spec.facilities ?? [], notes: spec.venueNotes ?? null } : null,
    accessibilityNeeds: spec.accessibility ?? "Step-free access and a hearing loop.",
    equipmentRequired: Boolean(spec.equipmentRequired),
    equipmentRequirements: spec.equipmentRequirements ?? null,
    registrationRequired: Boolean(spec.registration),
  };
  if (spec.registration) {
    body.registrationOpensAt = spec.registration.opens;
    body.registrationClosesAt = spec.registration.closes;
  }
  return body;
}

async function ensureCreated(spec) {
  let ev = eventsByName.get(spec.name);
  if (ev) {
    bump("existing", "events");
    return { ev: await fresh(ev).then((e) => ({ ...e, owner: ev.owner })), isNew: false };
  }
  const owner = spec.owner ?? "organiser";
  const body = requestBody(spec);
  const created =
    spec.stage === "DRAFT"
      ? await must(owner, "POST", "/event/api/v1/event-drafts", body)
      : await must(owner, "POST", "/event/api/v1/events", body);
  bump("created", "events");
  ev = { ...created, owner };
  eventsByName.set(spec.name, ev);
  return { ev, isNew: true };
}

const coordinatorOf = (spec) => spec.coordinator ?? "coordinator";

async function advanceTo(spec, ev, target) {
  const coordinator = coordinatorOf(spec);
  if (rank(ev.status) >= rank(target) || ev.status === "CANCELLED" || ev.status === "REJECTED") return ev;
  if (ev.status === "SUBMITTED" && !ev.assignedCoordinatorId) {
    await must("lead", "POST", `/event/api/v1/events/${ev.id}/assignment`, { coordinatorId: ACCOUNTS[coordinator].id });
    ev = { ...(await fresh(ev)), owner: ev.owner };
  }
  if (target === "SUBMITTED") return ev;
  if (ev.status === "SUBMITTED") {
    await must(coordinator, "GET", `/event/api/v1/events/${ev.id}`); // opening it claims it for review (D1)
    ev = { ...(await fresh(ev)), owner: ev.owner };
  }
  return ev;
}

async function approve(spec, ev) {
  if (rank(ev.status) >= rank("APPROVED")) return ev;
  await must(coordinatorOf(spec), "POST", `/event/api/v1/events/${ev.id}/approve`, {});
  return { ...(await fresh(ev)), owner: ev.owner };
}

async function clarify(spec, ev, { respond }) {
  const rounds = await must(coordinatorOf(spec), "GET", `/event/api/v1/events/${ev.id}/clarifications`);
  if ((rounds.items ?? []).length === 0 && ev.status === "UNDER_REVIEW") {
    await must(coordinatorOf(spec), "POST", `/event/api/v1/events/${ev.id}/clarifications`, { message: spec.clarification.ask });
    ev = { ...(await fresh(ev)), owner: ev.owner };
  }
  if (respond && ev.status === "AWAITING_CLARIFICATION") {
    await must(ev.owner, "POST", `/event/api/v1/events/${ev.id}/clarifications/respond`, { message: spec.clarification.answer });
    ev = { ...(await fresh(ev)), owner: ev.owner };
  }
  return ev;
}

/** Books the venue for the event's own period: requested by the coordinator, approved by Venue Staff. */
async function ensureBooking(spec, ev, { approveIt }) {
  const state = await must(coordinatorOf(spec), "GET", `/venue/api/v1/booking-requests?eventId=${ev.id}`);
  let request = (state.items ?? []).find((r) => ["PENDING", "APPROVED"].includes(r.status));
  if (!request) {
    request = await must(coordinatorOf(spec), "POST", "/venue/api/v1/booking-requests", {
      eventId: ev.id,
      venueId: venueIds[spec.venue],
      startsAt: at(spec.date, spec.from),
      endsAt: at(spec.date, spec.to),
      layout: spec.layout,
      expectedAttendance: spec.attendance,
      facilities: spec.facilities ?? [],
      accessibilityFeatures: [],
    });
    bump("created", "venue booking requests");
  }
  if (approveIt && request.status === "PENDING") {
    await must("venuestaff", "POST", `/venue/api/v1/booking-requests/${request.id}/approve`, {});
    bump("created", "confirmed bookings");
  }
  return request;
}

/** Equipment lines for the event; returns the lines (existing or new). */
async function ensureEquipmentLines(spec, ev) {
  const existing = await must(coordinatorOf(spec), "GET", `/equipment/api/v1/equipment/request-lines?eventId=${ev.id}&limit=100`);
  if ((existing.items ?? []).length > 0) return existing.items;
  const created = await must(coordinatorOf(spec), "POST", "/equipment/api/v1/equipment/request-lines", {
    eventId: ev.id,
    lines: spec.equipmentLines.map((l) => ({
      equipmentTypeId: equipmentIds[l.type],
      quantity: l.quantity,
      notes: l.notes ?? "",
      requiredFrom: at(spec.date, spec.from),
      requiredTo: at(spec.date, spec.to),
    })),
  });
  bump("created", "equipment request lines");
  return created.items;
}

async function settleEquipment(spec, lines) {
  for (const [i, line] of lines.entries()) {
    const want = spec.equipmentLines[i];
    if (!want?.reserve) continue;
    let current = line;
    if (["PENDING", "SUBMITTED", "UNDER_REVIEW"].includes(current.status)) {
      await must("techsupport", "POST", `/equipment/api/v1/equipment/request-lines/${line.id}/status`, { status: "CONFIRMED" });
      current = { ...current, status: "CONFIRMED" };
    }
    if (current.status === "CONFIRMED") {
      const partial = want.reserve === "partial";
      await must(
        "techsupport",
        "POST",
        `/equipment/api/v1/equipment/request-lines/${line.id}/reservation`,
        partial ? { quantity: want.partialQuantity, partial: true } : {},
      );
      bump("created", "equipment reservations");
    }
  }
}

async function confirmArrangements(spec, ev) {
  if (ev.status !== "APPROVED" && ev.status !== "PLANNING") return ev;
  await must(coordinatorOf(spec), "POST", `/event/api/v1/events/${ev.id}/confirmation`, undefined);
  return { ...(await fresh(ev)), owner: ev.owner };
}

async function safety(spec, ev, decision) {
  const review = await must("safety", "GET", `/event/api/v1/events/${ev.id}/safety-review`);
  if (review.decision) return ev;
  await must("safety", "POST", `/event/api/v1/events/${ev.id}/safety-decision`, decision);
  return { ...(await fresh(ev)), owner: ev.owner };
}

async function markConfirmed(spec, ev) {
  await must(coordinatorOf(spec), "POST", `/event/api/v1/events/${ev.id}/mark-confirmed`, undefined);
  return { ...(await fresh(ev)), owner: ev.owner };
}

// ---- the scenarios ----------------------------------------------------------------------------
const reg = (opens, closes) => ({ opens: at(opens[0], opens[1]), closes: at(closes[0], closes[1]) });

const SCENARIOS = [
  {
    name: "Hackathon Kick-off Briefing", stage: "DRAFT", date: "2026-12-10", from: "10:00", to: "12:00", attendance: 90,
    purpose: "Brief teams before the 24-hour hackathon", description: "Rules, judging criteria and mentor introductions.",
  },
  {
    name: "Inter-Faculty Debate Finals", stage: "SUBMITTED", owner: "organiser2", date: "2026-12-03", from: "14:00", to: "17:00", attendance: 150,
    purpose: "Crown the inter-faculty debate champions", description: "Final round of the debate league with a panel of judges.",
    layout: "Theatre",
  },
  {
    name: "Alumni Networking Evening", stage: "SUBMITTED_ASSIGNED", date: "2026-12-04", from: "18:00", to: "20:00", attendance: 120,
    purpose: "Connect graduating students with alumni", description: "Speed-networking rounds followed by an open mixer.",
    layout: "Banquet",
  },
  {
    name: "Career Fair Briefing Session", stage: "UNDER_REVIEW", date: "2026-12-07", from: "13:00", to: "15:00", attendance: 200,
    purpose: "Prepare students for the career fair", description: "Employer expectations, dress code and CV clinic sign-ups.",
    layout: "Theatre",
  },
  {
    name: "Sustainability Showcase", stage: "AWAITING_CLARIFICATION", owner: "organiser2", date: "2026-12-11", from: "10:00", to: "16:00", attendance: 300,
    purpose: "Show student sustainability projects", description: "Exhibition booths and short talks on campus sustainability.",
    clarification: { ask: "Please confirm whether the booths need mains power and how many exhibitors you expect." },
  },
  {
    name: "Research Poster Day", stage: "APPROVED_HOLD", date: "2026-12-09", from: "09:00", to: "13:00", attendance: 180,
    purpose: "Showcase undergraduate research posters", description: "Poster judging and a tea reception.",
    layout: "Classroom", venue: "lectureTheatre",
    clarification: { ask: "Which departments are presenting, and do you need poster boards?", answer: "Computing, Business and Social Sciences; we will bring our own boards." },
  },
  {
    name: "Open Mic Night", stage: "REJECTED", owner: "organiser2", date: "2026-12-05", from: "19:00", to: "22:00", attendance: 100,
    purpose: "A relaxed performance night", description: "Student performers in front of a small audience.",
    rejection: "The venue is closed after 21:00 on that date; please resubmit for an earlier slot.",
  },
  {
    name: "Leadership Summit", stage: "APPROVED_PENDING_BOOKING", date: "2026-12-15", from: "14:00", to: "18:00", attendance: 100,
    purpose: "Train student club leaders", description: "Workshops on budgeting, safety and event planning for club committees.",
    layout: "Theatre", venue: "mootCourt", equipmentRequired: true,
    equipmentLines: [
      { type: "mics", quantity: 12, notes: "Six for panelists, six for floor runners", reserve: "partial", partialQuantity: 8 },
      { type: "projectors", quantity: 2, notes: "Front of house and a confidence monitor" },
    ],
  },
  {
    name: "Entrepreneurship Pitch Night", stage: "APPROVED_PENDING_BOOKING", owner: "organiser2", coordinator: "coordinator2", date: "2026-12-15", from: "16:00", to: "20:00", attendance: 90,
    purpose: "Student start-ups pitch to investors", description: "Ten five-minute pitches followed by investor questions.",
    layout: "Theatre", venue: "mootCourt", equipmentRequired: true,
    equipmentLines: [{ type: "tables", quantity: 10, notes: "For the investor panel and demo tables" }],
  },
  {
    name: "Data Science Bootcamp", stage: "PLANNING", date: "2026-12-16", from: "14:00", to: "18:00", attendance: 110,
    purpose: "Hands-on data science training", description: "Four-hour workshop on modelling and visualisation.",
    layout: "Classroom", venue: "lectureTheatre",
    safetyRequest: "The classroom layout leaves too little room at the exits. Please reduce the attendance or add an exit marshal.",
  },
  {
    name: "Cultural Festival Opening Ceremony", stage: "SAFETY_REVIEW", owner: "organiser2", coordinator: "coordinator2", date: "2026-12-17", from: "14:00", to: "18:00", attendance: 400,
    purpose: "Open the annual cultural festival", description: "Performances and a parade of student societies.",
    layout: "Theatre", venue: "auditorium",
  },
  {
    name: "Freshmen Welcome Night", stage: "CONFIRMED_REGISTRATION", date: "2027-01-12", from: "14:00", to: "18:00", attendance: 400,
    purpose: "Welcome incoming freshmen", description: "Introductions to student life, clubs and campus services.",
    layout: "Theatre", venue: "auditorium",
    registration: reg(["2026-11-01", "08:00"], ["2027-01-11", "18:00"]),
    registrants: ["attendee", "attendee2", "attendee3"],
    changeRequest: { reason: "More freshmen than planned have confirmed.", changes: { expectedAttendance: 420 }, decision: null },
  },
  {
    name: "Student Mentorship Roundtable", stage: "CONFIRMED_REGISTRATION", owner: "organiser2", coordinator: "coordinator2", date: "2026-12-02", from: "14:00", to: "16:00", attendance: 3,
    purpose: "Pair juniors with senior mentors", description: "A small roundtable: three seats only.",
    layout: "Boardroom", venue: "discussionRoom",
    registration: reg(["2026-11-01", "08:00"], ["2026-12-01", "18:00"]),
    registrants: ["attendee2", "attendee3"], manualAdd: "attendee4", waitlist: "attendee",
  },
  {
    name: "Annual Law Moot Final", stage: "CONFIRMED", date: "2026-12-22", from: "14:00", to: "18:00", attendance: 110,
    purpose: "Final round of the moot competition", description: "Two finalist teams argue before a panel of judges.",
    layout: "Theatre", venue: "mootCourt", equipmentRequired: true,
    equipmentLines: [
      { type: "mics", quantity: 6, notes: "Judges' bench and lectern", reserve: "full" },
      { type: "chairs", quantity: 40, notes: "Extra seating at the back", reserve: "full" },
    ],
    changeRequest: { reason: "Move the finalists' briefing earlier.", changes: { proposedStartAt: at("2026-12-22", "13:30") }, decision: "REJECT", decisionReason: "The venue is occupied until 14:00 by an earlier booking." },
  },
  {
    name: "Charity Run Briefing", stage: "CANCELLED", date: "2026-12-08", from: "14:00", to: "16:00", attendance: 80,
    purpose: "Brief runners for the charity run", description: "Route, safety and fundraising information.",
    layout: "Theatre", venue: "mootCourt",
    cancellation: "The run was postponed to next semester by the sponsor.",
  },
  {
    name: "Campus Concert Ticket Release", stage: "CONFIRMED_REGISTRATION", date: "2027-01-23", from: "14:00", to: "20:00", attendance: 780, optional: true,
    purpose: "Release tickets for the campus concert", description: "A high-demand event: attendees queue in the waiting room.",
    layout: "Open-air standing", venue: "campusGreen",
    registration: reg(["2026-11-01", "08:00"], ["2027-01-22", "18:00"]), registrants: [], highDemand: true,
  },
];

async function seedEvent(spec) {
  let { ev } = await ensureCreated(spec);
  // A cancelled, rejected or completed event can't move again: leave it where it is (an earlier
  // run, or a person in the UI, put it there).
  if (["CANCELLED", "REJECTED", "COMPLETED"].includes(ev.status)) {
    bump("existing", "events left in a final state");
    return;
  }
  if (ev.status === "DRAFT" && spec.stage !== "DRAFT") {
    ev = { ...(await must(ev.owner, "POST", `/event/api/v1/event-drafts/${ev.id}/submit`, {}, [200, 201])), owner: ev.owner };
  }
  const stage = spec.stage;
  if (stage === "DRAFT" || stage === "SUBMITTED") return;
  ev = await advanceTo(spec, ev, "SUBMITTED");
  if (stage === "SUBMITTED_ASSIGNED") return;
  ev = await advanceTo(spec, ev, "UNDER_REVIEW");
  if (stage === "UNDER_REVIEW") return;
  if (stage === "AWAITING_CLARIFICATION") {
    await clarify(spec, ev, { respond: false });
    return;
  }
  if (stage === "REJECTED") {
    if (ev.status === "UNDER_REVIEW") await must(coordinatorOf(spec), "POST", `/event/api/v1/events/${ev.id}/reject`, { reason: spec.rejection });
    return;
  }
  if (spec.clarification?.answer) ev = await clarify(spec, ev, { respond: true });
  ev = await approve(spec, ev);
  if (stage === "APPROVED_PENDING_BOOKING") {
    await ensureBooking(spec, ev, { approveIt: false });
    if (spec.equipmentLines) await settleEquipment(spec, await ensureEquipmentLines(spec, ev));
    return;
  }
  if (stage === "APPROVED_HOLD") {
    await ensureHold(spec, ev);
    return;
  }
  // Everything further has a confirmed booking and equipment settled.
  if (ev.status === "CANCELLED") return;
  if (stage === "CANCELLED") {
    await ensureBooking(spec, ev, { approveIt: true });
    await must(coordinatorOf(spec), "POST", `/event/api/v1/events/${ev.id}/cancellation`, { reason: spec.cancellation });
    return;
  }
  await ensureBooking(spec, ev, { approveIt: true });
  if (spec.equipmentLines) await settleEquipment(spec, await ensureEquipmentLines(spec, ev));
  if (rank(ev.status) < rank("SAFETY_REVIEW")) ev = await confirmArrangements(spec, ev);
  if (stage === "SAFETY_REVIEW") return;
  if (stage === "PLANNING") {
    if (ev.status === "SAFETY_REVIEW") ev = await safety(spec, ev, { decision: "REQUEST_CHANGES", reason: spec.safetyRequest, flagBookingIds: [], flagReservationIds: [] });
    return;
  }
  if (ev.status === "SAFETY_REVIEW") {
    ev = await safety(spec, ev, { decision: "APPROVE", reason: "Exits, capacity and accessibility checked against the booked layout." });
    ev = await markConfirmed(spec, ev);
  }
  if (spec.registration) await openForRegistration(spec, ev);
  if (spec.changeRequest) await ensureChangeRequest(spec, ev);
}

async function ensureHold(spec, ev) {
  const existing = await must(coordinatorOf(spec), "GET", `/venue/api/v1/holds?eventId=${ev.id}`);
  let hold = (existing.items ?? []).find((h) => ["REQUESTED", "HELD"].includes(h.status));
  if (!hold) {
    hold = await must(coordinatorOf(spec), "POST", "/venue/api/v1/holds", {
      eventId: ev.id, venueId: venueIds[spec.venue], startsAt: at(spec.date, spec.from), endsAt: at(spec.date, spec.to), reminderLeadMinutes: 1440,
    });
    bump("created", "holds");
  }
  if (hold.status === "REQUESTED") {
    await must("venuestaff", "POST", `/venue/api/v1/holds/${hold.id}/place`, { expiresAt: inDays(10) });
    bump("created", "tentative holds placed");
  }
}

async function ensureChangeRequest(spec, ev) {
  const list = await must(ev.owner, "GET", `/event/api/v1/events/${ev.id}/change-requests`);
  if ((list.items ?? []).length > 0) return;
  const cr = await must(ev.owner, "POST", `/event/api/v1/events/${ev.id}/change-requests`, {
    reason: spec.changeRequest.reason, changes: spec.changeRequest.changes,
  });
  bump("created", "change requests");
  if (spec.changeRequest.decision) {
    await must(coordinatorOf(spec), "POST", `/event/api/v1/change-requests/${cr.id}/decision`, {
      decision: spec.changeRequest.decision, reason: spec.changeRequest.decisionReason,
    });
  }
}

// ---- registration ---------------------------------------------------------------------------------
async function waitFor(label, fn, tries = 40) {
  for (let i = 0; i < tries; i++) {
    const value = await fn();
    if (value) return value;
    await sleep(3000);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function openForRegistration(spec, ev) {
  if (spec.highDemand) {
    const r = await call(ev.owner, "PUT", `/event/api/v1/events/${ev.id}/high-demand`, { highDemand: true });
    if (r.status === 404) stats.skipped.push("High-demand flag: the deployed API does not have it yet");
  }
  // The registration service learns of the event and its seats from Kafka, so wait for them.
  const listed = await waitFor(`${spec.name} to reach the registration service`, async () => {
    const r = await call("attendee", "GET", `/registration/api/v1/open-events/${ev.id}`);
    return r.status === 200 ? r.body : null;
  }).catch((e) => {
    stats.skipped.push(`${spec.name}: ${e.message} (is the Kafka relay running on staging?)`);
    return null;
  });
  if (!listed) return;
  for (const who of spec.registrants ?? []) await registerAs(spec, ev, who);
  if (spec.manualAdd) {
    const r = await call(ev.owner, "POST", `/registration/api/v1/events/${ev.id}/manual-registrations`, {
      attendeeEmail: ACCOUNTS[spec.manualAdd].email, reason: "Added by the organiser at the attendee's request",
    });
    if (r.status === 201) bump("created", "manual registrations");
    else if (r.status !== 409) stats.skipped.push(`${spec.name}: manual add answered ${r.status} ${r.body?.error?.code ?? ""}`);
  }
  if (spec.waitlist) {
    const r = await call(spec.waitlist, "POST", `/registration/api/v1/events/${ev.id}/waitlist`, undefined);
    if (r.status === 201) bump("created", "waitlist entries");
    else if (r.status !== 409) stats.skipped.push(`${spec.name}: waitlist answered ${r.status} ${r.body?.error?.code ?? ""}`);
  }
}

async function registerAs(spec, ev, who) {
  // Seats appear when the approved booking has been consumed, so retry a "not yet".
  for (let i = 0; i < 20; i++) {
    const r = await call(who, "POST", "/registration/api/v1/registrations", { eventId: ev.id });
    if (r.status === 201) return void bump("created", "registrations");
    if (r.status === 409 && r.body?.error?.code === "REGISTRATION_DUPLICATE") return void bump("existing", "registrations");
    if (r.status === 409 && r.body?.error?.code === "REGISTRATION_FULL") return;
    if (r.status === 403 && r.body?.error?.code?.startsWith("ADMISSION")) return;
    await sleep(3000);
  }
  stats.skipped.push(`${spec.name}: ${who} could not register`);
}

// ---- the venue block ------------------------------------------------------------------------------
async function seedBlock() {
  const existing = await must("venuestaff", "GET", `/venue/api/v1/venues/${venueIds.lectureTheatre}/unavailability`);
  if ((existing.items ?? []).length > 0) return void bump("existing", "venue blocks");
  await must("venuestaff", "POST", `/venue/api/v1/venues/${venueIds.lectureTheatre}/unavailability`, {
    startsAt: at("2026-12-23", "08:00"), endsAt: at("2026-12-24", "21:00"), reasonType: "MAINTENANCE",
    description: "Projector and lecture-capture upgrade over the year-end break",
  });
  bump("created", "venue blocks");
}

// ---------------------------------------------------------------------------------------------
async function main() {
  const args = parseArgs(process.argv.slice(2));
  config = loadStagingConfig(args);
  const wants = (phase) => !args.only || args.only.has(phase);
  console.log(`Seeding staging (project ${STAGING_REF}) through ${STAGING_API_HOST}`);

  if (wants("accounts")) await seedAttendeeAccounts();
  // Later phases need the ids, so the lookups always run; they create nothing that exists.
  await seedVenues();
  await seedEquipment();
  if (wants("events")) {
    await loadEvents();
    for (const spec of SCENARIOS) {
      try {
        await seedEvent(spec);
        console.log(`  ok  ${spec.name}`);
      } catch (error) {
        if (!spec.optional) throw error;
        stats.skipped.push(`${spec.name}: ${error.message}`);
      }
    }
    await seedBlock();
  }
  console.log("Created:", JSON.stringify(stats.created, null, 1));
  console.log("Already there:", JSON.stringify(stats.existing));
  if (stats.skipped.length) console.log("Skipped:\n - " + stats.skipped.join("\n - "));
}

main().catch((error) => {
  console.error(`FAILED: ${error.message}`);
  process.exit(1);
});
