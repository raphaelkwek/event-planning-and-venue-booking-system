# ADR-0003: No Docker; one hosted Kafka cluster shared by the team

**Status:** Accepted
**Date:** 2026-09-18

## Context

`plan.md` §2 said the system runs locally under Docker Compose now and in the cloud later, and
§8 said everything runs from one `docker-compose.yml`. In practice nobody ran it. Every service,
test suite and the web app ran with `npm run dev` / `npm test` against the team's hosted Supabase
project; the compose file started only the Identity and Event services, and no npm script, test or
README step used it. It was never discussed as a team decision — the 14 Sep meeting agreed
"everything localhost" for now, and Docker Compose first appears in `plan.md` afterwards.

What Docker *would* have provided is a broker. ADR-0001 makes asynchronous messaging through Apache
Kafka the default, and no Kafka runs anywhere yet: outbox rows accumulate unpublished. Kafka does not
need Docker, but running it on six laptops without Docker means installing Java on each, and on
Windows effectively running it inside WSL, because Kafka's Windows scripts are not officially
supported. Docker Desktop is the same kind of per-laptop setup cost that this decision removes.

## Decision

**The project does not use Docker.** Services and the web app run as plain Node processes, started
together with `npm run dev` at the repo root. The Dockerfiles and `docker-compose.yml` are removed.

**Kafka is one hosted cluster, shared by the whole team.** Every service reaches it through
`KAFKA_BROKERS` with TLS and SASL credentials from `.env` (`KAFKA_SASL_MECHANISM`,
`KAFKA_SASL_USERNAME`, `KAFKA_SASL_PASSWORD`). Kafka stays the messaging system; ADR-0001 and the
message format in `implementation.md` §3 are unchanged. The provider is not yet chosen — see
Consequences.

## Alternatives considered

- **Keep Docker Compose and run Kafka in it.** One command gives every laptop an identical broker.
  Rejected because it makes Docker Desktop a prerequisite for everyone for the sake of one
  component, when the database and auth are already hosted.
- **Install Kafka natively on each laptop.** No Docker and no third-party account. Rejected because
  it needs Java everywhere and WSL on Windows, and six local brokers mean six different sets of
  topics — a message published on one laptop never reaches a service running on another.
- **Replace Kafka with Supabase Queues (`pgmq`) on the existing Supabase project.** No new
  infrastructure at all. Rejected because a queue message goes to one reader, so a publisher would
  have to know every subscriber and write to each one's queue. That breaks the "publish, don't call"
  decoupling of `plan.md` §5, and would overturn a messaging decision the team made on 14 Sep.
- **One teammate runs Kafka and the rest connect to it.** Rejected: it works only while that laptop
  is on and reachable, which is fine for a demo and fragile for daily work.

## Consequences

- **Setup is `npm install`, a filled-in `.env`, and `npm run dev`.** No Docker Desktop, no Java.
- **Kafka is shared, so isolation is by convention.** Two people running the same consumer at once
  are in the same consumer group and split its partitions; a test that publishes can be consumed by
  a teammate's running service. Consumer group ids and any test topics must be named so they do not
  collide — decide this before the first consumer is written.
- **A third-party account and its limits.** Hosted Kafka free tiers and trial credits change and are
  usually capped on topics, partitions or throughput. `implementation.md` §3.1 uses one topic per
  event type plus a log and a dead-letter topic per service, which is dozens of topics. Choose the
  provider against that count, against lasting the whole semester, and against client support for
  its SASL mechanism. The provider is an open item in `implementation.md`'s appendix until chosen.
- **Kafka becomes a network dependency.** Under CP (ADR-0001) an unreachable broker must not make
  a service accept a write it cannot publish; the transactional outbox already covers this, because
  the relay retries unpublished rows. `/readyz` should report the broker unreachable.
- **No container images.** Cloud deployment, when it comes, builds each service from its
  `package.json` (build, then `npm run start -w <service>`), which Node platforms support directly.
  If a platform later needs an image, a Dockerfile can be added then for that platform alone.
- **The Week 13 "independently deployable" argument** in ADR-0001 rests on separate workspaces,
  separate processes on fixed ports, separate schemas and separate start commands rather than on
  separate images. Be ready to say so.
