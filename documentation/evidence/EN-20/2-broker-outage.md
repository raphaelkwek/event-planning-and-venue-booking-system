# Experiment 2: a broker outage loses no notifications

**Status:** Run in CI (Toxiproxy and Redpanda): the pass condition held
**Card:** EN-20-T2 · **Run:** https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41533430275 · **Commit:** `faf5ebc` · **Date:** 2026-11-03

## Hypothesis

With Kafka unreachable, registrations still commit and their messages wait in the outbox. When Kafka is back, every message is
published once, and the notification service stores exactly one notification per registration.

## Injection

The real registration outbox relay and the real notification consumers (`startConsumers`) reach a Redpanda broker only through
Toxiproxy. The test switches the Toxiproxy proxy off (20 s; the design says 10 minutes), registers 50 attendees
by calling the service's `register` function against the throwaway Postgres, waits out the outage, and switches the proxy on.
Test: `chaos/experiments/02-broker-outage.test.ts`. Staging manifest, not applied:
[`deploy/chaos/02-kafka-unreachable.yaml`](../../../deploy/chaos/02-kafka-unreachable.yaml).

## Pass condition

Writes commit during the outage. After it, each message is on the topic exactly once and each registration has exactly one notification.

## Actual result

| Observation | Value |
|---|---|
| Registrations that committed with the broker down | 50 of 50 |
| Outbox rows still pending at the end of the outage | 50 |
| Of those, rows the relay had tried and failed to send | 50 |
| The relay's recorded error | `Connection error: connect ECONNREFUSED 127.0.0.1:29092` |
| Seconds from the broker coming back to the outbox being empty | 13.0 |
| Seconds from the outbox being empty to all notifications stored | 0.5 |
| Messages for these registrations on the topic | 50 (50 distinct message ids) |
| Notifications stored | 50 (50 from distinct messages) |

The hypothesis held. The wait after the broker returned is the relay's own back-off: it doubles from 1 s up to 30 s after each failed pass, so a
longer outage would make the first retry later, by at most 30 s.

**What this does not show:** a 10-minute outage (the relay's behaviour is the same, the back-off just stays at its 30 s cap); the Confluent
cluster's own behaviour (Redpanda stands in, over plaintext and without SASL); a broker that accepts a send but loses it (the relay publishes
with `acks: -1` and marks the row only after the broker answers).

Run: https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41533430275

## Fix log

None needed. The experiment found no defect. Observation, not a defect: the notification freshness objective (99% visible within 10 s of the commit)
cannot hold while the broker is down; the run shows the delay is bounded by the outage plus up to 30 s.
