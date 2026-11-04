# EN-11-T6 — Temporal's workflows survive the replacement of the environment's container

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-11-T6 |
| Test Scenario | Temporal's workflows survive the replacement of the environment's container |
| Pre-conditions | 1. A pull request that changes `deploy/`, so `deploy.yml` runs its "Space image" jobs (amd64 and arm64).<br>2. The job's throwaway Postgres; never Supabase. |
| Test Steps | 1. Run `npm run test:scripts` and check that the VM's deploy gate and `npm run deploy:vm` mount the same named volume per environment (`connectsphere-<env>-temporal`) at the directory `start.sh` keeps Temporal's state in.<br>2. In `deploy/ci/space-smoke.sh`, start the image on a volume uid 1000 cannot write, then on a new empty volume owned by root (as one the gate made while it ran the previous image is), as the gate does.<br>3. Check where `start.sh` put Temporal's SQLite file, and who owns the volume.<br>4. Start a probe workflow on a task queue no worker polls, so it stays Running.<br>5. Replace the container as the gate does: stop it, remove it, and start the image again with the same volume.<br>6. Describe the probe workflow in the new container. |
| Test Data | A volume created for the job and removed after it; the probe workflow id `ci-survives-redeploy`. |
| Expected Result | 1. Both deploy paths mount `connectsphere-staging-temporal` and `connectsphere-production-temporal` at `/var/lib/connectsphere/temporal`, the directory `start.sh` uses.<br>2. On the unwritable volume, `start.sh` stops and says so, rather than keep Temporal's state in the container. On the empty one, Temporal's file is `/var/lib/connectsphere/temporal/temporal.db`, and the volume is owned by the uid supervisord runs Temporal as (1000).<br>3. After the replacement, `start.sh` says it kept Temporal's state from the last container, and the probe workflow is still Running: timers scheduled before a redeploy are still there after it. |
| Created By | Joash |
| Date of Creation | 2026-11-04 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | `npm run test:scripts` checked that the gate and `deploy:vm` mount connectsphere-staging-temporal and connectsphere-production-temporal at /var/lib/connectsphere/temporal, the directory start.sh and the Dockerfile use, and stop the container before removing it. In deploy.yml's "Space image" jobs (amd64 and arm64), start.sh refused a volume uid 1000 could not write and exited non-zero; on an empty root-owned volume it put temporal.db on the volume, owned by uid 1000, the container's uid; after a stop, remove and start on the same volume, start.sh logged the state kept from the last container, and the probe workflow ci-survives-redeploy was still RUNNING. |
| Status | Pass |
| Remarks | Automated (container smoke test, CI) · Commit: 18b357b5 · Evidence: deploy/ci/space-smoke.sh in deploy.yml › Space image, amd64 and arm64, CI run https://github.com/joass1/event-planning-and-venue-booking-system/actions/runs/41794961643; deploy/azure/deploy-vm.test.mjs › EN-11-T6 (3 tests), CI run https://github.com/joass1/event-planning-and-venue-booking-system/actions/runs/41794961654 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
