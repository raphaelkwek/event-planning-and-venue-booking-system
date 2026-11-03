# EN-05 spike: change data capture and a schema registry

**Author:** Joash
**Date:** 3 Nov 2026 (SGT)
**Jira:** EN-05 (SPM-123). The card asks for a spike first, then, if both answers are yes, Debezium's
outbox router in place of the polling relay and a CI check of backward compatibility against a schema
registry.
**Method:** documentation and registry metadata only. Nothing here was run against the team's
Supabase project, which this work must not touch (CLAUDE.md, EN-06). Every claim below links to the
page it comes from, and what could not be checked is listed at the end.

## Decision

1. **The polling relay (EN-04) stays the publisher in every environment.** Debezium does not replace
   it. Development cannot run it at all, and for staging and production the one thing that would
   prove it, a replication slot on a Free-plan Supabase project reached over IPv6 from the Oracle
   node, has not been tried. Until it has been, replacing a working publisher with an untried one is
   the wrong trade.
2. **Debezium Server is built, but opt-in.** It is a kustomize component
   (`deploy/k8s/components/cdc`) that the deployment can include for staging and production. CI runs
   it against a throwaway Postgres and a throwaway Redpanda and checks that it puts the same message
   on Kafka as the relay does, for every message type. That proves the outbox router configuration. It
   does not prove Supabase will give it a slot.
3. **The schema-compatibility check is built and runs on every pull request.** It compares each
   message's JSON Schema with the one on the base branch, using the rules Confluent's and Redpanda's
   registries use. A second CI job asks a real Redpanda Schema Registry the same question and fails if
   it disagrees. See "The schema registry" below for what that does and does not cover.

ADR-0008 and `implementation.md` §3.4 now say the same.

## Question 1: does Supabase allow a logical replication slot for an external Debezium connector?

**Yes in principle, with conditions that matter on the Free plan. Not verified here.**

| Finding | Source |
|---|---|
| Supabase supports Postgres logical replication to external consumers. Its guide for building your own consumer creates a publication and a slot with `select pg_create_logical_replication_slot('example_slot', 'pgoutput')`. | [Replicate to another Postgres database](https://supabase.com/docs/guides/database/postgres/setup-replication-external), [Database replication](https://supabase.com/docs/guides/database/replication) |
| Third-party tools are documented against it: Airbyte, Estuary, Fivetran, Materialize, Stitch and AWS DMS. **Debezium is not named** by Supabase, and the parts of Debezium's PostgreSQL connector page read for this spike do not name Supabase. The connector needs only `pgoutput`, which Postgres always has. | [Manual replication setup](https://supabase.com/docs/guides/database/replication/manual-replication-setup), [Debezium PostgreSQL connector](https://debezium.io/documentation/reference/stable/connectors/postgresql.html) |
| The role is `postgres`. Below Postgres 17 it must be `postgres`; from 17, `postgres` can create a role `WITH REPLICATION`. Debezium needs `REPLICATION` and `LOGIN` for the slot, `CREATE` on the database for a publication, and ownership of each captured table. | Same two Supabase pages; [Debezium](https://debezium.io/documentation/reference/stable/connectors/postgresql.html) |
| **A replication connection must be a direct connection.** Supabase's own guide says "Use a direct connection, not a Connection Pooler", and the shared pooler (Supavisor) is IPv4 only. | [Replicate to another Postgres database](https://supabase.com/docs/guides/database/postgres/setup-replication-external), [Connecting to Postgres](https://supabase.com/docs/guides/database/connecting-to-postgres) |
| **The direct connection is IPv6 only unless the IPv4 add-on is bought.** The add-on is "Pro Plan and above" and about $4 a month. GitHub Actions is among the platforms that accept only IPv4. | [IPv4 address](https://supabase.com/docs/guides/platform/ipv4-address), [Manage IPv4 usage](https://supabase.com/docs/guides/platform/manage-your-usage/ipv4), [IPv4 and IPv6 compatibility](https://supabase.com/docs/guides/troubleshooting/supabase--your-network-ipv4-and-ipv6-compatibility-cHe3BP) |
| For third-party replication tools Supabase **recommends** an instance of XL or greater and the IPv4 add-on. Both are paid. This is a recommendation, not a stated requirement. | [Manual replication setup](https://supabase.com/docs/guides/database/replication/manual-replication-setup) |
| A slot keeps WAL until its consumer confirms it. The docs give no default for `max_slot_wal_keep_size`, `-1` means unlimited, and it (like `max_replication_slots`) can be changed only through the Supabase CLI. A stalled consumer therefore fills the disk. The Free plan includes 500 MB of database. | [Database replication](https://supabase.com/docs/guides/database/replication), [Custom Postgres config](https://supabase.com/docs/guides/database/custom-postgres-config), [Pricing](https://supabase.com/pricing) |
| Slots must be dropped before a major-version upgrade. Free projects are paused after a week of inactivity; the docs do not say whether a slot survives a pause and restore. | [Upgrading](https://supabase.com/docs/guides/platform/upgrading), [Pricing](https://supabase.com/pricing) |
| The Free plan allows two active projects. Development, staging and production are three. | [Pricing](https://supabase.com/pricing) |

No page restricts logical replication to a paid plan, and none says the Free plan supports it. The
only way to settle that is to create a slot on the staging project.

## Question 2: can our Kafka run Kafka Connect, or something equivalent?

**Development: no. Staging and production: yes, with Debezium Server instead of Connect.**

| Environment | Kafka | Connect? | Source |
|---|---|---|---|
| Development | Aiven free plan | **No.** "Aiven for Apache Kafka Connect" is listed as unavailable on the free tier, which also has 5 topics and 250 KiB/s. Karapace, its schema registry, is included. | [Aiven free tier](https://aiven.io/docs/products/kafka/free-tier/kafka-free-tier) |
| Development, from the cutover | Confluent Cloud trial | A managed *PostgreSQL CDC Source V2 (Debezium)* connector exists and its page mentions the EventRouter, but it may need "public access" to the database and an allow-list of Confluent's egress IPs. Its pages say nothing about IPv6, so a Free-plan direct host cannot be assumed reachable. It would also bill against a trial that ends within a day of the Week 13 Q&A, and it would be pointed at the shared database. | [Connector](https://docs.confluent.io/cloud/current/connectors/cc-postgresql-cdc-source-v2-debezium/cc-postgresql-cdc-source-v2-debezium.html), [Egress IPs](https://docs.confluent.io/cloud/current/connectors/static-egress-ip.html), ADR-0008 decision note |
| Staging, production | Redpanda in the cluster | No Connect. **Debezium Server** runs the same connector without Kafka Connect, with a Kafka sink and SMTs, including the outbox `EventRouter`. Its image is a multi-architecture manifest (amd64 and arm64), so it runs on the Oracle node. Redpanda Connect's `postgres_cdc` input is the other option, but it "requires an enterprise license". | [Debezium Server](https://debezium.io/documentation/reference/stable/operations/debezium-server.html), [Outbox event router](https://debezium.io/documentation/reference/stable/transformations/outbox-event-router.html), [quay.io/debezium/server](https://quay.io/repository/debezium/server), [Redpanda Connect postgres_cdc](https://docs.redpanda.com/redpanda-connect/components/inputs/postgres_cdc/) |

### Reaching Supabase from the Oracle node

The Debezium pod has to open a replication connection to Supabase's IPv6-only direct host. That needs
two things this spike could not check, because the node does not exist yet in the form it will have:

- **The node needs outbound IPv6.** On OCI the VCN must have an IPv6 prefix, the route table a `::/0`
  rule to the internet gateway, and the security list an IPv6 egress rule. The page does not say
  whether egress is allowed by default. ([OCI IPv6](https://docs.oracle.com/en-us/iaas/Content/Network/Concepts/ipv6.htm))
- **The pod needs to use it.** k3s is single-stack IPv4 unless dual-stack was configured when the
  cluster was created, and pods that have no routable IPv6 address cannot receive replies. The component
  therefore runs with `hostNetwork: true`, so the pod uses the node's own address. ([k3s networking](https://docs.k3s.io/networking/basic-network-options))

The alternative is the IPv4 add-on, which needs the Pro plan.

## The schema registry

- **Staging and production** run Redpanda, whose registry is built in, supports JSON Schema, and
  defaults to `BACKWARD` compatibility. A registration that breaks the level is refused.
  ([Schema Registry API](https://docs.redpanda.com/current/manage/schema-reg/schema-reg-api/))
- **Development** has Aiven's Karapace, but nothing in the repository registers schemas there, and a
  pull request's CI cannot reach the team's cluster.
- So the project has **no registry server that CI can ask on every pull request**. What was built
  instead:
  1. `contracts` generates a JSON Schema file for the CloudEvents envelope and for each message type's
     `data` (30 files, committed). A test fails if they drift from the zod schemas.
  2. `npm run schemas:compat -- --base <ref>` compares them with the files at the base ref, using the
     rules the two registries share: the new schema must accept every message the old one did. It
     fails closed: a keyword it does not understand is a finding, not a pass. It runs in the
     *Message schema compatibility* job on every pull request.
  3. A second job starts a throwaway Redpanda in CI and asks its real registry about a table of
     compatible and incompatible changes, and about this branch's schemas against the base branch's.
     The registry's answers must equal the checker's.
- **This meets the card's third criterion in spirit.** The check is real and gates every pull request,
  but the registry it consults is a throwaway container, not the long-lived registry of a deployed
  environment. Registering schemas in the staging cluster's registry is a deployment step that was not
  built.
- **Limits of a JSON Schema snapshot:** it cannot see zod refinements (the envelope's `actor` format)
  or a date-time's millisecond precision. A change to those is not checked.
- Redpanda's registry supports internal `$ref` at every compatibility level and does not support
  references to another subject ([Schema Registry overview](https://docs.redpanda.com/current/manage/schema-reg/schema-reg-overview/)).
  The generated schemas are fully inlined, so neither matters.

## What is built, and what is not

| | Built | Not built |
|---|---|---|
| Spike | This document, ADR-0008 note, `implementation.md` §3.4 | A run against a real Supabase project |
| Debezium | Component with the outbox router, a CI proof against a throwaway Postgres and Redpanda, manifests validated by kustomize and kubeconform | A run on the Oracle node; a run against Supabase; removing the relay |
| Schema check | Generated schema files, checker, command, pull-request job, Redpanda cross-check | Registering the schemas in a deployed registry |

### Before CDC replaces the relay anywhere

1. On the staging project: confirm a slot can be created over the direct connection from the node
   (`nc -6 -zv db.<ref>.supabase.co 5432` from a pod with `hostNetwork`), and that Debezium starts.
2. Set `max_slot_wal_keep_size` with the Supabase CLI to a value well under the disk, and alert on the
   slot's retained WAL.
3. Decide how an outbox row is marked published. Debezium never updates the row, so `published_at`
   stays null and the relay's backlog count stops meaning anything. A sweep that marks rows older than
   the slot's confirmed position would restore it. Deleting rows is not an option: no `DELETE`
   (`implementation.md` §11).
4. Cut over by starting Debezium first, keeping the relay on until its backlog is empty, then
   switching the relay off. Both publishing for a short while is harmless: consumers deduplicate on
   the CloudEvent id.

## Sources

Supabase: [Database replication](https://supabase.com/docs/guides/database/replication) ·
[Manual replication setup](https://supabase.com/docs/guides/database/replication/manual-replication-setup) ·
[Replicate to another Postgres database](https://supabase.com/docs/guides/database/postgres/setup-replication-external) ·
[Connecting to Postgres](https://supabase.com/docs/guides/database/connecting-to-postgres) ·
[IPv4 address](https://supabase.com/docs/guides/platform/ipv4-address) ·
[Manage IPv4 usage](https://supabase.com/docs/guides/platform/manage-your-usage/ipv4) ·
[IPv4 and IPv6 compatibility](https://supabase.com/docs/guides/troubleshooting/supabase--your-network-ipv4-and-ipv6-compatibility-cHe3BP) ·
[Custom Postgres config](https://supabase.com/docs/guides/database/custom-postgres-config) ·
[Upgrading](https://supabase.com/docs/guides/platform/upgrading) ·
[Pricing](https://supabase.com/pricing)

Debezium: [Server](https://debezium.io/documentation/reference/stable/operations/debezium-server.html) ·
[Outbox event router](https://debezium.io/documentation/reference/stable/transformations/outbox-event-router.html) ·
[PostgreSQL connector](https://debezium.io/documentation/reference/stable/connectors/postgresql.html) ·
[Image](https://quay.io/repository/debezium/server)

Kafka providers and registries: [Aiven free tier](https://aiven.io/docs/products/kafka/free-tier/kafka-free-tier) ·
[Confluent PostgreSQL CDC Source V2](https://docs.confluent.io/cloud/current/connectors/cc-postgresql-cdc-source-v2-debezium/cc-postgresql-cdc-source-v2-debezium.html) ·
[Confluent egress IPs](https://docs.confluent.io/cloud/current/connectors/static-egress-ip.html) ·
[Redpanda Schema Registry API](https://docs.redpanda.com/current/manage/schema-reg/schema-reg-api/) ·
[Redpanda Connect postgres_cdc](https://docs.redpanda.com/redpanda-connect/components/inputs/postgres_cdc/)

Hosting: [OCI IPv6](https://docs.oracle.com/en-us/iaas/Content/Network/Concepts/ipv6.htm) ·
[k3s networking](https://docs.k3s.io/networking/basic-network-options)

## Not checked

- Whether a Free-plan project accepts a slot, and its `max_replication_slots`. No page states it.
- Whether the Oracle node will have outbound IPv6. The deployment branch decides.
- Whether Confluent's connector egress addresses include IPv6.
- Whether a Supabase slot survives a project pause and restore.
- Debezium's own behaviour against Supabase. Debezium's pages do not mention Supabase, and Supabase's do
  not mention Debezium. [Redis's guide for Supabase](https://redis.io/docs/latest/integrate/redis-data-integration/data-pipelines/prepare-dbs/supabase/)
  describes the same `pgoutput` slot and `REPLICATION` role on Supabase (and says Supavisor does not
  support logical replication), which is adjacent evidence only.
