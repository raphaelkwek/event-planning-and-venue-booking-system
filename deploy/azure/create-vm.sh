#!/usr/bin/env bash
# ADR-0016 amendment (Azure): create, or check, the one VM that runs staging and production.
# Idempotent: every resource is looked up first and created only if missing, so running it again
# changes nothing. Needs the az CLI, logged in (`az login`), with Contributor on the subscription.
#
#   bash deploy/azure/create-vm.sh --subscription <id> [--ssh-key ~/.ssh/connectsphere-azure.pub]
#
# Everything is a parameter (defaults in brackets):
#   --resource-group [connectsphere-rg]  --location [southeastasia]  --vm [connectsphere-vm]
#   --size [Standard_B2pls_v2]  --image [Canonical:ubuntu-24_04-lts:server-arm64:latest]
#   --admin [azureuser]  --ip [connectsphere-ip]  --nsg [connectsphere-nsg]
#   --ssh-key [~/.ssh/connectsphere-azure.pub]  --budget [20] (USD a month, on the resource group)
#
# The subscription only allows a few regions and does not offer Standard_B2s there, so the default
# is the Ampere B2pls_v2 (2 vCPU, 4 GB, arm64), which the image builds for natively. The network
# security group allows only TCP 22, 80 and 443 in. cloud-init installs Docker.
set -euo pipefail

SUBSCRIPTION=""
RG=connectsphere-rg
LOCATION=southeastasia
VM=connectsphere-vm
SIZE=Standard_B2pls_v2
IMAGE=Canonical:ubuntu-24_04-lts:server-arm64:latest
ADMIN=azureuser
IP=connectsphere-ip
NSG=connectsphere-nsg
SSH_KEY="${HOME}/.ssh/connectsphere-azure.pub"
BUDGET=20
# Every resource is tagged, and lives only in this resource group: the subscription holds other
# projects' resources, which nothing here may touch.
TAGS="project=connectsphere"
HERE="$(cd "$(dirname "$0")" && pwd)"

while [ $# -gt 0 ]; do
  case "$1" in
    --subscription) SUBSCRIPTION="$2"; shift 2 ;;
    --resource-group) RG="$2"; shift 2 ;;
    --location) LOCATION="$2"; shift 2 ;;
    --vm) VM="$2"; shift 2 ;;
    --size) SIZE="$2"; shift 2 ;;
    --image) IMAGE="$2"; shift 2 ;;
    --admin) ADMIN="$2"; shift 2 ;;
    --ip) IP="$2"; shift 2 ;;
    --nsg) NSG="$2"; shift 2 ;;
    --ssh-key) SSH_KEY="$2"; shift 2 ;;
    --budget) BUDGET="$2"; shift 2 ;;
    -h | --help) sed -n '2,17p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done
[ -n "$SUBSCRIPTION" ] || { echo "--subscription <id> is required" >&2; exit 2; }
[ -f "$SSH_KEY" ] || { echo "no SSH public key at ${SSH_KEY}: ssh-keygen -t ed25519 -f ${SSH_KEY%.pub}" >&2; exit 2; }

# On Windows (Git Bash) az is a Windows program and needs Windows paths.
CLOUD_INIT="${HERE}/cloud-init.yaml"
KEY_ARG="$SSH_KEY"
if command -v cygpath > /dev/null; then
  CLOUD_INIT="$(cygpath -w "$CLOUD_INIT")"
  KEY_ARG="$(cygpath -w "$SSH_KEY")"
fi

step() { echo "== $*"; }
exists() { "$@" --only-show-errors > /dev/null 2>&1; }

step "subscription"
az account set --subscription "$SUBSCRIPTION"

step "resource group ${RG} in ${LOCATION}"
exists az group show -n "$RG" || az group create -n "$RG" -l "$LOCATION" --tags "$TAGS" --only-show-errors -o none

step "static public IP ${IP}"
exists az network public-ip show -g "$RG" -n "$IP" \
  || az network public-ip create -g "$RG" -n "$IP" -l "$LOCATION" --sku Standard --allocation-method Static --version IPv4 --tags "$TAGS" --only-show-errors -o none

step "network security group ${NSG}: 22, 80, 443 only"
exists az network nsg show -g "$RG" -n "$NSG" || az network nsg create -g "$RG" -n "$NSG" -l "$LOCATION" --tags "$TAGS" --only-show-errors -o none
priority=1000
for port in 22 80 443; do
  name="allow-tcp-${port}"
  exists az network nsg rule show -g "$RG" --nsg-name "$NSG" -n "$name" \
    || az network nsg rule create -g "$RG" --nsg-name "$NSG" -n "$name" --priority "$priority" --direction Inbound \
      --access Allow --protocol Tcp --destination-port-ranges "$port" --source-address-prefixes '*' --only-show-errors -o none
  priority=$((priority + 10))
done

step "VM ${VM} (${SIZE})"
if exists az vm show -g "$RG" -n "$VM"; then
  echo "exists"
else
  az vm create -g "$RG" -n "$VM" -l "$LOCATION" --image "$IMAGE" --size "$SIZE" \
    --admin-username "$ADMIN" --ssh-key-values "$KEY_ARG" --authentication-type ssh \
    --public-ip-address "$IP" --nsg "$NSG" --storage-sku StandardSSD_LRS --os-disk-size-gb 32 \
    --custom-data "$CLOUD_INIT" --tags "$TAGS" --only-show-errors -o none
fi

step "budget alert: USD ${BUDGET} a month on ${RG}"
start="$(date -u +%Y-%m-01)"
if exists az consumption budget show --budget-name connectsphere-monthly --resource-group "$RG"; then
  echo "exists"
elif ! az consumption budget create --budget-name connectsphere-monthly --resource-group "$RG" --amount "$BUDGET" \
  --category cost --time-grain monthly --start-date "$start" --end-date 2027-12-31 --only-show-errors -o none 2> /dev/null; then
  echo "the subscription does not allow a budget from the CLI (Azure for Students often does not); set one in the portal: Cost Management, Budgets"
fi

address="$(az network public-ip show -g "$RG" -n "$IP" --query ipAddress -o tsv)"
step "done"
cat << OUT
VM ${VM} is at ${address} (static). cloud-init installs Docker in its first few minutes.

  ssh -i ${SSH_KEY%.pub} ${ADMIN}@${address} docker version

Then deploy (documentation/deploy/README.md, the Azure path):
  npm run deploy:vm -- --env staging --host ${address}
The API hosts will be api.staging.${address}.sslip.io and api.${address}.sslip.io.
OUT
