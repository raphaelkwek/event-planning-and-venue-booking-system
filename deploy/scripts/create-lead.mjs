#!/usr/bin/env node
// ADR-0016. Creates the first Event Coordinator Lead in one environment's own Supabase project:
// the Supabase Auth user (with that project's service-role key) and its identity user with the
// EVENT_COORDINATOR_LEAD role (identity.users and identity.user_roles, the tables the identity
// module and its seeds use). Run it from a laptop, once per environment, after that
// environment's first release has run the migrations:
//
//   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<key> \
//   MIGRATE_DATABASE_URL='<session pooler URL>' \
//   npm run lead:create -- --project-ref <ref> --email lead@example.org --display-name "Lead One"
//
// It never reads .env (that file points at the team's shared project), and it refuses to run
// unless SUPABASE_URL and the database URL both belong to the --project-ref you typed. The
// password is generated and printed once, unless LEAD_PASSWORD is set. Running it again for
// the same email changes nothing.
import { randomBytes } from "node:crypto";
import { pathToFileURL } from "node:url";

export const LEAD_ROLE = "EVENT_COORDINATOR_LEAD";

export class LeadError extends Error {}

export function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (!["--project-ref", "--email", "--display-name"].includes(flag)) throw new LeadError(`unknown argument ${flag}`);
    if (value === undefined || value.startsWith("--")) throw new LeadError(`${flag} needs a value`);
    args[flag.slice(2)] = value;
  }
  if (!args["project-ref"]) throw new LeadError("--project-ref is required (the environment's Supabase project ref)");
  if (!args.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(args.email)) throw new LeadError("--email must be an email address");
  return { projectRef: args["project-ref"], email: args.email.toLowerCase(), displayName: args["display-name"] ?? "Event Coordinator Lead" };
}

/**
 * The guard: the Auth URL and the database URL must both be the project you named, so the
 * team's shared project cannot be written by a stale variable. Names the variable, never a value.
 */
export function checkProject({ projectRef, supabaseUrl, databaseUrl, serviceRoleKey }) {
  if (!/^[a-z0-9]{20}$/.test(projectRef)) throw new LeadError("--project-ref must be the 20-character project ref");
  if (!serviceRoleKey) throw new LeadError("SUPABASE_SERVICE_ROLE_KEY is not set");
  let auth;
  try {
    auth = new URL(supabaseUrl ?? "");
  } catch {
    throw new LeadError("SUPABASE_URL is not set or not a URL");
  }
  if (auth.protocol !== "https:" || auth.hostname !== `${projectRef}.supabase.co`) {
    throw new LeadError("SUPABASE_URL is not https://<project-ref>.supabase.co for the --project-ref given");
  }
  let db;
  try {
    db = new URL(databaseUrl ?? "");
  } catch {
    throw new LeadError("MIGRATE_DATABASE_URL is not set or not a URL");
  }
  // The pooler's user is postgres.<ref>; the direct host is db.<ref>.supabase.co.
  const belongs = decodeURIComponent(db.username) === `postgres.${projectRef}` || db.hostname === `db.${projectRef}.supabase.co`;
  if (!/^postgres(ql)?:$/.test(db.protocol) || !belongs) {
    throw new LeadError("MIGRATE_DATABASE_URL does not belong to the --project-ref given");
  }
  return { supabaseUrl: auth.origin };
}

export function generatePassword() {
  // 24 random characters plus one of each class Supabase's password rules may ask for.
  return `${randomBytes(18).toString("base64url")}Aa1!`;
}

async function admin(supabaseUrl, serviceRoleKey, path, init = {}) {
  const response = await fetch(`${supabaseUrl}/auth/v1/admin${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, ...init.headers },
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

async function findAuthUser(supabaseUrl, serviceRoleKey, email) {
  for (let page = 1; page <= 50; page += 1) {
    const { status, body } = await admin(supabaseUrl, serviceRoleKey, `/users?page=${page}&per_page=200`);
    if (status !== 200) throw new LeadError(`listing Auth users failed with ${status}`);
    const users = body.users ?? [];
    const match = users.find((user) => user.email?.toLowerCase() === email);
    if (match) return match.id;
    if (users.length < 200) return null;
  }
  return null;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const env = process.env;
  const { supabaseUrl } = checkProject({ projectRef: args.projectRef, supabaseUrl: env.SUPABASE_URL, databaseUrl: env.MIGRATE_DATABASE_URL, serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY });
  const key = env.SUPABASE_SERVICE_ROLE_KEY;

  const password = env.LEAD_PASSWORD || generatePassword();
  const created = await admin(supabaseUrl, key, "/users", { method: "POST", body: JSON.stringify({ email: args.email, password, email_confirm: true }) });
  let authId;
  let isNew = false;
  if (created.status === 200 || created.status === 201) {
    authId = created.body.id;
    isNew = true;
  } else if (created.status === 422) {
    authId = await findAuthUser(supabaseUrl, key, args.email);
    if (!authId) throw new LeadError(`Auth refused the user (${created.body.msg ?? created.body.error_code ?? 422}) and none exists with that email`);
  } else {
    throw new LeadError(`Auth refused the user with ${created.status} ${created.body.msg ?? ""}`.trim());
  }

  const { default: postgres } = await import("postgres");
  const sql = postgres(env.MIGRATE_DATABASE_URL, { max: 1, connect_timeout: 10 });
  try {
    const userId = await sql.begin(async (tx) => {
      await tx`insert into identity.role_policy (role, description)
               values (${LEAD_ROLE}, 'Assigns, reassigns and oversees Event Coordinators')
               on conflict (role) do nothing`;
      await tx`insert into identity.users (supabase_user_id, email, is_active, display_name)
               values (${authId}, ${args.email}, true, ${args.displayName})
               on conflict (supabase_user_id) do nothing`;
      const [user] = await tx`select id from identity.users where supabase_user_id = ${authId}`;
      if (!user) throw new LeadError("the identity user was not created (is the email already used by another account?)");
      const roles = await tx`select role from identity.user_roles where user_id = ${user.id}`;
      const others = roles.map((row) => row.role).filter((role) => role !== LEAD_ROLE);
      if (others.length > 0) throw new LeadError(`this account already has the role ${others.join(", ")}; one role per account`);
      await tx`insert into identity.user_roles (user_id, role) values (${user.id}, ${LEAD_ROLE}) on conflict (user_id, role) do nothing`;
      return user.id;
    });
    console.log(`Lead ready in ${args.projectRef}: ${args.email} (identity user ${userId}).`);
    if (isNew && !env.LEAD_PASSWORD) console.log(`Password, shown once: ${password}`);
    else if (!isNew) console.log("The Auth user already existed; its password was not changed.");
  } finally {
    await sql.end();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error instanceof LeadError ? `lead:create: ${error.message}` : error);
    process.exit(1);
  });
}
