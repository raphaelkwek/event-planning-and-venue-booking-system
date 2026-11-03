# Experiment 5: duplicate delivery is harmless

**Status:** Run in CI (Toxiproxy and Redpanda): the pass condition held
**Card:** EN-20-T5 · **Run:** https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41533430275 · **Commit:** `faf5ebc` · **Date:** 2026-11-03

## Hypothesis

Delivering a message again, however many times and whatever the cause, changes nothing: the seat builder builds an event's seats once however often its approval arrives, and the notification service stores one notification per
registration however often the registration message arrives (the inbox, ADR-0008).

## Injection

The real consumers of both services run against Redpanda, reaching it only through Toxiproxy: the registration service's `seat-builder` and `event-listings`, and the notification service's `event-notifier` and `retry-worker`.
The messages go through once. Toxiproxy then resets every connection for 3 s (`reset_peer`), and every message on the event, venue-booking and registration topics is published again, twice
(44 messages in all): the topics end up carrying every message three times. Test: `chaos/experiments/05-duplicate-delivery.test.ts`.

## Pass condition

After the consumers have caught up (their committed offsets equal each topic's end), the event has exactly the seats its approval asked for, there is one notification per registration, and the inboxes hold each message id once.

## Actual result

| Observation | Before the replays | After the replays |
|---|---|---|
| Topic end offsets (event, venue-booking, registration) | [1, 1, 20] | [3, 3, 60] |
| Seats of the event built from the approval (free) | 20 (20) | 20 (20) |
| Notifications for the registrations (from distinct messages) | 20 (20) | 20 (20) |
| Inbox rows, registration / notification | 2 / 21 | 2 / 21 |

The hypothesis held. The offsets show the topics really did carry three copies of each message and the consumers really did read them (they only count as caught up once their committed offsets reach the end).

**What this does not show:** an in-flight crash between a handler's commit and the offset commit (the inbox makes that harmless by the same argument, but it was not injected); the notification retry and dead-letter topics, which are covered by their own tests (EN-04.3).

Run: https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41533430275

## Fix log

None needed. The experiment found no defect.
