#!/usr/bin/env bash
# ADR-0016. Smoke test of one environment's web app on Vercel: the shell loads, a client-side
# route falls back to it, and the bundle was built for this environment's API host.
#
#   deploy/release/smoke-web.sh https://connectsphere-staging.vercel.app api.staging.203.0.113.7.sslip.io
set -euo pipefail
origin="${1:?the web origin}"
api_host="${2:?the API host the bundle must call}"

say() { echo "$*"; echo "$*" >> "${GITHUB_STEP_SUMMARY:-/dev/null}"; }
fail() { echo "::error::$*"; exit 1; }

shell="$(curl -fsS --max-time 20 "$origin/")" || fail "${origin}/ did not answer"
grep -q 'id="root"' <<< "$shell" || fail "${origin}/ is not the app shell"
code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 "$origin/events/smoke-check-client-route")"
[ "$code" = 200 ] || fail "a client-side route answered ${code}, not the app shell"
asset="$(grep -o '/assets/[^"]*\.js' <<< "$shell" | head -1)"
[ -n "$asset" ] || fail "no script asset in the shell"
curl -fsS --max-time 20 "$origin$asset" | grep -qF "$api_host" || fail "the bundle does not call https://${api_host}"
headers="$(curl -fsSI --max-time 20 "$origin/")"
grep -qi '^x-content-type-options: nosniff' <<< "$headers" || fail "the security headers are missing"
say "| Web app | ${origin} | shell, SPA fallback, built for ${api_host}, security headers |"
echo "smoke-web: ok"
