# Timers survive a redeploy: the worker re-creates them, the container sweeps, Temporal keeps its state

**Timestamp:** 2026-11-04T15:39+08:00 (SGT)
**Author:** Joash
**Reason:** On 4 Nov an event on staging was Confirmed at 06:08Z with an end of 06:40Z, and its
CompleteEvent workflow started. At about 06:25Z a merge redeployed staging, and the VM's deploy gate
replaced the container. Temporal's SQLite file was in the container's `/tmp`, so the workflow and its
timer went with it. The event stayed Confirmed 30 minutes past its end, until the F1 completion
sweep was run by hand. L6's hold expiries and reminders were lost the same way, and every merge to
main redeploys staging.
**Scope:** planning-core's Temporal worker (`src/temporal/reconcileTimers.ts`, `worker.ts`), the
event module's `listAwaitingCompletion` (in its `index.ts`), `deploy/space` (Dockerfile, `start.sh`,
`supervisord.conf`, new `sweeps.sh`), the VM deploy gate and `deploy:vm`, `deploy/ci/space-smoke.sh`,
`deploy.yml`'s shellcheck list, the deploy runbook, ADR-0009, EN-11's cards and traceability. No
migration, no API change, and no change to the gate's arguments or to the settings it accepts.

## Fixed

- **The worker re-creates every timer when it starts.** Before its Kafka consumers start, it lists
  every Confirmed event with an end (the event module's new `listAwaitingCompletion`) and every Held
  hold (the venue module's `listHeldHolds`). It then signal-with-starts each CompleteEvent and
  HoldExpiry workflow through the consumers' own schedulers, so the workflow ids are theirs. A lost
  timer starts again, and one whose time passed while it was gone completes or expires the item at
  once. A completion timer that is still there is only told the end it already has; a hold already
  reminded asks the reminder step once more, and the venue rule answers `already`. The reconcile never throws:
  what it cannot list or schedule is logged by id, the rest carries on, and it logs
  `timers reconciled` with the counts.
- **Temporal's state is on a named volume on the VM.** The image owns
  `/var/lib/connectsphere/temporal` to uid 1000, the user supervisord runs Temporal as, and
  `start.sh` points `--db-filename` there. The deploy gate and `npm run deploy:vm` mount
  `connectsphere-staging-temporal` or `connectsphere-production-temporal` on it, and an empty volume
  takes the directory's owner from the image. Both now stop the old container before removing it,
  so Temporal closes its file, and the gate prints where `start.sh` put the state. If a mounted
  volume isn't writable, `start.sh` stops and the deploy fails; with no volume and no writable
  directory, it says so and falls back to `/tmp/cs`.

## Added

- **The container sweeps every five minutes.** A supervisord program, `sweeps`
  (`deploy/space/sweeps.sh`), runs F1's completion sweep and L6's hold-expiry sweep at start and every
  300 seconds. It runs the compiled jobs with `start.sh`'s settings, `SUPABASE_JWKS_URL` included,
  and each sweep logs its run as it already did. So an event or hold that no timer acted on is
  completed or expired within five minutes, on the VM and on a Space.
- **CI proves it.** `deploy.yml`'s "Space image" jobs (amd64 and arm64) run the image on a named
  volume as the gate does. They check the reconcile line, both sweeps' first runs, the sweeps
  program and the volume's owner. Then they replace the container and check that a probe workflow
  started before the replacement is still running after it. `npm run test:scripts` holds the gate,
  `deploy:vm`, `start.sh` and the Dockerfile to the same volume and directory. EN-11-T4 to T6 are the
  cards; the rows are in `documentation/traceability/sprint-4/EN-11.csv`.
- The deploy runbook has a "What survives a redeploy" section, and ADR-0009 a note.

## Known gap

- **Workflows in flight now outlive a deploy**, so a change to a workflow's commands needs
  `patched()`, or Temporal started empty; HoldExpiry still has no recorded replay histories. The
  runbook says how.

- **The deploy gate on the VM is installed by hand.** Until the new gate is installed, a release
  still replaces the container without the volume. The reconcile and the sweeps work either way.
- **A Hugging Face Space has no volume**, so there Temporal still starts empty after a restart. The
  reconcile and the sweeps cover it.
- **The k3s manifests have no sweep CronJob.** Temporal is already on a PersistentVolumeClaim
  there, and the worker's reconcile applies, but nothing runs the sweeps on a schedule.
- **Redpanda's data is still the container's.** A message published but not yet consumed when the
  container goes is not delivered: say, a notification.
