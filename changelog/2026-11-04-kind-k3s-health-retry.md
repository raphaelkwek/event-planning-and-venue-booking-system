# The k3s overlay test waits for each service to reconnect to Kafka

**Timestamp:** 2026-11-04T11:20+08:00 (SGT)
**Author:** Joash
**Reason:** The deploy workflow's "kind: k3s staging overlay" job failed on about half of today's
runs (#103, #105 twice) with "registration is not ready with the database and Kafka" one second
after the migrate Job finished. Every rollout had reported Ready: a service's pods turn Ready
before its Kafka client has reconnected, because the clients first tried while Redpanda was still
starting and are backing off. The gate's `health` verb is a one-shot check, so it caught them
mid-backoff.
**Scope:** `deploy/ci/kind-k3s.sh` only. No change to the gate or to what it checks.

## Fixed

- The job asks the gate for `health` up to 12 times, 15 s apart (about 3 minutes), and the last
  answer decides. The output of the passing (or last) attempt is what the evidence table reads.
