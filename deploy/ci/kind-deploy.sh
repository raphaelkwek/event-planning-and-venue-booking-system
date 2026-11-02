#!/usr/bin/env bash
# EN-10, the kind smoke deploy: the real staging overlay (with this build's images and
# the Temporal worker off) on a kind cluster, against a throwaway in-cluster Postgres.
# Nothing is faked: a service that is not ready fails the job.
#
# What this cannot show: Kafka and Supabase are not in the cluster. The services start
# without KAFKA_* (they log it and run without their consumer or relay), and nothing here
# calls Supabase, so token verification is not exercised. See documentation/deploy.md.
set -euo pipefail
cd "$(dirname "$0")/../.."
# shellcheck source=deploy/ci/lib.sh
source deploy/ci/lib.sh
trap 'status=$?; if [ $status -ne 0 ]; then dump_diagnostics; fi; exit $status' EXIT
EVIDENCE_FILE="${EVIDENCE_FILE:-kind-deploy-evidence.md}"
: > "$EVIDENCE_FILE"
NS="$STAGING_NS"

install_argo_rollouts
install_test_postgres

log "Namespace, secret and the test egress rule"
kubectl create namespace "$NS"
create_test_secret "$NS"
kubectl apply -f deploy/k8s/test/deps/allow-postgres-netpol.yaml
endlog

log "Apply the staging overlay (kind-staging: this build's images, worker off)"
kubectl apply -k deploy/k8s/test/kind-staging
endlog

log "Wait for the migration Job, then for every workload"
kubectl -n "$NS" wait --for=condition=complete job/migrate --timeout=240s
kubectl -n "$NS" logs job/migrate | tail -5
kubectl -n "$NS" wait --for=jsonpath='{.status.phase}'=Healthy rollout/planning-core rollout/registration --timeout=300s
kubectl -n "$NS" rollout status deploy/notification --timeout=180s
kubectl -n "$NS" rollout status deploy/web --timeout=180s
kubectl -n "$NS" get rollouts,deploy,pods,svc,ingress,hpa,pdb,networkpolicy
endlog

note "## EN-10 kind smoke deploy: staging overlay"
note ""
note "Kubernetes $(kubectl version -o json | jq -r .serverVersion.gitVersion) on kind. Namespace labels (the restricted Pod Security Standard is enforced):"
note ""
note "    $(kubectl get ns "$NS" -o jsonpath='{.metadata.labels}')"
note ""
note "| Workload | Kind | Result |"
note "|---|---|---|"
note "| migrate | Job | completed |"
note "| planning-core | Rollout (canary) | Healthy |"
note "| registration | Rollout (canary) | Healthy |"
note "| notification | Deployment | rolled out |"
note "| web | Deployment | rolled out |"
note "| planning-core-worker | Deployment | scaled to 0 for this test (no Temporal namespace) |"
note ""
note "| Health check | Answer |"
note "|---|---|"
checks=("planning-core 8090 /healthz" "planning-core 8090 /readyz" "registration 8092 /readyz" "notification 8091 /readyz" "web 8080 /healthz")
for entry in "${checks[@]}"; do
  read -r svc port path <<< "$entry"
  body="$(get_via_port_forward "$NS" "$svc" "$port" "$path")"
  note "| \`${svc}${path}\` | \`${body}\` |"
  if [ "$path" = /readyz ] && ! echo "$body" | grep -q '"database":"ok"'; then
    echo "::error::${svc} is not ready: ${body}"
    exit 1
  fi
done
page="$(get_via_port_forward "$NS" web 8080 /some/client/route)"
echo "$page" | grep -q 'id="root"' || { echo "::error::web does not fall back to the app shell"; exit 1; }
note "| \`web/some/client/route\` | the app shell (SPA fallback) |"

log "NetworkPolicy: does this cluster enforce the default deny?"
# From the default namespace nothing allows ingress to planning-core; from a namespace
# named ingress-nginx the allow rule applies. If the CNI enforces policy, the first call
# fails and the second succeeds. kind's default CNI may not enforce policy; say which.
kubectl create namespace ingress-nginx
kubectl -n default run np-denied --restart=Never --image=busybox:1.37.0 -- wget -q -T 4 -O /dev/null "http://planning-core.${NS}.svc:8090/healthz" || true
kubectl -n ingress-nginx run np-allowed --restart=Never --image=busybox:1.37.0 -- wget -q -T 8 -O /dev/null "http://planning-core.${NS}.svc:8090/healthz" || true
a=""
b=""
for _ in $(seq 1 40); do
  a="$(kubectl -n default get pod np-denied -o jsonpath='{.status.phase}')"
  b="$(kubectl -n ingress-nginx get pod np-allowed -o jsonpath='{.status.phase}')"
  if { [ "$a" = Succeeded ] || [ "$a" = Failed ]; } && { [ "$b" = Succeeded ] || [ "$b" = Failed ]; }; then break; fi
  sleep 3
done
note ""
if [ "$a" = Failed ] && [ "$b" = Succeeded ]; then
  note "NetworkPolicy: enforced here. A pod in \`default\` was refused by the default deny; a pod in \`ingress-nginx\` reached planning-core through the explicit allow."
else
  note "NetworkPolicy: NOT shown to be enforced by this kind cluster (pod in \`default\`: ${a}, pod in \`ingress-nginx\`: ${b}). The policies were applied and validated, but this run does not prove they block anything."
fi
endlog

echo "kind deploy: ok"
