#!/usr/bin/env bash
# EN-16, the demonstration: a canary that is judged by Prometheus, promoted when good and
# rolled back automatically when bad, in a kind cluster.
#
# What runs: Argo Rollouts, a minimal Prometheus scraping the pods, the REAL
# AnalysisTemplate (deploy/k8s/analysis/error-rate-and-p95.yaml, with shorter timers),
# a Rollout with the same 10% / 50% / 100% steps as the overlays, and a load generator.
# The workload is a stand-in service (deploy/k8s/test/canary-demo/app) that exposes the
# metric names the template queries, not planning-core: EN-17's /metrics has not landed.
#
#   1. version 1 (good) is deployed.
#   2. version 2 (good) is rolled out: both analyses pass and it is promoted to 100%.
#   3. version 3 (bad: it answers 500 but passes its health check) is rolled out: the
#      error-rate analysis fails, the Rollout aborts, and version 2 keeps serving.
set -euo pipefail
cd "$(dirname "$0")/../.."
# shellcheck source=deploy/ci/lib.sh
source deploy/ci/lib.sh
trap 'status=$?; if [ $status -ne 0 ]; then dump_diagnostics; fi; exit $status' EXIT
EVIDENCE_FILE="${EVIDENCE_FILE:-canary-demo-evidence.md}"
: > "$EVIDENCE_FILE"
NS=canary-demo

phase() { kubectl -n "$NS" get rollout demo-app -o jsonpath='{.status.phase}'; }
stable_hash() { kubectl -n "$NS" get rollout demo-app -o jsonpath='{.status.stableRS}'; }
current_hash() { kubectl -n "$NS" get rollout demo-app -o jsonpath='{.status.currentPodHash}'; }
pod_hashes() { kubectl -n "$NS" get pods -l app=demo-app -o jsonpath='{range .items[*]}{.metadata.labels.rollouts-pod-template-hash}{"\n"}{end}' | sort -u | paste -sd, -; }

# Waits for the Rollout to reach a phase, logging each change of step on the way.
wait_for_phase() { # <phase> <timeout seconds>
  local want="$1" timeout="$2" start now p last=""
  start=$(date +%s)
  while true; do
    p="$(phase)"
    step="$(kubectl -n "$NS" get rollout demo-app -o jsonpath='{.status.currentStepIndex}' 2>/dev/null || true)"
    weight="$(kubectl -n "$NS" get rollout demo-app -o jsonpath='{.status.canary.weights.canary.weight}' 2>/dev/null || true)"
    line="phase=${p} step=${step:-?} canaryWeight=${weight:-?} pods=[$(pod_hashes)] analysisruns=[$(kubectl -n "$NS" get analysisrun -o jsonpath='{range .items[*]}{.status.phase}{" "}{end}' 2>/dev/null)]"
    if [ "$line" != "$last" ]; then echo "$(date +%T) $line"; last="$line"; fi
    if [ "$p" = "$want" ]; then return 0; fi
    now=$(date +%s)
    if [ $((now - start)) -gt "$timeout" ]; then echo "::error::timed out waiting for phase ${want} (now ${p})"; return 1; fi
    sleep 3
  done
}

set_version() { # <version> <mode>
  kubectl -n "$NS" patch rollout demo-app --type json -p "[
    {\"op\":\"replace\",\"path\":\"/spec/template/spec/containers/0/env/0/value\",\"value\":\"$1\"},
    {\"op\":\"replace\",\"path\":\"/spec/template/spec/containers/0/env/1/value\",\"value\":\"$2\"}]"
}

# Prints the status codes and bodies of 20 requests through the Service.
probe_service() {
  local local_port=18080 pid i out=""
  kubectl -n "$NS" port-forward svc/demo-app "${local_port}:80" >/dev/null 2>&1 &
  pid=$!
  sleep 3
  for i in $(seq 1 20); do
    out+="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${local_port}/") "
  done
  kill "$pid" 2>/dev/null || true
  echo "$out"
}

install_argo_rollouts

log "Prometheus (minimal, scraping the demo pods) and the demo workload"
kubectl apply -f deploy/k8s/test/canary-demo/prometheus.yaml
kubectl -n monitoring rollout status deploy/prometheus --timeout=240s
kubectl apply -k deploy/k8s/test/canary-demo
kubectl -n "$NS" wait --for=jsonpath='{.status.phase}'=Healthy rollout/demo-app --timeout=240s
kubectl -n "$NS" rollout status deploy/loadgen --timeout=120s
echo "version 1 is stable: $(stable_hash)"
endlog

log "Wait until Prometheus has the demo pods' metrics"
kubectl -n monitoring port-forward svc/prometheus 19090:9090 >/dev/null 2>&1 &
prom_pid=$!
trap 'status=$?; kill $prom_pid 2>/dev/null || true; if [ $status -ne 0 ]; then dump_diagnostics; fi; exit $status' EXIT
sleep 3
for _ in $(seq 1 40); do
  n="$(curl -fsS 'http://127.0.0.1:19090/api/v1/query' --data-urlencode 'query=sum(http_requests_total)' | jq -r '.data.result[0].value[1] // "0"')"
  echo "http_requests_total across pods: $n"
  if [ "${n%.*}" -gt 20 ]; then break; fi
  sleep 3
done
[ "${n%.*}" -gt 20 ] || { echo "::error::Prometheus has no request counts for the demo pods"; exit 1; }
endlog

note "## EN-16 canary demonstration (kind, Argo Rollouts ${ARGO_ROLLOUTS_VERSION}, Prometheus)"
note ""
note "Stand-in service, real AnalysisTemplate (queries and thresholds unchanged; a measurement every 10 s, six per analysis). Steps: 10%, analyse, 50%, analyse, 100%."
note ""

log "Release 2: a good version"
v1_hash="$(stable_hash)"
set_version 2 good
wait_for_phase Healthy 420
[ "$(stable_hash)" = "$(current_hash)" ] || { echo "::error::stable and current differ after a good rollout"; exit 1; }
[ "$(stable_hash)" != "$v1_hash" ] || { echo "::error::version 2 never became stable"; exit 1; }
v2_hash="$(stable_hash)"
passed="$(kubectl -n "$NS" get analysisrun -o jsonpath='{range .items[*]}{.status.phase}{"\n"}{end}' | grep -c '^Successful$' || true)"
[ "$passed" -ge 2 ] || { echo "::error::expected two successful analysis runs, saw ${passed}"; exit 1; }
note "**Release 2 (good):** promoted through 10% and 50% to 100%. Two AnalysisRuns Successful. Stable pod template \`${v1_hash}\` became \`${v2_hash}\`."
endlog

log "Release 3: a bad version that passes its health check but answers 500"
kubectl -n "$NS" delete analysisrun --all >/dev/null
set_version 3 bad
wait_for_phase Degraded 300
aborted="$(kubectl -n "$NS" get rollout demo-app -o jsonpath='{.status.abort}')"
[ "$aborted" = true ] || { echo "::error::the Rollout did not abort (abort=${aborted})"; exit 1; }
[ "$(stable_hash)" = "$v2_hash" ] || { echo "::error::stable moved off version 2"; exit 1; }
# The canary's pod is scaled down once the abort lands.
for _ in $(seq 1 40); do
  [ "$(pod_hashes)" = "$v2_hash" ] && break
  sleep 3
done
[ "$(pod_hashes)" = "$v2_hash" ] || { echo "::error::pods of the bad version are still running: $(pod_hashes)"; exit 1; }
codes="$(probe_service)"
echo "service answers: $codes"
case "$codes" in *500*|*000*) echo "::error::the Service still answers errors: $codes"; exit 1 ;; esac
failed_run="$(kubectl -n "$NS" get analysisrun -o jsonpath='{range .items[?(@.status.phase=="Failed")]}{.metadata.name}{end}')"
[ -n "$failed_run" ] || { echo "::error::no failed AnalysisRun"; exit 1; }
message="$(kubectl -n "$NS" get rollout demo-app -o jsonpath='{.status.message}')"
note ""
note "**Release 3 (bad, answers 500):** the AnalysisRun \`${failed_run}\` Failed, the Rollout aborted and rolled back on its own. Rollout message: \`${message}\`"
note ""
note "After the rollback only pod template \`$(pod_hashes)\` (version 2) is running, and 20 requests through the Service returned: \`${codes}\`"
endlog

log "The failed AnalysisRun"
kubectl -n "$NS" get analysisrun "$failed_run" -o json | jq -r '
  .status.metricResults[] | "metric \(.name): \(.phase), \(.failed // 0) failed, \(.successful // 0) successful, measurements: " +
  ([.measurements[] | "\(.phase)=\(.value)"] | join(" "))' | tee -a "$EVIDENCE_FILE" >> "${GITHUB_STEP_SUMMARY:-/dev/null}"
kubectl -n "$NS" get rollout,analysisrun -o wide
endlog

echo "canary demo: ok"
