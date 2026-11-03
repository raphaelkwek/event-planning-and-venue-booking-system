#!/usr/bin/env bash
# EN-10, GitOps: install Argo CD in a kind cluster, give it the staging Application from
# deploy/argocd/, and watch it sync deploy/k8s/overlays/staging from this repository.
#
# The repository is public, so Argo CD reads it with no credentials. Two things differ
# from a real cluster, both set on the Application in this run only (never in git):
# the revision is this build's commit instead of main, and the images are the ones the
# Deploy workflow built (kind loads them), with the Temporal worker off.
#
# Usage: REVISION=<commit sha> deploy/ci/argocd-sync.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
# shellcheck source=deploy/ci/lib.sh
source deploy/ci/lib.sh
trap 'status=$?; if [ $status -ne 0 ]; then dump_diagnostics; kubectl -n argocd get applications -o yaml || true; fi; exit $status' EXIT
EVIDENCE_FILE="${EVIDENCE_FILE:-argocd-sync-evidence.md}"
: > "$EVIDENCE_FILE"
NS="$STAGING_NS"
: "${REVISION:?REVISION (the commit Argo CD should sync) is required}"

install_argo_rollouts
install_test_postgres

log "Namespace, secret and the test egress rule"
kubectl create namespace "$NS"
create_test_secret "$NS"
kubectl apply -f deploy/k8s/test/deps/allow-postgres-netpol.yaml
endlog

log "Install Argo CD ${ARGO_CD_VERSION}"
kubectl create namespace argocd
kubectl apply -n argocd --server-side --force-conflicts -f "https://raw.githubusercontent.com/argoproj/argo-cd/${ARGO_CD_VERSION}/manifests/install.yaml"
kubectl -n argocd rollout status deploy/argocd-repo-server --timeout=300s
kubectl -n argocd rollout status deploy/argocd-server --timeout=300s
kubectl -n argocd rollout status deploy/argocd-applicationset-controller --timeout=300s
kubectl -n argocd rollout status statefulset/argocd-application-controller --timeout=300s
endlog

log "Tell Argo CD an Ingress without a load balancer is healthy (kind has no ingress controller)"
# Argo CD reports an Ingress Progressing until a controller gives it an address. This
# cluster has no controller, so without this the Application could never be Healthy.
# Only this CI cluster is changed; the real clusters have a controller.
health_lua=$'hs = {}\nhs.status = "Healthy"\nreturn hs\n'
kubectl -n argocd patch configmap argocd-cm --type merge \
  -p "$(jq -n --arg lua "$health_lua" '{data: {"resource.customizations.health.networking.k8s.io_Ingress": $lua}}')"
kubectl -n argocd rollout restart statefulset/argocd-application-controller
kubectl -n argocd rollout status statefulset/argocd-application-controller --timeout=300s
endlog

log "Apply the project and the staging Application"
kubectl apply -f deploy/argocd/appproject.yaml
export REVISION
yq '
  .spec.source.targetRevision = strenv(REVISION) |
  .spec.source.kustomize.images = [
    "ghcr.io/raphaelkwek/connectsphere-planning-core=connectsphere-planning-core:ci",
    "ghcr.io/raphaelkwek/connectsphere-registration=connectsphere-registration:ci",
    "ghcr.io/raphaelkwek/connectsphere-notification=connectsphere-notification:ci",
    "ghcr.io/raphaelkwek/connectsphere-web=connectsphere-web:ci",
    "ghcr.io/raphaelkwek/connectsphere-migrate=connectsphere-migrate:ci"
  ] |
  .spec.source.kustomize.patches = [{
    "target": {"kind": "Deployment", "name": "planning-core-worker"},
    "patch": "- op: replace\n  path: /spec/replicas\n  value: 0\n"
  }]
' deploy/argocd/application-staging.yaml | tee applied-application.yaml | kubectl apply -f -
endlog

log "Wait for Argo CD to sync and report Healthy"
sync="" health=""
for _ in $(seq 1 100); do
  sync="$(kubectl -n argocd get application connectsphere-staging -o jsonpath='{.status.sync.status}' 2>/dev/null || true)"
  health="$(kubectl -n argocd get application connectsphere-staging -o jsonpath='{.status.health.status}' 2>/dev/null || true)"
  echo "sync=${sync:-?} health=${health:-?}"
  if [ "$sync" = Synced ] && [ "$health" = Healthy ]; then break; fi
  sleep 6
done
[ "$sync" = Synced ] && [ "$health" = Healthy ] || { echo "::error::Argo CD did not reach Synced and Healthy (sync=${sync}, health=${health})"; exit 1; }
synced_rev="$(kubectl -n argocd get application connectsphere-staging -o jsonpath='{.status.sync.revision}')"
kubectl -n "$NS" get rollouts,deploy,job,pods
endlog

note "## EN-10 Argo CD sync: staging overlay"
note ""
note "Argo CD ${ARGO_CD_VERSION} on kind synced \`deploy/k8s/overlays/staging\` from this repository (public, no credentials) at revision \`${synced_rev}\`."
note ""
note "| Application | Sync | Health | Policy |"
note "|---|---|---|---|"
note "| connectsphere-staging | ${sync} | ${health} | automated, prune, self-heal |"
note ""
note "Resources Argo CD created: $(kubectl -n argocd get application connectsphere-staging -o json | jq -r '[.status.resources[] | "\(.kind)/\(.name)"] | join(", ")')"

log "Self-heal: delete a resource by hand and watch Argo CD put it back"
before="$(kubectl -n "$NS" get configmap connectsphere-config -o jsonpath='{.metadata.uid}')"
kubectl -n "$NS" delete configmap connectsphere-config
after=""
for _ in $(seq 1 30); do
  after="$(kubectl -n "$NS" get configmap connectsphere-config -o jsonpath='{.metadata.uid}' 2>/dev/null || true)"
  if [ -n "$after" ] && [ "$after" != "$before" ]; then break; fi
  sleep 3
done
[ -n "$after" ] && [ "$after" != "$before" ] || { echo "::error::the deleted ConfigMap was not restored"; exit 1; }
note ""
note "Self-heal: the ConfigMap \`connectsphere-config\` was deleted by hand and recreated by Argo CD (uid \`${before:0:8}\` to \`${after:0:8}\`)."
endlog

echo "argocd sync: ok"
