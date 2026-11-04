# EN-11-T6 — Temporal's workflows survive the replacement of the environment's container

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-11-T6 |
| Test Scenario | Temporal's workflows survive the replacement of the environment's container |
| Pre-conditions | 1. A pull request that changes `deploy/`, so `deploy.yml` runs its "Space image" jobs (amd64 and arm64).<br>2. The job's throwaway Postgres; never Supabase. |
| Test Steps | 1. Run `npm run test:scripts` and check that the VM's deploy gate and `npm run deploy:vm` mount the same named volume per environment (`connectsphere-<env>-temporal`) at the directory `start.sh` keeps Temporal's state in.<br>2. In `deploy/ci/space-smoke.sh`, start the image with that kind of named volume, as the gate does.<br>3. Check where `start.sh` put Temporal's SQLite file, and who owns the volume.<br>4. Start a probe workflow on a task queue no worker polls, so it stays Running.<br>5. Replace the container as the gate does: stop it, remove it, and start the image again with the same volume.<br>6. Describe the probe workflow in the new container. |
| Test Data | A volume created for the job and removed after it; the probe workflow id `ci-survives-redeploy`. |
| Expected Result | 1. Both deploy paths mount `connectsphere-staging-temporal` and `connectsphere-production-temporal` at `/var/lib/connectsphere/temporal`, the directory `start.sh` uses.<br>2. Temporal's file is `/var/lib/connectsphere/temporal/temporal.db`, and the volume is owned by the uid supervisord runs Temporal as (1000).<br>3. After the replacement, `start.sh` says it kept Temporal's state from the last container, and the probe workflow is still Running: timers scheduled before a redeploy are still there after it. |
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
