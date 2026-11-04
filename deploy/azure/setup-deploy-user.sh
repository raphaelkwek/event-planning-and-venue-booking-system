#!/usr/bin/env bash
# ADR-0016 amendment (Azure): set up the VM for the Release workflow. Run once, as the admin user,
# with the gate and the two deploy keys' public halves copied next to it:
#
#   scp deploy/azure/connectsphere-vm-deploy deploy/azure/setup-deploy-user.sh vm-deploy-*.pub azureuser@<ip>:
#   ssh azureuser@<ip> sudo bash setup-deploy-user.sh vm-deploy-staging.pub vm-deploy-production.pub
#
# It makes a cs-deploy user (no password, in the docker group) whose authorized_keys let the staging
# key run only `connectsphere-vm-deploy staging ...` and the production key only `... production ...`,
# installs the gate, and makes /etc/connectsphere shared by the admin user (deploy:vm, the manual
# fallback) and cs-deploy, through a connectsphere group. Running it again changes nothing.
set -euo pipefail
[ "$(id -u)" -eq 0 ] || { echo "run with sudo" >&2; exit 1; }
STAGING_KEY="$(cat "${1:?the staging deploy key (.pub)}")"
PRODUCTION_KEY="$(cat "${2:?the production deploy key (.pub)}")"
HERE="$(cd "$(dirname "$0")" && pwd)"
ADMIN="${SUDO_USER:-azureuser}"
USER_NAME=cs-deploy
for key in "$STAGING_KEY" "$PRODUCTION_KEY"; do
  [[ "$key" =~ ^ssh-ed25519\ [A-Za-z0-9+/=]+( .*)?$ ]] || { echo "each key must be one ssh-ed25519 public key line" >&2; exit 2; }
done
[ "$STAGING_KEY" != "$PRODUCTION_KEY" ] || { echo "staging and production need different keys" >&2; exit 2; }

groupadd -f connectsphere
id "$USER_NAME" > /dev/null 2>&1 || useradd --create-home --shell /bin/bash --comment "ConnectSphere deploy gate" "$USER_NAME"
passwd --lock "$USER_NAME" > /dev/null
usermod -aG docker,connectsphere "$USER_NAME"
usermod -aG connectsphere "$ADMIN"

install -d -m 2770 -o root -g connectsphere /etc/connectsphere
chgrp -R connectsphere /etc/connectsphere
find /etc/connectsphere -type f -name '*.env' -exec chmod 660 {} +
install -m 0755 "${HERE}/connectsphere-vm-deploy" /usr/local/bin/connectsphere-vm-deploy

home="$(getent passwd "$USER_NAME" | cut -d: -f6)"
install -d -m 0700 -o "$USER_NAME" -g "$USER_NAME" "$home/.ssh"
{
  echo "# Written by deploy/azure/setup-deploy-user.sh. Each key may only run the gate for its environment."
  echo "command=\"/usr/local/bin/connectsphere-vm-deploy staging\",restrict ${STAGING_KEY}"
  echo "command=\"/usr/local/bin/connectsphere-vm-deploy production\",restrict ${PRODUCTION_KEY}"
} > "$home/.ssh/authorized_keys"
chown "$USER_NAME:$USER_NAME" "$home/.ssh/authorized_keys"
chmod 0600 "$home/.ssh/authorized_keys"
echo "cs-deploy is set up: the staging key runs only the staging gate, the production key only the production gate"
