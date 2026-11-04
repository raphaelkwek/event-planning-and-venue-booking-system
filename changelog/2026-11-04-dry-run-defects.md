# Staging dry run: the change preview counts registrations, a safety decision confirms itself, and a cancelled event's equipment lines are marked released

**Timestamp:** 2026-11-04T15:00+08:00 (SGT)
**Author:** Joash
**Reason:** A browser dry run of staging on 4 Nov found four medium defects (D1 to D4 in the run's
report). Each is fixed test first; D3 (missing notifications) is not a defect of any story and is
recorded as a gap below.
**Scope:** `frontend` (review page, safety review, equipment requests, `Refusal`), planning-core
`equipment` (the request-line list) and `event` (a status read), the OpenAPI description of both.
No migration. D5 to D12 are untouched.

## Fixed

- **D1, the change impact said "Registrations: 0" with two attendees registered.** Planning-core
  cannot count registrations (the registration service owns them, ADR-0005), so the impact body
  always carried 0 and the screen printed it. The review page now asks the registration service
  (`GET /registration/api/v1/events/{id}/registrations`, `totals.registered`) for the real count, for
  both the preview and an approval's impact. If the service does not know the event the count is 0;
  if it fails the page says "Registrations: couldn't be loaded from the registration service" instead
  of a false 0. `activeRegistrations` in the impact body is documented as not a count.
- **D2, a raw red `STATUS_TRANSITION_NOT_PERMITTED` after "Request changes".** The safety review
  screen re-read the review after every decision, but a request for changes or a rejection returns
  the event to Planning, and the review of an event that is not in Safety Review answers 409. The
  screen now shows the outcome from the decision's own response ("Changes requested" or "Safety
  arrangement rejected") and does not re-read. Refusals on this screen are titled in words ("That
  can't be done right now") with the server's message; `Refusal` takes a `plain` option for this.
  Other screens still show the code; the browser test cards assert it.
- **D4, a cancelled event's equipment line stayed Confirmed with Update and Reserve.** F4 releases
  the reservations on cancel but leaves the line's own status. The request-line list now carries
  each line's `eventStatus` (read through the event module, `findEventStatuses`), and Technical
  Support's screen shows "Released: event cancelled" and no actions for a Cancelled event's lines.

## Not changed: D3, notifications

No story or change request asks for these, so none was added: the Event Coordinator Lead told of a
new unassigned submission (E3 and CR-05 notify the assigned coordinator and the organiser on
assignment, not the Lead on submission); the Safety Officer told when an event enters Safety Review
(F5 notifies the organiser, Venue Staff and Technical Support; U1 puts the event in the Safety
Officer's queue and notifies the coordinator and organiser of a decision); Technical Support told of
new equipment lines (O1 makes the lines visible to them; O2 notifies the coordinator of a change).
Each is a product decision for the team.
