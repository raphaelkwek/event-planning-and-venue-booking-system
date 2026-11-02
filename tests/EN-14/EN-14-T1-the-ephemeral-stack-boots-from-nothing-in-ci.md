# EN-14-T1 — The ephemeral stack boots from nothing in CI, on the runner's own database

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-14-T1 |
| Test Scenario | The ephemeral stack boots from nothing in CI, on the runner's own database |
| Pre-conditions | A pull request is open, so CI's `e2e` job runs. No `.env` and no Supabase or Kafka credentials exist on the runner. |
| Test Steps | 1. Open the `e2e` job's log for the run.<br>2. Check the step "Refuse any database but the runner's own".<br>3. Check "Build the database from the migrations".<br>4. Check the "Browser tests" step's start, where Playwright starts each web server.<br>5. Open the `e2e-stack-logs` artifact. |
| Test Data | `DATABASE_URL=postgres://ci:ci@127.0.0.1:5432/connectsphere_e2e`, the job's `postgres:17` service container. |
| Expected Result | Step 2 accepts the runner's database. Step 3 applies every module's and service's migrations, with the identity seeds. Playwright starts the fake auth server, planning-core, notification, registration and the web app (`vite preview`), each answering its readiness URL, before any test runs. A `DATABASE_URL` naming any other host makes the step and the Playwright config refuse to start. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
