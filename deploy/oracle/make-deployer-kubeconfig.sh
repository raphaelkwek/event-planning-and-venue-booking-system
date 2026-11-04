#!/usr/bin/env bash
# ADR-0016. Writes a kubeconfig for one environment's deployer ServiceAccount
# (deployer-rbac.yaml), which is all the deploy gate ever authenticates as.
#
#   make-deployer-kubeconfig.sh <staging|production> <API server URL> <output file>
#
# Run with an admin kubeconfig (bootstrap.sh on the VM, or the kind job). The token never
# leaves the file, which is written with mode 0600.
set -euo pipefail
environment="$1"
server="$2"
out="$3"
case "$environment" in staging | production) ;; *) echo "environment must be staging or production" >&2; exit 2 ;; esac
ns="connectsphere-${environment}"

token=""
for _ in $(seq 1 30); do
  token="$(kubectl -n "$ns" get secret deployer-token -o jsonpath='{.data.token}' 2>/dev/null || true)"
  [ -n "$token" ] && break
  sleep 2
done
[ -n "$token" ] || { echo "the deployer-token Secret in ${ns} has no token yet" >&2; exit 1; }
ca="$(kubectl -n "$ns" get secret deployer-token -o jsonpath='{.data.ca\.crt}')"

umask 077
cat > "$out" <<EOF
apiVersion: v1
kind: Config
clusters:
  - name: connectsphere
    cluster:
      server: ${server}
      certificate-authority-data: ${ca}
users:
  - name: deployer-${environment}
    user:
      token: $(printf '%s' "$token" | base64 -d)
contexts:
  - name: deployer-${environment}
    context:
      cluster: connectsphere
      user: deployer-${environment}
      namespace: ${ns}
current-context: deployer-${environment}
EOF
chmod 600 "$out"
echo "wrote ${out} for ServiceAccount ${ns}/deployer"
