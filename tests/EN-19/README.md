# EN-19 — Virtual waiting room

EN-19 is an enabler. Its criterion (Jira plan, §5): **admission tokens for events flagged
high-demand, at the tested rate.** The cards below run as vitest commands (the browser ones as
jsdom component tests); the database ones need a migrated Postgres, which CI provides.

| Acceptance criterion | Cards |
|---|---|
| An organiser can mark an event high-demand; it is an event field published on `event.listing-changed` | EN-19-T1, T2, T3, T15 |
| For a high-demand event the register route requires a short-lived signed admission token, refused with a clear code without one | EN-19-T4, T5, T8, T9, T10 |
| A waiting-room endpoint admits N per second per event, and gives each attendee a queue position and an estimated wait | EN-19-T6, T7, T12 |
| The waiting-room endpoint is rate limited before authentication | EN-19-T11 |
| A frontend waiting screen on the attendee surface polls until admitted | EN-19-T14 |
| N comes from the tested rate (EN-18: 500 requests per second overall) and is configurable | EN-19-T13 |

**What the cards do not prove.**
- **The rate under load.** T6 proves the queue hands out admission times no closer than 1/N seconds,
  by construction and with 500 simultaneous joins. Whether the registration service really sustains
  N admitted attendees a second per event is EN-18's measurement; EN-18 has not reported yet, so
  N = 100 is derived from its 500 requests per second target, not from a result.
- **Browsers.** T14 and T15 run in jsdom with the API faked. A walk-through in Chrome is pending at
  the sprint review.
- **Through the gateway.** The waiting-room routes are public routes of EN-12's gateway
  (`tests/EN-12/`); the gateway's own per-address limit sits in front of the service's.
