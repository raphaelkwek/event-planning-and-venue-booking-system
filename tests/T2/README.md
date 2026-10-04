# T2 — Read and manage my notifications

**Status: built in Sprint 2 (4 Oct 2026).** Notifications are created by the notification service
(EN-04.3) from the messages the outbox relay publishes (EN-04.2), about a second after the action
that raises them. T2 adds the read, unread-count and mark-as-read API on that service and the
"Notifications" screen. The cases need Kafka: see `tests/README.md`, "Standard environment".

## Where each case came from

T2-T1 to T2-T6 were split out of story cards on 2026-09-20. The trigger half of each — that the
state change emits the right message — stayed with the story that owns it:

| This case | Split from | Trigger asserted there |
|---|---|---|
| T2-T1 | B1-T5 | `event.submitted` (the notice arrives with E1's `event.coordinator-assigned`) |
| T2-T2 | D2-T7 | `event.clarification-requested` |
| T2-T3 | D3-T8 | `event.clarification-responded` |
| T2-T4 | D4-T5 | `event.approved` |
| T2-T5 | D5-T7 | `event.rejected`, carrying the reason |
| T2-T6 | E1-T2 | `event.coordinator-assigned` |

Their expected results were re-checked against T2's criteria on 4 Oct 2026 and still hold.
T2-T7 to T2-T20 were written from T2 itself that day, before the code.

## Coverage of T2's criteria

| Acceptance criterion | Cases |
|---|---|
| Each notification records the recipient, type, event reference, creation time and a message | T2-T1 to T2-T7, T2-T18 to T2-T20 |
| Only users related to the event are notified | T2-T8 |
| Created with the triggering action; none if it does not complete | T2-T9 |
| The stored record is the source of truth; no delivery time is promised | No case: nothing to observe. The screen states no timing. |
| My own notifications, newest first, with an unread count | T2-T10 |
| Marked read one at a time or all at once; read state per user | T2-T11 to T2-T13 |
| Read state persists across sessions | T2-T14 |
| Opening goes to the event; once access is lost, a message and no event data | T2-T15, T2-T16 |
| Other users' notifications are never shown | T2-T17 |

T2-T18 to T2-T20 cover E2's three notifications, which had no case before.

**Still to do in Jira:** create the Test issues T2-T1 to T2-T20. `tests/README.md` says a case's
ID is its Jira Test issue key.
