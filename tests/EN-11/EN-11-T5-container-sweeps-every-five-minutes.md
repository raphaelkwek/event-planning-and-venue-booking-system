# EN-11-T5 — The environment's container runs the completion and hold-expiry sweeps every five minutes

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-11-T5 |
| Test Scenario | The environment's container runs the completion and hold-expiry sweeps every five minutes |
| Pre-conditions | 1. A pull request that changes `deploy/`, so `deploy.yml` runs its "Space image" jobs (amd64 and arm64).<br>2. The job's throwaway Postgres, migrated by the container as it starts; never Supabase. |
| Test Steps | 1. Build the single-container image (`deploy/space`) as the VM and the Space run it.<br>2. Run it with `deploy/ci/space-smoke.sh`.<br>3. Read `supervisorctl status` and the container's log once the services are ready. |
| Test Data | The CI Postgres with every migration and no events or holds; settings as `space-smoke.sh` gives them. |
| Expected Result | 1. supervisord has a `sweeps` program, and it is RUNNING with every other program.<br>2. Its first run, at start, logs F1's "completion sweep finished" and L6's "hold expiry sweep finished", each with outcome success: so the sweep found its settings (`DATABASE_URL`, `SUPABASE_JWKS_URL`) without anyone passing them by hand.<br>3. The program is configured to wait 300 seconds between runs (`SWEEP_INTERVAL_SECONDS=300` in `deploy/space/sweeps.sh`, checked by `npm run test:scripts`); CI sees only the first run, not the wait. |
| Created By | Joash |
| Date of Creation | 2026-11-04 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: — |
| Executed By | |
| Date of Execution | |
