#!/usr/bin/env bash
# ADR-0016 amendment: the Space's entrypoint. It checks the settings the Space's secrets provide,
# derives the in-container ones, makes the broker's certificate and Kafka user (Redpanda's disk is
# the container's, so this happens at every start), picks where Temporal keeps its state, runs the
# migrations against the session pooler, and only then starts every process under supervisord. It
# prints variable names, never values.
set -euo pipefail

missing=()
for name in DATABASE_URL MIGRATE_DATABASE_URL SUPABASE_URL SUPABASE_ANON_KEY CORS_ALLOWED_ORIGINS; do
  [ -n "${!name:-}" ] || missing+=("$name")
done
if [ "${#missing[@]}" -gt 0 ]; then
  echo "start.sh: the Space has no ${missing[*]} (set them as Space secrets or variables; deploy-space.mjs does)" >&2
  exit 1
fi

RUN=/tmp/cs
mkdir -p "$RUN/redpanda/data" "$RUN/tls" "$RUN/caddy"
cp /app/deploy/space/redpanda.yaml "$RUN/redpanda/redpanda.yaml"
cp /app/deploy/space/bootstrap.yaml "$RUN/redpanda/.bootstrap.yaml"

# The broker's TLS, from a CA that lives as long as this container.
(
  cd "$RUN/tls"
  openssl req -x509 -newkey rsa:2048 -nodes -days 3650 -subj "/CN=connectsphere-space-ca" -keyout ca.key -out ca.crt 2> /dev/null
  openssl req -newkey rsa:2048 -nodes -subj "/CN=localhost" -keyout tls.key -out tls.csr 2> /dev/null
  printf 'subjectAltName=DNS:localhost,IP:127.0.0.1\nextendedKeyUsage=serverAuth\n' > tls.ext
  openssl x509 -req -in tls.csr -CA ca.crt -CAkey ca.key -CAcreateserial -days 825 -extfile tls.ext -out tls.crt 2> /dev/null
  rm -f ca.key tls.csr tls.ext
)

# In-container settings: the same KAFKA_*, TEMPORAL_* and CERBOS_URL the services read anywhere.
KAFKA_SASL_PASSWORD="$(openssl rand -hex 24)"
export KAFKA_SASL_PASSWORD
export KAFKA_BROKERS=127.0.0.1:9092 KAFKA_SASL_MECHANISM=scram-sha-256 KAFKA_SASL_USERNAME=connectsphere
export KAFKA_SSL_CA_PATH="$RUN/tls/ca.crt"
export RP_BOOTSTRAP_USER="connectsphere:${KAFKA_SASL_PASSWORD}"
export TEMPORAL_ADDRESS=127.0.0.1:7233 TEMPORAL_NAMESPACE=default TEMPORAL_TASK_QUEUE=planning-core
export CERBOS_URL=http://127.0.0.1:3592 PLANNING_CORE_URL=http://127.0.0.1:8090
export PLANNING_CORE_PORT=8090 NOTIFICATION_PORT=8091 REGISTRATION_PORT=8092
export SUPABASE_JWKS_URL="${SUPABASE_JWKS_URL:-${SUPABASE_URL}/auth/v1/.well-known/jwks.json}"
export LOG_LEVEL="${LOG_LEVEL:-info}" XDG_DATA_HOME="$RUN/caddy" XDG_CONFIG_HOME="$RUN/caddy"
# Redpanda reserves this much memory up front. 1G suits a Space; two environments on one small VM
# set 512M in their env files (deploy/azure).
export REDPANDA_MEMORY="${REDPANDA_MEMORY:-1G}"

# Temporal's state (EN-11): its workflows and timers. The Azure VM's deploy gate mounts a named
# volume per environment here, so they survive a redeploy; the image owns the directory to uid 1000.
# Without a volume (a Space) the directory is the container's own and goes with it. Either way the
# worker re-creates every timer when it starts, and sweeps.sh completes and expires what is overdue.
TEMPORAL_STATE_DIR=/var/lib/connectsphere/temporal
if [ -d "$TEMPORAL_STATE_DIR" ] && [ -w "$TEMPORAL_STATE_DIR" ]; then
  export TEMPORAL_DB_FILE="$TEMPORAL_STATE_DIR/temporal.db"
else
  echo "start.sh: ${TEMPORAL_STATE_DIR} is not writable by uid $(id -u); Temporal keeps its state in ${RUN} instead, which a redeploy loses" >&2
  export TEMPORAL_DB_FILE="$RUN/temporal.db"
fi
if [ -s "$TEMPORAL_DB_FILE" ]; then
  echo "start.sh: Temporal's state: ${TEMPORAL_DB_FILE}, kept from the last container"
else
  echo "start.sh: Temporal's state: ${TEMPORAL_DB_FILE}, new"
fi

# Supabase's transaction pooler listens on 6543, which a Space's egress may not allow. If it cannot
# be reached, the services use the session pooler (5432), as the migrations do.
reachable() { # <postgres URL>
  node -e '
    const u = new URL(process.argv[1]);
    const s = require("node:net").connect({ host: u.hostname, port: Number(u.port || 5432), timeout: 5000 });
    s.on("connect", () => { s.destroy(); process.exit(0); });
    s.on("timeout", () => process.exit(1));
    s.on("error", () => process.exit(1));
  ' "$1"
}
if ! reachable "$DATABASE_URL"; then
  echo "start.sh: DATABASE_URL's host and port are not reachable from here; the services use MIGRATE_DATABASE_URL (the session pooler) instead"
  export DATABASE_URL="$MIGRATE_DATABASE_URL"
fi

echo "start.sh: migrations (MIGRATE_DATABASE_URL)"
if ! (cd /app && DATABASE_URL="$MIGRATE_DATABASE_URL" node migrate.mjs all > "$RUN/migrate.log" 2>&1); then
  echo "start.sh: the migrations failed:" >&2
  tail -20 "$RUN/migrate.log" >&2
  exit 1
fi
echo "start.sh: migrations applied: $(grep -c '^apply ' "$RUN/migrate.log" || true) files"

echo "start.sh: starting the services, the sweeps, Redpanda, Temporal, Cerbos and Caddy on :7860"
exec supervisord -c /app/deploy/space/supervisord.conf
