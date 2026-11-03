#!/usr/bin/env bash
# EN-21. One ZAP baseline scan, run from the ZAP image (ZAP_IMAGE) on the host network so that it
# can reach the services the job started on 127.0.0.1. Reports land in zap-out/.
#
#   ZAP_IMAGE=... .github/scripts/run-zap-baseline.sh <name> <url>
#
# The baseline is passive: it spiders the target for a minute and reports what the responses
# give away (headers, cookies, error pages, comments in scripts). It sends no attack traffic.
# .zap/rules.tsv sets what each rule does: IGNORE (with the reason beside it), WARN or FAIL.
# Exit code 1 from ZAP means a rule set to FAIL fired, and fails this step. Warnings do not
# (-I) while the findings are triaged in documentation/evidence/EN-21/zap.md.
set -uo pipefail

name="$1"
url="$2"
: "${ZAP_IMAGE:?set ZAP_IMAGE to the pinned ZAP image}"

mkdir -p zap-out
# The image runs as uid 1000 and writes its reports into this folder.
chmod 777 zap-out
cp .zap/rules.tsv zap-out/rules.tsv

docker run --rm --network host -v "${PWD}/zap-out:/zap/wrk:rw" "${ZAP_IMAGE}" \
  zap-baseline.py -t "${url}" -c rules.tsv -m 1 -I \
  -r "zap-${name}.html" -J "zap-${name}.json" -w "zap-${name}.md"
code=$?

echo "zap-baseline exit code for ${name}: ${code}"
case "${code}" in
  0|2) exit 0 ;;
  1) echo "::error::ZAP baseline (${name}): a rule that .zap/rules.tsv sets to FAIL fired"; exit 1 ;;
  *) echo "::error::ZAP baseline (${name}) did not complete (exit ${code})"; exit 1 ;;
esac
