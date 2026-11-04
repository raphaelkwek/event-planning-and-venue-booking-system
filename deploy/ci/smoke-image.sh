#!/usr/bin/env bash
# EN-10 smoke check for one built image: it must start under the same
# restrictions the Kubernetes manifests impose (non-root, read-only root
# filesystem, no capabilities, no privilege escalation) and answer its health
# endpoint. Runs on the CI runner only; the Postgres is the job's throwaway
# service container, never a shared database.
#
#   deploy/ci/smoke-image.sh <planning-core|registration|notification|web|migrate|cerbos> <image>
set -euo pipefail

name="$1"
image="$2"
db_url="postgres://ci:ci@127.0.0.1:5432/connectsphere_ci"

# Placeholders, not secrets: the .invalid domain cannot resolve. No KAFKA_* is
# set, which the services tolerate: they log that no consumer or relay started.
backend_env=(
  -e "DATABASE_URL=${db_url}"
  -e "SUPABASE_URL=https://ci.invalid"
  -e "SUPABASE_ANON_KEY=ci-placeholder"
  -e "SUPABASE_JWKS_URL=https://ci.invalid/auth/v1/.well-known/jwks.json"
)
# The restrictions deploy/k8s/base puts on every pod.
hardening=(--network host --read-only --tmpfs /tmp --cap-drop ALL --security-opt no-new-privileges)
cid=""

fail() { echo "::error::$*"; [ -n "$cid" ] && docker logs "$cid" 2>&1 | tail -40; exit 1; }
cleanup() { [ -n "$cid" ] && docker rm -f "$cid" >/dev/null 2>&1 || true; }
trap cleanup EXIT

wait_for() { # <url> <seconds>
  for _ in $(seq 1 "$2"); do
    if curl -fsS "$1" >/dev/null 2>&1; then return 0; fi
    sleep 1
  done
  return 1
}

check_user() {
  local uid
  if [ "$name" = cerbos ]; then
    # Distroless: no `id` in the image, so read the user it is built to run as.
    uid="$(docker image inspect "$image" --format '{{.Config.User}}')"
    uid="${uid%%:*}"
    [ -n "$uid" ] || fail "$name sets no USER, so it runs as root"
  else
    uid="$(docker run --rm --entrypoint id "$image" -u)"
  fi
  [ "$uid" != "0" ] || fail "$name runs as root"
  echo "ok: $name runs as uid $uid"
}

serve() { # <port> [extra docker args]
  local port="$1"; shift
  cid="$(docker run -d "${hardening[@]}" "$@" "$image")"
  wait_for "http://127.0.0.1:${port}/healthz" 40 || fail "$name: /healthz did not answer"
  echo "ok: $name /healthz -> $(curl -fsS "http://127.0.0.1:${port}/healthz")"
}

check_user

case "$name" in
  planning-core|registration|notification)
    case "$name" in planning-core) port=8090 ;; registration) port=8092 ;; notification) port=8091 ;; esac
    extra=("${backend_env[@]}")
    [ "$name" = notification ] && extra+=(-e "PLANNING_CORE_URL=http://127.0.0.1:8090")
    serve "$port" "${extra[@]}"
    ready="$(curl -fsS "http://127.0.0.1:${port}/readyz")"
    echo "ok: $name /readyz -> $ready"
    echo "$ready" | grep -q '"database":"ok"' || fail "$name: /readyz does not report the database as ok"
    echo "$ready" | grep -q '"kafka":"not_configured"' || fail "$name: expected kafka not_configured with no KAFKA_* set"
    if [ "$name" = planning-core ]; then
    # The same image runs the Temporal worker. With no TEMPORAL_ADDRESS the worker
    # says so and exits 0 (worker.ts), which proves the entrypoint resolves.
    out="$(docker run --rm "${hardening[@]}" "${backend_env[@]}" --entrypoint node "$image" dist/temporal/worker.js)"
    echo "$out" | grep -q "Temporal worker not started" || fail "worker did not start cleanly: $out"
    echo "ok: worker entrypoint -> $out"
    # The part the line above does not reach: with TEMPORAL_* set the worker bundles
    # its workflows from dist/ at start-up. Do that bundling here, from the image.
    docker run --rm "${hardening[@]}" "${backend_env[@]}" --entrypoint node "$image" \
      -e "import('./dist/temporal/workflowBundle.js').then(m=>m.bundleCompletionWorkflows()).then(()=>console.log('workflow bundle ok'))" \
      | tee /dev/stderr | grep -q "workflow bundle ok" || fail "worker could not bundle its workflows"
    fi
    ;;
  web)
    serve 8080
    body="$(curl -fsS http://127.0.0.1:8080/)"
    echo "$body" | grep -q 'id="root"' || fail "web: / does not serve the app shell"
    # A client-side route must fall back to index.html with a 200.
    code="$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8080/events/some-client-side-route)"
    [ "$code" = 200 ] || fail "web: SPA fallback returned $code"
    asset="$(echo "$body" | grep -o '/assets/[^"]*\.js' | head -1)"
    [ -n "$asset" ] || fail "web: no script asset in index.html"
    curl -fsS -o /dev/null -D - "http://127.0.0.1:8080${asset}" | grep -qi 'cache-control: public, immutable' || fail "web: assets are not cached as immutable"
    curl -fsSI http://127.0.0.1:8080/ | grep -qi 'x-content-type-options: nosniff' || fail "web: security headers missing"
    echo "ok: web serves the shell, the SPA fallback and immutable assets"
    ;;
  migrate)
    # Applies every module's migrations to the empty throwaway database, then again:
    # the second run must apply nothing.
    docker run --rm "${hardening[@]}" -e "DATABASE_URL=${db_url}" -e npm_config_cache=/tmp/.npm "$image" > migrate-1.log
    grep -q '^apply identity/' migrate-1.log || fail "migrate: nothing was applied on the first run"
    docker run --rm "${hardening[@]}" -e "DATABASE_URL=${db_url}" -e npm_config_cache=/tmp/.npm "$image" > migrate-2.log
    if grep -q '^apply ' migrate-2.log; then fail "migrate: the second run applied migrations again"; fi
    echo "ok: migrate applied $(grep -c '^apply ' migrate-1.log) files, then none"
    ;;
  cerbos)
    # ADR-0016: the PDP starts read-only and non-root, and answers with the repository's
    # policies loaded: Venue Staff may create a venue, an attendee may not (policies/resources/venue.yaml).
    cid="$(docker run -d "${hardening[@]}" --tmpfs /.cache "$image")"
    wait_for "http://127.0.0.1:3592/_cerbos/health" 40 || fail "cerbos: /_cerbos/health did not answer"
    echo "ok: cerbos /_cerbos/health -> $(curl -fsS http://127.0.0.1:3592/_cerbos/health)"
    decide() { # <role> -> the effect for create on a venue
      curl -fsS -X POST http://127.0.0.1:3592/api/check/resources -H 'Content-Type: application/json' \
        -d "{\"requestId\":\"smoke\",\"principal\":{\"id\":\"smoke-user\",\"roles\":[\"$1\"]},\"resources\":[{\"actions\":[\"create\"],\"resource\":{\"kind\":\"venue\",\"id\":\"smoke-venue\"}}]}" \
        | jq -r '.results[0].actions.create'
    }
    [ "$(decide VENUE_STAFF)" = EFFECT_ALLOW ] || fail "cerbos: Venue Staff may not create a venue, so the policies are not loaded"
    [ "$(decide ATTENDEE)" = EFFECT_DENY ] || fail "cerbos: an attendee may create a venue"
    echo "ok: cerbos serves the repository's policies (VENUE_STAFF allowed, ATTENDEE denied)"
    ;;
  *) fail "unknown image $name" ;;
esac

size="$(docker image inspect "$image" --format '{{.Size}}')"
echo "image size: $((size / 1024 / 1024)) MiB"
echo "| $name | $((size / 1024 / 1024)) MiB | passed |" >> "${GITHUB_STEP_SUMMARY:-/dev/null}"
