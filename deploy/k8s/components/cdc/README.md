# Debezium Server for the outbox (EN-05)

**Status: opt-in, and not yet run against Supabase.** The polling relay in planning-core is the
publisher everywhere. This component is the alternative that
`documentation/spikes/EN-05-cdc-spike.md` found possible only for staging and production, and only if
the checks below pass. Author: Joash.

## What it is

Debezium Server reads the outbox tables from Postgres's write-ahead log through a logical replication
slot and publishes each new row to Kafka. It needs no Kafka Connect. Its outbox router turns a row into
the Kafka message the relay would have sent: the row's `topic`, `message_key` as the key, and the
CloudEvent in `envelope` as the value, with the CloudEvents `content-type` header. The whole
configuration is `application.properties`.

## What CI proves, and what it does not

- `backend/scripts/cdc-parity-check.ts` starts this exact image and `application.properties` against a
  throwaway Postgres (`wal_level=logical`) and Redpanda, writes one message of every type into the
  outbox tables, and requires Kafka to hold what the relay's `prepareRow` produces: topic, key, value
  and header. It also checks per-event ordering and that an `UPDATE` publishes nothing.
- `kubectl kustomize` and kubeconform check that `deploy/k8s/test/cdc` renders into valid objects.
- **Not proven:** that Supabase gives a Free-plan project a slot, that the Oracle node reaches
  Supabase's IPv6 address, or that the pod starts with the node's network. Nothing here has touched the
  team's Supabase project.

## Use it

In the overlay that should publish through CDC:

```yaml
components:
  - ../../components/cdc
```

Create the Secret by hand. It is not in Git and it is not `connectsphere-secrets`, because the
replication connection is a **direct** connection (a pooler cannot replicate):

```bash
kubectl -n <namespace> create secret generic connectsphere-cdc \
  --from-literal=CDC_DB_HOST=db.<project-ref>.supabase.co \
  --from-literal=CDC_DB_USER=postgres \
  --from-literal=CDC_DB_PASSWORD='<database password>' \
  --from-literal=CDC_DB_NAME=postgres
```

Kafka settings come from `connectsphere-secrets` (`KAFKA_BROKERS`, `KAFKA_SASL_USERNAME`,
`KAFKA_SASL_PASSWORD`). In-cluster Redpanda without authentication needs nothing more; for SCRAM set
`KAFKA_SECURITY_PROTOCOL` (`SASL_PLAINTEXT`) in the overlay. Pin the image by digest with the overlay's
`images`.

## Before you switch it on

1. From the node, a `hostNetwork` pod can reach the project: `nc -6 -zv db.<ref>.supabase.co 5432`. The
   Free plan's direct host is IPv6 only; the node needs a VCN IPv6 prefix, a `::/0` route and an egress
   rule.
2. The `postgres` role can create the slot and the publication on that project, and owns the outbox
   tables.
3. `max_slot_wal_keep_size` is set with the Supabase CLI to a value well under the disk, and the slot's
   retained WAL is watched. An unconsumed slot keeps WAL until the disk is full.
4. Know how a row is marked published. Debezium never updates a row, so `published_at` stays null and
   the relay's backlog count stops meaning anything.

## Cut over from the relay

1. Start this component. It creates the slot and streams rows written from then on.
2. Leave the relay running until its backlog is empty (`select count(*) from <schema>.outbox where
   published_at is null`), then stop it: remove `KAFKA_*` from planning-core's environment. Both
   publishing for a while is harmless, because consumers deduplicate on the CloudEvent id.

## Switch it off

**Drop the slot**, or Postgres keeps WAL for a consumer that is gone:
`select pg_drop_replication_slot('connectsphere_outbox');`, then re-enable the relay first so no row
waits.

## Adding an outbox

Add its table to `debezium.source.table.include.list` and restart the pod: the publication is built at
start-up.
