# EN-10-T1 — Every deployable builds into a hardened image that starts and answers its health endpoint

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-10-T1 |
| Test Scenario | Every deployable builds into a hardened image that starts and answers its health endpoint |
| Pre-conditions | 1. A pull request or push to main, so the Deploy workflow runs.<br>2. No Docker on any laptop: the images are built on the CI runner only (ADR-0012). |
| Test Steps | 1. Open the Deploy workflow run and find the five `Image (...)` jobs: planning-core, registration, notification, web, migrate.<br>2. In each, read the `Build` step (multi-stage build, buildx, GitHub Actions cache) and the `Smoke check` step (`deploy/ci/smoke-image.sh`).<br>3. Check what the smoke step asserts: the image runs as a non-zero uid; it starts with a read-only root filesystem, all capabilities dropped and no-new-privileges; the health endpoint answers; for the three backends `/readyz` reports the database `ok` and Kafka `not_configured`; for planning-core the Temporal worker entrypoint starts and its workflow bundle builds; for web the SPA fallback, immutable asset caching and security headers; for migrate every module's migrations apply and a second run applies none. |
| Test Data | Throwaway Postgres 17 service container (`ci`/`ci`). No KAFKA_* and no real Supabase: placeholders on the `.invalid` domain. |
| Expected Result | All five jobs pass. No secret is in any image: the Dockerfiles take none, and the smoke check supplies throwaway values at run time only. |
| Acceptance criterion | Images built in CI only (EN-10), each non-root, multi-stage, on a pinned base, with no secrets baked in. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The five Image jobs built, started read-only with capabilities dropped, answered /healthz and /readyz (database ok, kafka not_configured), ran as a non-root uid; the worker entrypoint and workflow bundle, the web SPA fallback and headers, and the migrate run (then a second run applying none) all passed. |
| Status | Pass |
| Remarks | Commit: 7f31fe5f8158bc75ca285a38e4ccca713e778a9f · Automated · Evidence: .github/workflows/deploy.yml › jobs 'Image (planning-core)', 'Image (registration)', 'Image (notification)', 'Image (web)', 'Image (migrate)', CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41511260190 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
