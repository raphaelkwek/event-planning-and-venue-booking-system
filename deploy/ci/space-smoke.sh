#!/usr/bin/env bash
# ADR-0016 amendment: run the Hugging Face Space image the way a Space runs it (one container, as
# uid 1000, one public port, settings from the environment) against the job's throwaway Postgres,
# never Supabase, and check everything inside it works:
#   - DATABASE_URL points at a port nothing listens on, as Supabase's 6543 may be blocked on a Space,
#     so start.sh must fall back to MIGRATE_DATABASE_URL (the session pooler's role);
#   - the migrations ran before the services; every supervisord program is RUNNING;
#   - each service is ready with the database ok and Kafka reachable (Redpanda, SCRAM over TLS);
#   - the worker connected to the Temporal dev server and re-created the timers (EN-11-T4); Cerbos
#     serves; the completion and hold-expiry sweeps ran (EN-11-T5);
#   - through Caddy on 7860 only the public API prefixes are routed, plus a static /healthz, and CORS
#     allows only the configured origin (deploy/release/smoke-api.sh).
# Then, as the Azure VM's deploy gate runs it (EN-11-T6): with Temporal's state on a named volume,
# owned by the uid that runs supervisord, a workflow started before the container is replaced is
# still running after it.
set -euo pipefail
cd "$(dirname "$0")/../.."
IMAGE="${IMAGE:-connectsphere-space:ci}"
ORIGIN=https://web.space.ci.invalid
EVIDENCE_FILE="${EVIDENCE_FILE:-space-evidence.md}"
# The gate's volume and directory (deploy/azure/connectsphere-vm-deploy), under a name for this job.
VOLUME=connectsphere-ci-temporal
TEMPORAL_STATE_DIR=/var/lib/connectsphere/temporal
PROBE=ci-survives-redeploy
: > "$EVIDENCE_FILE"
note() { echo "$*" >> "$EVIDENCE_FILE"; echo "$*" >> "${GITHUB_STEP_SUMMARY:-/dev/null}"; }
fail() { echo "::error::$*"; docker logs space 2>&1 | tail -80; exit 1; }
trap 'docker rm -f space > /dev/null 2>&1 || true; docker volume rm -f "$VOLUME" > /dev/null 2>&1 || true' EXIT

# Without a volume (a Space), the image's own directory must be writable by the image's user.
docker run --rm --entrypoint test "$IMAGE" -w "$TEMPORAL_STATE_DIR" || fail "the image's ${TEMPORAL_STATE_DIR} is not writable by its user"
# A volume uid 1000 cannot write (root's, and not empty, so Docker leaves it alone): start.sh must
# stop rather than quietly keep Temporal's state in the container, where the next redeploy loses it.
docker volume rm -f "${VOLUME}-unwritable" > /dev/null 2>&1 || true
docker run --rm --user 0 -v "${VOLUME}-unwritable:/v" --entrypoint sh "$IMAGE" -c 'touch /v/kept-by-root && chown 0:0 /v && chmod 755 /v'
refused=0
refusal="$(docker run --rm -v "${VOLUME}-unwritable:${TEMPORAL_STATE_DIR}" \
  -e DATABASE_URL=postgres://ci.invalid/x -e MIGRATE_DATABASE_URL=postgres://ci.invalid/x -e SUPABASE_URL=https://ci.invalid \
  -e SUPABASE_ANON_KEY=ci-placeholder -e CORS_ALLOWED_ORIGINS="$ORIGIN" "$IMAGE" 2>&1)" || refused=$?
docker volume rm -f "${VOLUME}-unwritable" > /dev/null 2>&1 || true
if [ "$refused" -eq 0 ] || ! grep -q "is a mounted volume that uid 1000 cannot write" <<< "$refusal"; then
  fail "start.sh did not refuse a volume it cannot write (exit ${refused}): $(tail -5 <<< "$refusal")"
fi
# An empty volume owned by root, as one the new gate made while it still ran the previous image
# (which has no such directory) is: the image's directory must give it uid 1000 on first mount.
docker volume rm -f "$VOLUME" > /dev/null 2>&1 || true
docker volume create "$VOLUME" > /dev/null

db=postgres://ci:ci@127.0.0.1:5432/connectsphere_ci
start_space() {
  docker run -d --name space --network host \
    -e DATABASE_URL=postgres://ci:ci@127.0.0.1:6543/connectsphere_ci \
    -e MIGRATE_DATABASE_URL="$db" \
    -e SUPABASE_URL=https://ci.invalid -e SUPABASE_ANON_KEY=ci-placeholder -e SUPABASE_SERVICE_ROLE_KEY=ci-placeholder \
    -e CORS_ALLOWED_ORIGINS="$ORIGIN" \
    -v "${VOLUME}:${TEMPORAL_STATE_DIR}" \
    "$IMAGE" > /dev/null
}
start_space
[ "$(docker exec space id -u)" = 1000 ] || fail "the Space image does not run as uid 1000"

wait_for() { # <description> <seconds> <command...>
  local what="$1" seconds="$2"
  shift 2
  for _ in $(seq 1 "$seconds"); do
    if "$@" > /dev/null 2>&1; then return 0; fi
    sleep 1
  done
  fail "$what did not happen within ${seconds}s"
}
logged() { # <text>: the container's log has it (read once: `docker logs | grep -q` fails under pipefail on SIGPIPE)
  local log
  log="$(docker logs space 2>&1)"
  grep -qF "$1" <<< "$log"
}
temporal_cli() { docker exec -e TEMPORAL_ADDRESS=127.0.0.1:7233 -e TEMPORAL_NAMESPACE=default space temporal "$@"; }

wait_for "Caddy answering /healthz on 7860" 240 curl -fsS http://127.0.0.1:7860/healthz
wait_for "planning-core answering through Caddy" 180 sh -c 'curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:7860/identity/api/v1/users/me | grep -qx 401'

startup="$(docker logs space 2>&1)"
grep -q "the services use MIGRATE_DATABASE_URL" <<< "$startup" || fail "start.sh did not fall back to the session pooler URL"
applied="$(sed -n 's/^start.sh: migrations applied: \([0-9]*\) files$/\1/p' <<< "$startup" | head -1)"
[ "${applied:-0}" -gt 0 ] || fail "the migrations did not run before the services"
grep -qF "start.sh: Temporal's state: ${TEMPORAL_STATE_DIR}/temporal.db, new" <<< "$startup" || fail "start.sh did not put Temporal's state on the volume"

ready() { # <port>
  docker exec space curl -fsS "http://127.0.0.1:$1/readyz" | grep -q '"database":"ok","kafka":"reachable"'
}
for port in 8090 8091 8092; do wait_for "the service on $port ready with Kafka reachable" 180 ready "$port"; done
wait_for "Cerbos serving" 60 sh -c 'docker exec space curl -fsS http://127.0.0.1:3592/_cerbos/health | grep -q SERVING'
wait_for "the worker connected to Temporal" 240 logged "Temporal worker started"
wait_for "the worker re-creating the timers" 60 logged '"message":"timers reconciled"'
wait_for "the completion sweep's first run" 120 logged '"message":"completion sweep finished"'
wait_for "the hold-expiry sweep's first run" 120 logged '"message":"hold expiry sweep finished"'
sweeps="$(docker logs space 2>&1 | grep -E '"message":"(completion|hold expiry) sweep finished"' || true)"
if grep -q '"outcome":"error"' <<< "$sweeps"; then fail "a sweep reported an error: $sweeps"; fi
sleep 5
status="$(docker exec space supervisorctl -c /app/deploy/space/supervisord.conf status)"
echo "$status"
if echo "$status" | grep -v RUNNING | grep -q .; then fail "a supervisord program is not RUNNING"; fi
grep -q '^sweeps .*RUNNING' <<< "$status" || fail "supervisord has no running sweeps program"

# Temporal's state is on the volume, and the volume belongs to the user supervisord runs Temporal as.
owner="$(docker exec space stat -c %u "$TEMPORAL_STATE_DIR")"
[ "$owner" = "$(docker exec space id -u)" ] || fail "${TEMPORAL_STATE_DIR} is owned by uid ${owner}, not by the uid that runs Temporal"
docker exec space test -s "${TEMPORAL_STATE_DIR}/temporal.db" || fail "Temporal's file is not on the volume"

SMOKE_PUBLIC_HEALTHZ=1 bash deploy/release/smoke-api.sh http://127.0.0.1:7860 "$ORIGIN" | tee smoke.out

# A redeploy, as the gate does it: a workflow on a task queue no worker polls stays Running, so if it
# is still there in the next container, Temporal's timers are too.
temporal_cli workflow start --type ciProbe --task-queue ci-redeploy-probe --workflow-id "$PROBE" > /dev/null \
  || fail "the probe workflow could not be started"
docker stop -t 30 space > /dev/null
docker rm -f space > /dev/null
start_space
wait_for "Caddy answering /healthz on 7860 after the redeploy" 240 curl -fsS http://127.0.0.1:7860/healthz
wait_for "the worker connected to Temporal after the redeploy" 240 logged "Temporal worker started"
logged "start.sh: Temporal's state: ${TEMPORAL_STATE_DIR}/temporal.db, kept from the last container" \
  || fail "start.sh did not find Temporal's state from the last container"
probe="$(temporal_cli workflow describe --workflow-id "$PROBE" --output json 2>&1)" || fail "the probe workflow is gone after the redeploy: $probe"
grep -Eiq '"status": *"(WORKFLOW_EXECUTION_STATUS_)?RUNNING"' <<< "$probe" || fail "the probe workflow is not running after the redeploy: $probe"
echo "the probe workflow ${PROBE} survived the container's replacement"

note "## ADR-0016 amendment: the Hugging Face Space image, run as a Space runs it"
note ""
note "| Check | Result |"
note "|---|---|"
note "| User | uid 1000 |"
note "| DATABASE_URL unreachable (as 6543 may be on a Space) | start.sh fell back to MIGRATE_DATABASE_URL |"
note "| Migrations before the services | ${applied} files |"
note "| planning-core, notification, registration /readyz | database ok, kafka reachable (Redpanda, SCRAM over TLS, in the container) |"
note "| Temporal worker | logged 'Temporal worker started' and 'timers reconciled' (EN-11-T4) |"
note "| Sweeps (EN-11-T5) | 'completion sweep finished' and 'hold expiry sweep finished' at start, outcome success; the sweeps program RUNNING |"
note "| Temporal's state (EN-11-T6) | ${TEMPORAL_STATE_DIR}/temporal.db on a named volume owned by uid ${owner}; the image's own directory writable without one |"
note "| Redeploy (EN-11-T6) | container stopped, removed and started again on the same volume: start.sh kept the state, workflow ${PROBE} still RUNNING |"
note "| Cerbos | SERVING |"
note "| supervisord | $(echo "$status" | awk '{print $1}' | paste -sd, -) all RUNNING |"
note ""
grep -E '^\|' smoke.out | while read -r line; do note "$line"; done
echo "space image: ok"
