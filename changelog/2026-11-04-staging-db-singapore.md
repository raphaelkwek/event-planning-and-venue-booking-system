# Staging's database moves to Singapore, next to the VM

**Timestamp:** 2026-11-04T15:40+08:00 (SGT)
**Author:** Joash
**Reason:** Staging's Supabase project had been created in North-East Asia (Tokyo, `ap-northeast-1`), while
the VM and production's project are in Singapore. Measured on 4 Nov, each database round trip from the VM
cost about 75 ms on staging, against about 4.5 ms on production. A 15-minute load of the brief's
common staff operations, read from Grafana Cloud, gave p95s of 1.57 s (view an event), 1.56 s (list events),
1.50 s (check equipment availability) and 0.78 s (search venues, open a calendar). All of them are over
the 0.4 s objective for a staff GET (`documentation/slos.md` §3).
**Scope:** `deploy/demo/seed-staging.mjs` (the staging guard's project ref) and `documentation/deploy/README.md`.
Outside the repo: the new Supabase project, staging's GitHub environment, and the secrets folder.

## Changed

- **Staging runs on Supabase project `ersukefviuuygauatwox` in Singapore (`ap-southeast-1`).** The Tokyo
  project (`wxfkaoxkwtdkrhtlqwxy`) is paused, not deleted; the free plan allows two active projects. Its
  data can be restored from the dashboard within 90 days.
- Staging's `DATABASE_URL`, `MIGRATE_DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (secrets),
  `SUPABASE_URL` and `SUPABASE_ANON_KEY` (variables) point at the new project. The release's staging job
  ran every migration on the empty database as the container started, and set the project's Auth URLs.
- The seeded accounts, the Lead and the demo data were created again (`npm run seed:auth`,
  `npm run lead:create`, `npm run demo:seed -- --env staging`). Earlier dry-run records stayed in the paused
  project.
- `seed-staging.mjs` refuses any project but the new staging one. The deploy runbook now says to put
  both projects in the VM's region, and records the move.
