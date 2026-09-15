#!/usr/bin/env node
import "dotenv/config";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

const service = process.argv[2];
if (!service) {
  console.error("Usage: tsx scripts/migrate.ts <service> [--seed]");
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

  const dirs = [join("services", service, "migrations")];
  if (withSeed) dirs.push(join("services", service, "migrations", "seed"));

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
