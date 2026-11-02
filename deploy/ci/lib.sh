#!/usr/bin/env bash
# Shared helpers for the kind jobs (EN-10, EN-16). Sourced, not run.
# shellcheck shell=bash

ARGO_ROLLOUTS_VERSION="${ARGO_ROLLOUTS_VERSION:-v1.8.3}"
ARGO_CD_VERSION="${ARGO_CD_VERSION:-v2.14.11}"
STAGING_NS=connectsphere-staging

log() { echo "::group::$*"; }
endlog() { echo "::endgroup::"; }

# Writes a line to the evidence file and to the job summary.
note() {
  echo "$*" >> "${EVIDENCE_FILE:-/dev/null}"
  echo "$*" >> "${GITHUB_STEP_SUMMARY:-/dev/null}"
}

# Loads the images the images job built (docker save tarballs) into the kind cluster.
load_images() { # <cluster> <name>...
  local cluster="$1"
  shift
  local name
  for name in "$@"; do
    kind load image-archive "image-${name}.tar.gz" --name "$cluster"
  done
}

install_argo_rollouts() {
  log "Install Argo Rollouts ${ARGO_ROLLOUTS_VERSION}"
  kubectl create namespace argo-rollouts
  kubectl apply -n argo-rollouts -f "https://github.com/argoproj/argo-rollouts/releases/download/${ARGO_ROLLOUTS_VERSION}/install.yaml"
  kubectl -n argo-rollouts rollout status deploy/argo-rollouts --timeout=180s
  endlog
}

# A throwaway Postgres in its own namespace, as the stand-in for Supabase.
install_test_postgres() {
  log "Throwaway Postgres (stands in for Supabase)"
  kubectl apply -f deploy/k8s/test/deps/postgres.yaml
  kubectl -n test-deps rollout status deploy/postgres --timeout=180s
  endlog
}

# Creates the connectsphere-secrets Secret the way documentation/deploy.md says an
# operator does, with throwaway values. Kafka and Temporal keys are left out on
# purpose: the manifests mark them optional.
create_test_secret() { # <namespace>
  kubectl -n "$1" create secret generic connectsphere-secrets \
    --from-literal=DATABASE_URL="postgres://ci:ci@postgres.test-deps.svc.cluster.local:5432/connectsphere_ci" \
    --from-literal=SUPABASE_URL="https://ci.invalid" \
    --from-literal=SUPABASE_ANON_KEY="ci-placeholder" \
    --from-literal=SUPABASE_JWKS_URL="https://ci.invalid/auth/v1/.well-known/jwks.json"
}

# GET a path on a Service through a short-lived port-forward; prints the body.
get_via_port_forward() { # <namespace> <svc> <port> <path>
  local ns="$1" svc="$2" port="$3" path="$4" local_port pid body i
  local_port=$((20000 + RANDOM % 10000))
  kubectl -n "$ns" port-forward "svc/${svc}" "${local_port}:${port}" >/dev/null 2>&1 &
  pid=$!
  body=""
  for i in $(seq 1 15); do
    if body="$(curl -fsS "http://127.0.0.1:${local_port}${path}" 2>/dev/null)"; then break; fi
    sleep 1
  done
  kill "$pid" 2>/dev/null || true
  if [ -z "$body" ]; then
    echo "no answer from ${svc}:${port}${path}" >&2
    return 1
  fi
  printf '%s' "$body"
}

dump_diagnostics() {
  echo "::group::Diagnostics"
  kubectl get nodes -o wide || true
  kubectl get pods -A -o wide || true
  kubectl get events -A --sort-by=.lastTimestamp | tail -60 || true
  kubectl get rollouts,analysisruns -A -o wide || true
  local ns p
  for ns in "${STAGING_NS}" canary-demo argocd; do
    for p in $(kubectl -n "$ns" get pods -o name 2>/dev/null); do
      echo "--- $ns/$p"
      kubectl -n "$ns" describe "$p" | tail -25 || true
      kubectl -n "$ns" logs "$p" --all-containers --tail=40 || true
    done
  done
  echo "::endgroup::"
}
