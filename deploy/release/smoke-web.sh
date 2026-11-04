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

code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 "$origin/events/smoke-check-client-route")"
[ "$code" = 200 ] || fail "a client-side route answered ${code}, not the app shell"
# Right after `vercel deploy` aliases the new build, an edge can still answer with the previous
# one, so an asset the new shell names can come back as the SPA fallback page. Read the shell and
# its entry script together, and try again for up to a minute before failing.
# The whole bundle is read before searching it: piped into grep -q, curl fails with (23) once grep
# stops reading at the first match, and pipefail turns that into a failure.
bundle_ok=""
for attempt in 1 2 3 4 5 6; do
  shell="$(curl -fsS --max-time 20 "$origin/")" || fail "${origin}/ did not answer"
  grep -q 'id="root"' <<< "$shell" || fail "${origin}/ is not the app shell"
  asset="$(grep -oE 'src="/assets/[^"]*\.js"' <<< "$shell" | head -1 | sed -E 's/^src="//; s/"$//')"
  [ -n "$asset" ] || fail "no entry script in the shell"
  bundle="$(curl -fsS --max-time 20 "$origin$asset")" || bundle=""
  if grep -qF "$api_host" <<< "$bundle"; then bundle_ok=1; break; fi
  echo "attempt ${attempt}: ${asset} does not name ${api_host} yet; retrying in 10 s"
  sleep 10
done
[ -n "$bundle_ok" ] || fail "the bundle does not call https://${api_host}"
headers="$(curl -fsSI --max-time 20 "$origin/")"
grep -qi '^x-content-type-options: nosniff' <<< "$headers" || fail "the security headers are missing"
say "| Web app | ${origin} | shell, SPA fallback, built for ${api_host}, security headers |"
echo "smoke-web: ok"
