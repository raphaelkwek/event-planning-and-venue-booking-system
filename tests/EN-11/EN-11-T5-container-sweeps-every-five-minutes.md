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
| Actual Result | deploy.yml's "Space image" jobs (amd64 and arm64) built and ran the image with `deploy/ci/space-smoke.sh`: supervisorctl showed `sweeps` RUNNING with every other program, and the container's log had "completion sweep finished" and "hold expiry sweep finished" from the first run, neither with outcome error. `npm run test:scripts` (CI's unit job) checked the program runs `sweeps.sh` with stopasgroup and killasgroup, and `sweeps.sh` runs both compiled jobs and waits SWEEP_INTERVAL_SECONDS=300. The wait itself was not observed. |
| Status | Pass |
| Remarks | Automated (container smoke test, CI) · Commit: 18b357b5 · Evidence: deploy/ci/space-smoke.sh in deploy.yml › Space image, amd64 and arm64, CI run https://github.com/joass1/event-planning-and-venue-booking-system/actions/runs/41794961643; deploy/space/deploy-space.test.mjs › EN-11-T5 supervisord runs the F1 completion sweep and the L6 hold-expiry sweep, and every five minutes, CI run https://github.com/joass1/event-planning-and-venue-booking-system/actions/runs/41794961654 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
