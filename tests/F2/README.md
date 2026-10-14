# F2 — View an event's current status and history

Nine cases, written from the story on 12 Oct 2026, before the code.

| Acceptance criterion | Cases |
|---|---|
| The current status is shown on the event detail screen for every user permitted to view the event | F2-T1, F2-T2, F2-T3, F2-T6, F2-T8 |
| Internal roles (organiser for their own event, assigned coordinator, coordinators generally) see the full status history | F2-T1, F2-T2, F2-T3, F2-T9 |
| Attendees see the current status only, never the history, review comments or rejection reasons | F2-T4 |
| History entries are chronological, each showing previous status, new status, acting user's role and timestamp | F2-T5, F2-T6 |
| History entries cannot be edited or deleted from any screen | F2-T7 |

F2-T6 is the boundary of a single entry. Attendees have no events in scope yet (their A3 rule, "published and open to
registration", has no records to match until registration exists), so F2-T4 can show the refusals but not an attendee
reading a status; the API returns the status alone for them once that scope lands.
