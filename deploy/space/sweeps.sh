#!/usr/bin/env bash
# EN-11's safety net, a supervisord program of the environment's container (supervisord.conf).
#
# Temporal's timers complete each Confirmed event at its end (F1) and expire each hold at its
# expiry (L6). A timer can still be missed: the worker was down, Temporal lost its state (a Space
# has no volume), or a signal arrived late. So this runs the two sweeps that need no Temporal at
# all, at start and then every SWEEP_INTERVAL_SECONDS:
#   - F1's completion sweep: every Confirmed event whose end has passed becomes Completed;
#   - L6's hold-expiry sweep: every Held hold whose expiry has passed becomes Expired.
# Both are idempotent and go through the workflows' own guarded steps, so when a timer and a sweep
# reach the same event or hold, only one of them changes it. Each logs its run as JSON (a line per item and a summary, with outcome
# success or error) and exits non-zero if anything failed; this script adds a line only for that
# exit, and carries on to the next run.
#
# They inherit start.sh's settings through supervisord, SUPABASE_JWKS_URL (derived from
# SUPABASE_URL) included; a `docker exec` does not, so a sweep run by hand needs it given.
set -uo pipefail

SWEEP_INTERVAL_SECONDS=300
cd /app/backend/services/planning-core

while true; do
  for job in dist/modules/event/jobs/runCompleteEvents.js dist/modules/venue/jobs/runExpireHolds.js; do
    node "$job"
    status=$?
    [ "$status" -eq 0 ] || echo "sweeps.sh: ${job} exited ${status}; its log above says why. The next run is in ${SWEEP_INTERVAL_SECONDS}s"
  done
  sleep "$SWEEP_INTERVAL_SECONDS"
done
