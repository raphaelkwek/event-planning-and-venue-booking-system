#!/usr/bin/env bash
# ADR-0016. Smoke test of one environment's public API, from outside the cluster, through
# Traefik and TLS. The Release workflow runs it against the real host after each deploy; the
# kind job runs it against a port-forward with CURL_EXTRA="--resolve ... --insecure".
#
#   deploy/release/smoke-api.sh https://api.staging.203.0.113.7.sslip.io https://connectsphere-staging.vercel.app
#
# Checks: an API route reaches its service with the prefix stripped (planning-core and
# notification answer 401 with the error envelope, registration answers itself); nothing but
# /<prefix>/api/v1 is routed (health, readiness and metrics are 404 at Traefik); CORS allows
# the environment's own web origin and no other.
set -euo pipefail
base="${1:?the API base URL, e.g. https://api.staging.example.org}"
origin="${2:?the web origin CORS must allow}"
# shellcheck disable=SC2206 # CURL_EXTRA is a list of curl arguments, split on purpose.
extra=(${CURL_EXTRA:-})
foreign="https://not-connectsphere.invalid"
failures=0

say() { echo "$*"; echo "$*" >> "${GITHUB_STEP_SUMMARY:-/dev/null}"; }
bad() { echo "::error::$*"; failures=$((failures + 1)); }

# Prints "<status> <body>" for a GET.
get() {
  curl -sS "${extra[@]}" --max-time 15 -o /tmp/smoke-body -w '%{http_code}' "$base$1" || echo 000
  printf ' %s' "$(head -c 300 /tmp/smoke-body 2> /dev/null | tr -d '\r\n')"
}

say "| Request | Status | Expected |"
say "|---|---|---|"
for path in /identity/api/v1/users/me /notification/api/v1/notifications; do
  read -r status body <<< "$(get "$path")"
  if [ "$status" = 401 ] && grep -q '"error"' <<< "$body" && grep -q '"code"' <<< "$body"; then
    say "| \`GET ${path}\` (no token) | ${status} | 401 with the error envelope |"
  else
    bad "GET ${path}: expected 401 with the error envelope, got ${status} ${body}"
  fi
done
read -r status body <<< "$(get /registration/api/v1/smoke-check-does-not-exist)"
if [ "$status" != 000 ] && [ "$body" != "404 page not found" ]; then
  say "| \`GET /registration/api/v1/...\` | ${status} | answered by registration, not Traefik |"
else
  bad "GET /registration/api/v1/...: Traefik did not route it to registration (${status} ${body})"
fi
for path in /healthz /readyz /metrics /identity/healthz /identity/readyz /registration/healthz /notification/metrics; do
  read -r status body <<< "$(get "$path")"
  if [ "$status" = 404 ] && [ "$body" = "404 page not found" ]; then
    say "| \`GET ${path}\` | 404 | not routed |"
  else
    bad "GET ${path}: expected Traefik's 404, got ${status} ${body}"
  fi
done

# Prints the Access-Control-Allow-Origin a preflight from <origin> gets, or nothing.
preflight() {
  curl -sS "${extra[@]}" --max-time 15 -o /dev/null -D - -X OPTIONS "$base/identity/api/v1/users/me" \
    -H "Origin: $1" -H "Access-Control-Request-Method: GET" -H "Access-Control-Request-Headers: authorization" \
    | tr -d '\r' | awk -F': ' 'tolower($1) == "access-control-allow-origin" { print $2 }'
}
allowed="$(preflight "$origin")"
if [ "$allowed" = "$origin" ]; then
  say "| \`OPTIONS\` from ${origin} | allowed | its own origin |"
else
  bad "CORS: the preflight from ${origin} got Access-Control-Allow-Origin '${allowed}'"
fi
allowed="$(preflight "$foreign")"
if [ -z "$allowed" ]; then
  say "| \`OPTIONS\` from ${foreign} | no CORS header | any other origin |"
else
  bad "CORS: a foreign origin was allowed ('${allowed}')"
fi

if [ "$failures" -gt 0 ]; then
  echo "smoke-api: ${failures} check(s) failed"
  exit 1
fi
echo "smoke-api: ok"
