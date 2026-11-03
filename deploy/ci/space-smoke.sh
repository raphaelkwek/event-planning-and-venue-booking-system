#!/usr/bin/env bash
# ADR-0016 amendment: run the Hugging Face Space image the way a Space runs it (one container, as
# uid 1000, one public port, settings from the environment) against the job's throwaway Postgres,
# never Supabase, and check everything inside it works:
#   - DATABASE_URL points at a port nothing listens on, as Supabase's 6543 may be blocked on a Space,
#     so start.sh must fall back to MIGRATE_DATABASE_URL (the session pooler's role);
#   - the migrations ran before the services; every supervisord program is RUNNING;
#   - each service is ready with the database ok and Kafka reachable (Redpanda, SCRAM over TLS);
#   - the worker connected to the Temporal dev server; Cerbos serves;
#   - through Caddy on 7860 only the public API prefixes are routed, plus a static /healthz, and CORS
#     allows only the configured origin (deploy/release/smoke-api.sh).
set -euo pipefail
cd "$(dirname "$0")/../.."
IMAGE="${IMAGE:-connectsphere-space:ci}"
ORIGIN=https://web.space.ci.invalid
EVIDENCE_FILE="${EVIDENCE_FILE:-space-evidence.md}"
: > "$EVIDENCE_FILE"
note() { echo "$*" >> "$EVIDENCE_FILE"; echo "$*" >> "${GITHUB_STEP_SUMMARY:-/dev/null}"; }
fail() { echo "::error::$*"; docker logs space 2>&1 | tail -80; exit 1; }
trap 'docker rm -f space > /dev/null 2>&1 || true' EXIT

db=postgres://ci:ci@127.0.0.1:5432/connectsphere_ci
docker run -d --name space --network host \
  -e DATABASE_URL=postgres://ci:ci@127.0.0.1:6543/connectsphere_ci \
  -e MIGRATE_DATABASE_URL="$db" \
  -e SUPABASE_URL=https://ci.invalid -e SUPABASE_ANON_KEY=ci-placeholder -e SUPABASE_SERVICE_ROLE_KEY=ci-placeholder \
  -e CORS_ALLOWED_ORIGINS="$ORIGIN" \
  "$IMAGE" > /dev/null
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
wait_for "Caddy answering /healthz on 7860" 240 curl -fsS http://127.0.0.1:7860/healthz
wait_for "planning-core answering through Caddy" 180 sh -c 'curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:7860/identity/api/v1/users/me | grep -qx 401'

docker logs space 2>&1 | grep -q "the services use MIGRATE_DATABASE_URL" || fail "start.sh did not fall back to the session pooler URL"
applied="$(docker logs space 2>&1 | sed -n 's/^start.sh: migrations applied: \([0-9]*\) files$/\1/p' | head -1)"
[ "${applied:-0}" -gt 0 ] || fail "the migrations did not run before the services"

ready() { # <port>
  docker exec space curl -fsS "http://127.0.0.1:$1/readyz" | grep -q '"database":"ok","kafka":"reachable"'
}
for port in 8090 8091 8092; do wait_for "the service on $port ready with Kafka reachable" 180 ready "$port"; done
wait_for "Cerbos serving" 60 sh -c 'docker exec space curl -fsS http://127.0.0.1:3592/_cerbos/health | grep -q SERVING'
wait_for "the worker connected to Temporal" 240 sh -c 'docker logs space 2>&1 | grep -q "Temporal worker started"'
sleep 5
status="$(docker exec space supervisorctl -c /app/deploy/space/supervisord.conf status)"
echo "$status"
if echo "$status" | grep -v RUNNING | grep -q .; then fail "a supervisord program is not RUNNING"; fi

SMOKE_PUBLIC_HEALTHZ=1 bash deploy/release/smoke-api.sh http://127.0.0.1:7860 "$ORIGIN" | tee smoke.out

note "## ADR-0016 amendment: the Hugging Face Space image, run as a Space runs it"
note ""
note "| Check | Result |"
note "|---|---|"
note "| User | uid 1000 |"
note "| DATABASE_URL unreachable (as 6543 may be on a Space) | start.sh fell back to MIGRATE_DATABASE_URL |"
note "| Migrations before the services | ${applied} files |"
note "| planning-core, notification, registration /readyz | database ok, kafka reachable (Redpanda, SCRAM over TLS, in the container) |"
note "| Temporal worker | logged 'Temporal worker started' |"
note "| Cerbos | SERVING |"
note "| supervisord | $(echo "$status" | awk '{print $1}' | paste -sd, -) all RUNNING |"
note ""
grep -E '^\|' smoke.out | while read -r line; do note "$line"; done
echo "space image: ok"
