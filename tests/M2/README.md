# M2 — Reject a venue booking request

Seven cases, written from the story on 18 Oct 2026, before the code. They use FX-BOOKING
(`tests/L1/README.md`) and the requests L1 raises.

| Acceptance criterion | Cases |
|---|---|
| Rejection requires a reason of at least one non-whitespace character; without it the request stays Pending and no rejection timestamp is recorded | M2-T1 |
| Suggested alternative dates or venues may optionally be recorded with the rejection | M2-T3 |
| On rejection the request becomes Rejected; the reason, approver and timestamp are recorded and shown to the requesting coordinator | M2-T2 |
| The venue remains available for the period, and the request leaves the pending state on the calendar | M2-T4 |
| The requesting coordinator and the owning organiser are notified, with the reason and any suggested alternative | M2-T5 |
| The event's own status is unchanged, and the coordinator can submit a further request | M2-T6 |

M2-T7 checks that only the venue's own Venue Staff can reject, and only a pending request.

The suggested alternative is free text: a date, a period, another venue, or several.
