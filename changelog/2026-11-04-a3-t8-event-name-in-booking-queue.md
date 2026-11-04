# The Venue Staff booking-request queue now shows each event's name (A3-T8)

**Timestamp:** 2026-11-04T11:00+08:00 (SGT)
**Author:** Joash
**Reason:** Card A3-T8 was recorded Fail: the queue named each request's event by its reference
(EVT-…) only, while the card's Expected Result says the request shows the event's name. The browser
test carried `test.fail(...)` so CI stayed green.
**Scope:** `backend/services/planning-core/src/modules/venue/api/` (booking requests, decisions,
holds), `modules/event/` (a name lookup behind its `index.ts`), `documentation/api/planning-core.openapi.yaml`,
`frontend/src/screens/BookingRequestQueue.tsx`, `frontend/src/api/bookingRequests.ts`, the A3-T8 spec and card.

## Changed

- **Booking-request responses carry `eventName`** beside `eventReference` (queue, an event's
  requests, submit, withdraw, approve and reject, and a hold's conversion). The venue module reads it
  through the event module's new `findEventLabels` in `modules/event/index.ts`, which returns the
  reference and name only; no purpose, description, contact or accessibility needs are exposed.
  `BookingRequest` in the OpenAPI file gains the required, nullable `eventName`.
- **The queue's Event cell shows the name, with the reference beneath it.** An event that can't be
  found shows a dash.
- **The A3-T8 browser test no longer expects to fail.** Its `test.fail(...)` line is removed and the
  name check is part of the Event cell assertion. The card's execution record is updated to Pass
  from the CI run on this pull request.

## Tests

- planning-core `tests/venue/api/bookingRequests.test.ts`: `eventName` on the submitted request, the
  event's own request list and the Venue Staff queue (integration; runs in CI).
- frontend `tests/bookingDecisions.test.tsx`: the queue row shows name and reference, and a dash when
  the event is missing.
