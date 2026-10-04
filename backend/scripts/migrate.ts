#!/usr/bin/env node
import "dotenv/config";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

// Each planning-core module owns its schema and its migrations folder (ADR-0004),
// and so does each separate service, such as notification (ADR-0008): its folder
// is backend/services/<service>/migrations. The name is also the key in
// public.schema_migrations, which is why the column is still called `service`:
// rows recorded before the merge keep matching.
const service = process.argv[2];
if (!service) {
  console.error("Usage: tsx backend/scripts/migrate.ts <module-or-service> [--seed]");
  process.exit(1);
}
const withSeed = process.argv.includes("--seed");

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const sql = postgres(databaseUrl, { max: 1 });

async function run() {
  await sql`create table if not exists public.schema_migrations (
    service    text        not null,
    filename   text        not null,
    applied_at timestamptz not null default now(),
    primary key (service, filename)
  )`;

  const serviceDir = join("backend", "services", service, "migrations");
  const moduleDir = existsSync(serviceDir)
    ? serviceDir
    : join("backend", "services", "planning-core", "migrations", service);
  const dirs = [moduleDir];
  if (withSeed) dirs.push(join(moduleDir, "seed"));

  for (const dir of dirs) {
    const files = readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const file of files) {
      const already = await sql`
        select 1 from public.schema_migrations
        where service = ${service} and filename = ${file}
      `;
      if (already.length > 0) {
        console.log(`skip  ${service}/${file} (already applied)`);
        continue;
      }

      const text = readFileSync(join(dir, file), "utf8");
      console.log(`apply ${service}/${file}`);
      await sql.begin(async (tx) => {
        await tx.unsafe(text);
        await tx`
          insert into public.schema_migrations (service, filename)
          values (${service}, ${file})
        `;
      });
    }
  }

  await sql.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
