#!/usr/bin/env bash
# ADR-0016. Turns a fresh Oracle Cloud Always Free Ampere VM (Ubuntu 24.04, arm64) into the
# ConnectSphere staging and production cluster. Run it once, from a checkout of this repository
# on the VM; running it again changes nothing that is already right.
#
#   git clone https://github.com/raphaelkwek/event-planning-and-venue-booking-system.git ~/connectsphere
#   cd ~/connectsphere
#   sudo bash deploy/oracle/bootstrap.sh \
#     --email you@example.org \
#     --staging-key "$(cat connectsphere-staging-deploy.pub)" \
#     --production-key "$(cat connectsphere-production-deploy.pub)"
#
# What it does, in order (documentation/deploy/README.md explains each):
#   1. the host firewall: opens 80 and 443 next to Oracle's 22, lets k3s's pod and service
#      networks through Oracle's REJECT rules, and saves the rules so a reboot keeps them;
#   2. k3s (single node, its bundled Traefik and local-path storage), pinned;
#   3. cert-manager, pinned, and the `letsencrypt` ClusterIssuer the Ingress names;
#   4. Argo CD, pinned, the connectsphere AppProject and the two Applications that follow
#      environments/<env> on the deploy-state branch;
#   5. the two namespaces, the deployer ServiceAccounts and the deploy gate: a `cs-deploy`
#      user with no shell access, whose authorized_keys allow each environment's key to run
#      only `connectsphere-deploy <env> ...`.
#
# --acme-staging points the ClusterIssuer at Let's Encrypt's staging server (untrusted
# certificates, generous limits) for a first try; run again without it to switch back.
set -euo pipefail

K3S_VERSION="${K3S_VERSION:-v1.33.13+k3s2}"
CERT_MANAGER_VERSION="${CERT_MANAGER_VERSION:-v1.21.3}"
ARGOCD_VERSION="${ARGOCD_VERSION:-v2.14.11}"
POD_CIDR=10.42.0.0/16
SERVICE_CIDR=10.43.0.0/16
DEPLOY_USER=cs-deploy
GATE=/usr/local/bin/connectsphere-deploy
CONFIG_DIR=/etc/connectsphere

EMAIL=""
STAGING_KEY=""
PRODUCTION_KEY=""
ACME_SERVER=https://acme-v02.api.letsencrypt.org/directory

usage() {
  sed -n '2,25p' "$0" | sed 's/^# \{0,1\}//'
  exit 2
}

while [ $# -gt 0 ]; do
  case "$1" in
    --email) EMAIL="${2:-}"; shift 2 ;;
    --staging-key) STAGING_KEY="${2:-}"; shift 2 ;;
    --production-key) PRODUCTION_KEY="${2:-}"; shift 2 ;;
    --acme-staging) ACME_SERVER=https://acme-staging-v02.api.letsencrypt.org/directory; shift ;;
    -h | --help) usage ;;
    *) echo "unknown argument: $1" >&2; usage ;;
  esac
done

[ "$(id -u)" -eq 0 ] || { echo "run with sudo" >&2; exit 1; }
[[ "$EMAIL" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]] || { echo "--email: Let's Encrypt's contact address is required" >&2; exit 2; }
for key in "$STAGING_KEY" "$PRODUCTION_KEY"; do
  [[ "$key" =~ ^(ssh-ed25519|ecdsa-sha2-nistp256|ssh-rsa)\ [A-Za-z0-9+/=]+( .*)?$ ]] \
    || { echo "--staging-key and --production-key must each be one SSH public key line" >&2; exit 2; }
done
[ "$STAGING_KEY" != "$PRODUCTION_KEY" ] || { echo "staging and production need different deploy keys" >&2; exit 2; }

REPO="$(cd "$(dirname "$0")/../.." && pwd)"
[ -f "$REPO/deploy/argocd/k3s/application-staging.yaml" ] || { echo "run from a checkout of the repository" >&2; exit 1; }
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml

step() { echo; echo "== $*"; }

# --- 1. Host firewall ------------------------------------------------------------------
# Oracle's Ubuntu images ship iptables rules (/etc/iptables/rules.v4) that accept only SSH
# and end INPUT and FORWARD with a REJECT. The rules below go in front of those REJECTs, in
# the saved file (so they survive a reboot, before k3s starts) and in the running tables.
# 6443 (the Kubernetes API) is not opened: deployments arrive over SSH.
step "Host firewall: open 80 and 443, let the pod and service networks through"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq iptables-persistent jq curl git > /dev/null

RULES=(
  "INPUT -p tcp -m conntrack --ctstate NEW -m tcp --dport 80 -j ACCEPT"
  "INPUT -p tcp -m conntrack --ctstate NEW -m tcp --dport 443 -j ACCEPT"
  "INPUT -s ${POD_CIDR} -j ACCEPT"
  "FORWARD -s ${POD_CIDR} -j ACCEPT"
  "FORWARD -d ${POD_CIDR} -j ACCEPT"
  "FORWARD -s ${SERVICE_CIDR} -j ACCEPT"
  "FORWARD -d ${SERVICE_CIDR} -j ACCEPT"
)
for rule in "${RULES[@]}"; do
  # shellcheck disable=SC2086 # the rule is meant to split into iptables arguments.
  iptables -C ${rule} 2> /dev/null || iptables -I ${rule}
done
if [ -f /etc/iptables/rules.v4 ]; then
  for rule in "${RULES[@]}"; do
    chain="${rule%% *}"
    grep -qF -- "-A ${rule}" /etc/iptables/rules.v4 && continue
    # In front of the chain's first REJECT, or before COMMIT if it has none.
    if grep -q "^-A ${chain} .*-j REJECT" /etc/iptables/rules.v4; then
      awk -v rule="-A ${rule}" -v chain="-A ${chain} " 'done != 1 && index($0, chain) == 1 && /-j REJECT/ { print rule; done = 1 } { print }' \
        /etc/iptables/rules.v4 > /etc/iptables/rules.v4.new
    else
      awk -v rule="-A ${rule}" 'done != 1 && /^COMMIT/ { print rule; done = 1 } { print }' /etc/iptables/rules.v4 > /etc/iptables/rules.v4.new
    fi
    mv /etc/iptables/rules.v4.new /etc/iptables/rules.v4
  done
else
  echo "no /etc/iptables/rules.v4 (not an Oracle image?); the running rules are set, nothing is saved"
fi

# Redpanda's async I/O needs more than Ubuntu's default.
cat > /etc/sysctl.d/90-connectsphere.conf <<'EOF'
fs.aio-max-nr = 1048576
fs.inotify.max_user_instances = 1024
EOF
sysctl --quiet --system

# --- 2. k3s ----------------------------------------------------------------------------
step "k3s ${K3S_VERSION}"
if command -v k3s > /dev/null && k3s --version | grep -qF "${K3S_VERSION}"; then
  echo "already installed"
else
  curl -sfL https://get.k3s.io | INSTALL_K3S_VERSION="${K3S_VERSION}" sh -s - server --write-kubeconfig-mode 0600
fi
for _ in $(seq 1 60); do
  kubectl get nodes 2> /dev/null | grep -q " Ready " && break
  sleep 5
done
kubectl get nodes -o wide
kubectl -n kube-system rollout status deployment/traefik --timeout=300s 2> /dev/null \
  || { sleep 30; kubectl -n kube-system rollout status deployment/traefik --timeout=300s; }

# --- 3. cert-manager -------------------------------------------------------------------
step "cert-manager ${CERT_MANAGER_VERSION} and the letsencrypt ClusterIssuer"
kubectl apply -f "https://github.com/cert-manager/cert-manager/releases/download/${CERT_MANAGER_VERSION}/cert-manager.yaml" > /dev/null
for deploy in cert-manager cert-manager-cainjector cert-manager-webhook; do
  kubectl -n cert-manager rollout status "deployment/${deploy}" --timeout=300s
done
for _ in $(seq 1 30); do
  kubectl apply -f - > /dev/null 2>&1 <<EOF && break
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt
spec:
  acme:
    server: ${ACME_SERVER}
    email: ${EMAIL}
    privateKeySecretRef:
      name: letsencrypt-account-key
    solvers:
      - http01:
          ingress:
            ingressClassName: traefik
EOF
  sleep 5 # the webhook takes a moment to accept requests
done
kubectl get clusterissuer letsencrypt

# --- 4. Argo CD ------------------------------------------------------------------------
step "Argo CD ${ARGOCD_VERSION}, the AppProject and the Applications"
kubectl create namespace argocd --dry-run=client -o yaml | kubectl apply -f - > /dev/null
kubectl apply -n argocd --server-side --force-conflicts \
  -f "https://raw.githubusercontent.com/argoproj/argo-cd/${ARGOCD_VERSION}/manifests/install.yaml" > /dev/null
for deploy in argocd-repo-server argocd-server argocd-applicationset-controller argocd-redis; do
  kubectl -n argocd rollout status "deployment/${deploy}" --timeout=300s
done
kubectl -n argocd rollout status statefulset/argocd-application-controller --timeout=300s

# --- 5. Namespaces, the deployer accounts and the gate ---------------------------------
step "Namespaces, deployer ServiceAccounts and the deploy gate"
for env in staging production; do
  kubectl apply -f "$REPO/deploy/k8s/overlays/k3s-${env}/namespace.yaml" > /dev/null
  sed "s/ENVIRONMENT/${env}/g" "$REPO/deploy/oracle/deployer-rbac.yaml" | kubectl apply -f - > /dev/null
done
kubectl apply -f "$REPO/deploy/argocd/appproject.yaml" > /dev/null
kubectl apply -f "$REPO/deploy/argocd/k3s/application-staging.yaml" -f "$REPO/deploy/argocd/k3s/application-production.yaml" > /dev/null

id "$DEPLOY_USER" > /dev/null 2>&1 || useradd --create-home --shell /bin/bash --comment "ConnectSphere deploy gate" "$DEPLOY_USER"
passwd --lock "$DEPLOY_USER" > /dev/null
install -m 0755 "$REPO/deploy/oracle/connectsphere-deploy" "$GATE"
install -d -m 0750 -o root -g "$DEPLOY_USER" "$CONFIG_DIR"
for env in staging production; do
  bash "$REPO/deploy/oracle/make-deployer-kubeconfig.sh" "$env" https://127.0.0.1:6443 "$CONFIG_DIR/deployer-${env}.kubeconfig"
  chown "$DEPLOY_USER:$DEPLOY_USER" "$CONFIG_DIR/deployer-${env}.kubeconfig"
done
home="$(getent passwd "$DEPLOY_USER" | cut -d: -f6)"
install -d -m 0700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$home/.ssh"
{
  echo "# Written by deploy/oracle/bootstrap.sh. Each key may only run the deploy gate for its environment."
  echo "command=\"${GATE} staging\",restrict ${STAGING_KEY}"
  echo "command=\"${GATE} production\",restrict ${PRODUCTION_KEY}"
} > "$home/.ssh/authorized_keys"
chown "$DEPLOY_USER:$DEPLOY_USER" "$home/.ssh/authorized_keys"
chmod 0600 "$home/.ssh/authorized_keys"

# Check the gate's account before anyone relies on it: it can see its Application, and the
# staging account cannot read production.
sudo -u "$DEPLOY_USER" "$GATE" staging status | head -1 || true
if sudo -u "$DEPLOY_USER" kubectl --kubeconfig "$CONFIG_DIR/deployer-staging.kubeconfig" auth can-i get secrets -n connectsphere-production 2> /dev/null | grep -qx yes; then
  echo "the staging deployer can read production's Secrets: stop and check deploy/oracle/deployer-rbac.yaml" >&2
  exit 1
fi

step "Done"
cat <<EOF
k3s, cert-manager, Argo CD and both Applications are in place. The Applications report an error
until the first release writes the deploy-state branch; that is expected.

For the GitHub environments (documentation/deploy/README.md, step 5), from your laptop:

  DEPLOY_SSH_HOST         this VM's public IP
  DEPLOY_SSH_KNOWN_HOSTS  the output of: ssh-keyscan -t ed25519 <public IP>
  API_HOST                api.staging.<public IP>.sslip.io and api.<public IP>.sslip.io

Check a key from your laptop:
  ssh -i connectsphere-staging-deploy ${DEPLOY_USER}@<public IP> status
EOF
