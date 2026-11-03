#!/usr/bin/env bash
# ADR-0016: the k3s staging overlay on a kind cluster, deployed the way the Release workflow
# deploys it, as far as a pull request can go without the VM:
#
#   - Traefik (the chart k3s bundles) in kube-system and cert-manager, as bootstrap.sh installs
#     them, with a self-signed ClusterIssuer named `letsencrypt` standing in for Let's Encrypt;
#   - the deployer RBAC and kubeconfig bootstrap.sh makes, and the deploy gate writing the Secret
#     from deploy/release/secret-env.mjs (throwaway values, a random Kafka password);
#   - the deploy state from deploy/release/write-state.mjs, whose remote base is this very commit
#     on GitHub, rendered by kubectl and by Argo CD's own kustomize, then applied;
#   - the in-cluster Redpanda (SCRAM over TLS), Temporal dev server and Cerbos, the throwaway
#     Postgres from EN-10 standing in for Supabase (never Supabase itself);
#   - the gate's health checks, deploy/release/smoke-api.sh through Traefik over TLS, the
#     Temporal worker, and a second migrate run.
#
# Usage: REVISION=<commit on GitHub> deploy/ci/kind-k3s.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
# shellcheck source=deploy/ci/lib.sh
source deploy/ci/lib.sh
NS="$STAGING_NS"
EVIDENCE_FILE="${EVIDENCE_FILE:-kind-k3s-evidence.md}"
: > "$EVIDENCE_FILE"
: "${REVISION:?REVISION (a commit that exists on GitHub) is required}"
TRAEFIK_CHART_VERSION="${TRAEFIK_CHART_VERSION:-40.1.0}" # the chart k3s v1.33.13 bundles
CERT_MANAGER_VERSION="${CERT_MANAGER_VERSION:-v1.21.3}"  # as bootstrap.sh
ARGOCD_IMAGE="${ARGOCD_IMAGE:-quay.io/argoproj/argocd:v2.14.11}"
API_HOST=api.staging.ci.invalid
WEB_ORIGIN=https://web.staging.ci.invalid
WORK="$(mktemp -d)"
GATE=(env CONNECTSPHERE_KUBECONFIG="$WORK/deployer-staging.kubeconfig" bash deploy/oracle/connectsphere-deploy staging)
pf_pids=()
cleanup() {
  local status=$?
  for pid in "${pf_pids[@]}"; do kill "$pid" 2> /dev/null || true; done
  if [ "$status" -ne 0 ]; then
    dump_diagnostics
    for p in $(kubectl -n "$NS" get pods -o name 2> /dev/null); do
      echo "--- $p"
      kubectl -n "$NS" logs "$p" --all-containers --tail=60 2> /dev/null || true
    done
  fi
  rm -rf "$WORK"
  exit "$status"
}
trap cleanup EXIT

log "Traefik ${TRAEFIK_CHART_VERSION} in kube-system (as k3s runs it) and cert-manager ${CERT_MANAGER_VERSION}"
helm repo add traefik https://traefik.github.io/charts > /dev/null
helm repo update traefik > /dev/null
helm install traefik traefik/traefik --version "$TRAEFIK_CHART_VERSION" --namespace kube-system \
  --set service.type=ClusterIP --set ingressClass.isDefaultClass=true --wait --timeout 5m
kubectl apply -f "https://github.com/cert-manager/cert-manager/releases/download/${CERT_MANAGER_VERSION}/cert-manager.yaml" > /dev/null
for d in cert-manager cert-manager-cainjector cert-manager-webhook; do kubectl -n cert-manager rollout status "deploy/$d" --timeout=300s; done
# The stand-in for bootstrap.sh's Let's Encrypt issuer: same name, self-signed.
for _ in $(seq 1 30); do
  kubectl apply -f - > /dev/null 2>&1 <<'EOF' && break
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt
spec:
  selfSigned: {}
EOF
  sleep 4
done
kubectl get clusterissuer letsencrypt
endlog

install_test_postgres

log "Namespace, deployer RBAC and kubeconfig (as bootstrap.sh)"
kubectl apply -f deploy/k8s/overlays/k3s-staging/namespace.yaml
kubectl create namespace argocd --dry-run=client -o yaml | kubectl apply -f -
kubectl create namespace connectsphere-production --dry-run=client -o yaml | kubectl apply -f -
sed "s/ENVIRONMENT/staging/g" deploy/oracle/deployer-rbac.yaml | kubectl apply -f -
kubectl apply -f deploy/k8s/test/deps/allow-postgres-netpol.yaml
server="$(kubectl config view --minify -o jsonpath='{.clusters[0].cluster.server}')"
bash deploy/oracle/make-deployer-kubeconfig.sh staging "$server" "$WORK/deployer-staging.kubeconfig"
endlog

log "The deploy gate writes the Secret, and refuses what it should"
db="postgres://ci:ci@postgres.test-deps.svc.cluster.local:5432/connectsphere_ci"
DATABASE_URL="$db" MIGRATE_DATABASE_URL="$db" SUPABASE_URL=https://ci.invalid SUPABASE_ANON_KEY=ci-placeholder \
  SUPABASE_SERVICE_ROLE_KEY=ci-placeholder KAFKA_SASL_PASSWORD="$(openssl rand -hex 24)" \
  node deploy/release/secret-env.mjs --out "$WORK/secret.env"
"${GATE[@]}" apply-secret < "$WORK/secret.env" | tee "$WORK/gate.out"
grep -q '^created$' "$WORK/gate.out"
if grep -qF "$(grep '^KAFKA_SASL_PASSWORD=' "$WORK/secret.env" | cut -d= -f2)" "$WORK/gate.out"; then
  echo "::error::the gate printed a secret value"; exit 1
fi
"${GATE[@]}" apply-secret < "$WORK/secret.env" | grep -q '^unchanged$'
expect_refused() { # <description> <stdin file> <gate args...>
  local what="$1" input="$2"
  shift 2
  if "${GATE[@]}" "$@" < "$input" > "$WORK/refused.out" 2>&1; then
    echo "::error::the gate accepted ${what}"; exit 1
  fi
  grep -q 'refused' "$WORK/refused.out" || { cat "$WORK/refused.out"; echo "::error::the gate failed on ${what} for another reason"; exit 1; }
  echo "refused, as it should be: ${what}"
}
{ cat "$WORK/secret.env"; echo "AWS_SECRET_ACCESS_KEY=nope"; } > "$WORK/extra.env"
printf 'not a key value line\n' > "$WORK/malformed.env"
grep -v '^MIGRATE_DATABASE_URL=' "$WORK/secret.env" > "$WORK/missing.env"
expect_refused "an unknown key" "$WORK/extra.env" apply-secret
expect_refused "a malformed line" "$WORK/malformed.env" apply-secret
expect_refused "a missing key" "$WORK/missing.env" apply-secret
expect_refused "an unknown verb" /dev/null exec sh
expect_refused "a short sync commit" /dev/null sync abc123
deployer=(kubectl --kubeconfig "$WORK/deployer-staging.kubeconfig")
for check in "get secrets -n connectsphere-production" "list secrets -n kube-system" "create pods -n ${NS}" "delete secrets -n ${NS}"; do
  # shellcheck disable=SC2086 # the check is a list of arguments
  if [ "$("${deployer[@]}" auth can-i $check 2> /dev/null || true)" = yes ]; then
    echo "::error::the staging deployer may ${check}"; exit 1
  fi
done
[ "$("${deployer[@]}" auth can-i patch secrets/connectsphere-secrets -n "$NS")" = yes ]
endlog

log "The deploy state for this commit (remote base on GitHub), rendered by kubectl and by Argo CD's kustomize"
images="$(for n in planning-core registration notification migrate cerbos; do printf '"%s":"connectsphere-%s:ci",' "$n" "$n"; done)"
printf '{"commit":"%s","images":{%s}}' "$REVISION" "${images%,}" > "$WORK/release.json"
mkdir -p "$WORK/state"
node deploy/release/write-state.mjs --environment staging --release "$WORK/release.json" --api-host "$API_HOST" \
  --web-origin "$WEB_ORIGIN" --out "$WORK/state/environments/staging" --allow-tags
cat "$WORK/state/environments/staging/kustomization.yaml"
kubectl kustomize "$WORK/state/environments/staging" > "$WORK/rendered.yaml"
chmod -R a+rX "$WORK/state"
docker run --rm -v "$WORK/state:/state:ro" -e HOME=/tmp "$ARGOCD_IMAGE" kustomize build /state/environments/staging > "$WORK/rendered-argocd.yaml"
# The two kustomize versions may order or quote differently; the objects must be the same.
python3 - "$WORK/rendered.yaml" "$WORK/rendered-argocd.yaml" <<'PY'
import sys, yaml
def objects(path):
    docs = [d for d in yaml.safe_load_all(open(path)) if d]
    return sorted(docs, key=lambda d: (d["kind"], d["metadata"]["name"]))
a, b = objects(sys.argv[1]), objects(sys.argv[2])
if a != b:
    print("::error::Argo CD's kustomize renders the deploy state differently from kubectl's")
    sys.exit(1)
print(f"ok: kubectl and Argo CD render the same {len(a)} objects")
PY
[ "$(yq 'select(.kind == "Job" and .metadata.name == "migrate") | .spec.template.spec.containers[0].env[0].valueFrom.secretKeyRef.key' "$WORK/rendered.yaml")" = MIGRATE_DATABASE_URL ]
[ "$(yq 'select(.kind == "Ingress") | .spec.rules[0].host' "$WORK/rendered.yaml")" = "$API_HOST" ]
[ "$(yq 'select(.kind == "ConfigMap" and .metadata.name == "connectsphere-config") | .data.CORS_ALLOWED_ORIGINS' "$WORK/rendered.yaml")" = "$WEB_ORIGIN" ]
endlog

log "Apply the state and wait for every workload"
kubectl apply --server-side -f "$WORK/rendered.yaml"
# cert-manager's ingress-shim makes the API certificate from the Ingress a moment later.
for _ in $(seq 1 60); do kubectl -n "$NS" get certificate connectsphere-staging-api-tls > /dev/null 2>&1 && break; sleep 2; done
kubectl -n "$NS" wait --for=condition=Ready certificate --all --timeout=240s
kubectl -n "$NS" rollout status statefulset/redpanda --timeout=420s
kubectl -n "$NS" rollout status statefulset/temporal --timeout=300s
kubectl -n "$NS" rollout status deploy/cerbos --timeout=180s
kubectl -n "$NS" wait --for=condition=complete job/migrate --timeout=420s
applied="$(kubectl -n "$NS" logs job/migrate | grep -c '^apply ' || true)"
for d in planning-core registration notification planning-core-worker; do kubectl -n "$NS" rollout status "deploy/$d" --timeout=300s; done
kubectl -n "$NS" get deploy,sts,job,pods,svc,ingress,certificate,pvc,networkpolicy
endlog

log "The gate's health checks (database ok and Kafka reachable for each service)"
"${GATE[@]}" health | tee "$WORK/health.out"
endlog

log "The Temporal worker connects to the in-cluster Temporal and starts its Kafka consumers"
started=false
for _ in $(seq 1 40); do
  if kubectl -n "$NS" logs deploy/planning-core-worker 2> /dev/null | grep -q 'Temporal worker started'; then started=true; break; fi
  sleep 3
done
[ "$started" = true ] || { echo "::error::the worker never logged 'Temporal worker started'"; exit 1; }
# It may have restarted while Temporal and Redpanda were still starting; once started it must stay up.
worker_restarts() { kubectl -n "$NS" get pods -l app.kubernetes.io/name=planning-core-worker -o jsonpath='{.items[*].status.containerStatuses[*].restartCount}'; }
before_restarts="$(worker_restarts)"
sleep 20
[ "$(worker_restarts)" = "$before_restarts" ] || { echo "::error::the worker restarted after it started"; exit 1; }
endlog

log "Through Traefik over TLS: routes, CORS and the certificate"
kubectl -n kube-system port-forward svc/traefik 18443:443 18080:80 > /dev/null 2>&1 &
pf_pids+=("$!")
for _ in $(seq 1 30); do curl -sk -o /dev/null "https://127.0.0.1:18443/" && break; sleep 1; done
san="$(openssl s_client -connect 127.0.0.1:18443 -servername "$API_HOST" < /dev/null 2> /dev/null | openssl x509 -noout -ext subjectAltName)"
grep -qF "$API_HOST" <<< "$san" || { echo "::error::Traefik does not present the cert-manager certificate for ${API_HOST}: ${san}"; exit 1; }
plain="$(curl -s -o /dev/null -w '%{http_code}' --resolve "${API_HOST}:18080:127.0.0.1" "http://${API_HOST}:18080/identity/api/v1/users/me")"
[ "$plain" = 404 ] || { echo "::error::plain HTTP reached the API (${plain})"; exit 1; }
CURL_EXTRA="--resolve ${API_HOST}:18443:127.0.0.1 --insecure" bash deploy/release/smoke-api.sh "https://${API_HOST}:18443" "$WEB_ORIGIN" | tee "$WORK/smoke.out"
endlog

log "The migrate Job a second time applies nothing"
kubectl -n "$NS" create job migrate-again --from=job/migrate
kubectl -n "$NS" wait --for=condition=complete job/migrate-again --timeout=300s
again="$(kubectl -n "$NS" logs job/migrate-again | grep -c '^apply ' || true)"
[ "$again" = 0 ] || { echo "::error::the second migrate run applied ${again} files"; exit 1; }
endlog

note "## ADR-0016 kind run: the k3s staging overlay with its own Redpanda, Temporal and Cerbos"
note ""
note "Kubernetes $(kubectl version -o json | jq -r .serverVersion.gitVersion) on kind, Traefik chart ${TRAEFIK_CHART_VERSION}, cert-manager ${CERT_MANAGER_VERSION}. Deploy state rendered from this commit's overlay on GitHub (\`?ref=${REVISION}\`), identical under ${ARGOCD_IMAGE}'s kustomize."
note ""
note "| Check | Result |"
note "|---|---|"
note "| Deploy gate | wrote connectsphere-secrets (key names only), then unchanged; refused an unknown key, a malformed line, a missing key, an unknown verb, a short commit |"
note "| Deployer RBAC | may not read production's or kube-system's Secrets, create pods or delete Secrets |"
note "| Certificates | the API certificate (self-signed stand-in for Let's Encrypt) and Redpanda's internal-CA certificate Ready |"
note "| Redpanda, Temporal, Cerbos | ready, under the restricted Pod Security Standard |"
note "| migrate Job | complete through MIGRATE_DATABASE_URL (${applied} files), then 0 on a second run |"
while read -r line; do note "| \`${line%% *}\` | \`${line#* }\` |"; done < <(grep -E '^(planning-core|registration|notification|cerbos) ' "$WORK/health.out")
note "| Temporal worker | logged 'Temporal worker started' (connected to temporal:7233 and its Kafka consumers) and stayed up |"
note "| TLS | Traefik presents the certificate for ${API_HOST}; plain HTTP does not reach the API |"
note ""
grep -E '^\|' "$WORK/smoke.out" | while read -r line; do note "$line"; done
echo "kind k3s: ok"
