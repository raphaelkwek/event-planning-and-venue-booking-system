# EN-19-T14 — The waiting screen shows the position and wait, polls until the attendee is admitted, then registers with the token

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-19-T14 |
| Test Scenario | The waiting screen shows the position and wait, polls until the attendee is admitted, then registers with the token |
| Pre-conditions | 1. Dependencies installed (`npm ci`).<br>2. The event's page in the attendee shell; the API faked at the fetch boundary. |
| Test Steps | 1. Run `npm test -w @connectsphere/web`.<br>2. Find the tests named `EN-19-T14` in `frontend/tests/waitingRoom.test.tsx`. |
| Test Data | Register answered ADMISSION_REQUIRED; join answered WAITING at position 3; the status polled until ADMITTED with a token; the register retried with it |
| Expected Result | The attendee sees `You are in the queue`, position 3 and the estimated wait, updating on each poll. When admitted the screen registers with the token in X-Admission-Token and shows the registration. An expired token shows `Your turn has passed` with a button to join again. Polling stops when the screen closes. |
| Acceptance criterion | A frontend waiting screen on the attendee surface polls until admitted. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | jsdom component tests: the screen joined, showed position 3 and the wait, polled every 2 s, registered with X-Admission-Token when admitted and showed the registration; expiry offered a new place; polling stopped on close and survived a 429 or a dropped connection; a high-demand event's page offered the waiting room instead of Register. |
| Status | Pass |
| Remarks | Automated (UI component level, jsdom) · Commit: 4ed881d330ebe5af9151561254411ba4a5904d55 · Evidence: frontend/tests/waitingRoom.test.tsx › EN-19-T14 queues the attendee, polls until admitted, then registers with the token ; EN-19-T14 registers at once when the attendee is admitted on joining, with nobody ahead ; EN-19-T14 stops polling when the screen is closed ; EN-19-T14 says the turn has passed when the place expired while the page was away, and joins again on request ; EN-19-T14 shows the server's words when the token had expired by the time it was used, and offers a new place ; EN-19-T14 shows a refusal to join, and a failed poll offers to try again ; EN-19-T14 keeps polling through a rate limit or a dropped connection instead of ending the queue ; EN-19-T14 gives up and offers to try again after repeated poll failures, and says so ; EN-19-T14 offers to try registering again when the registration failed for a reason that may pass ; EN-19-T14 says a spent place was used, pointing to the registrations ; EN-19-T14 offers a high-demand event's attendee the waiting room instead of Register ; EN-19-T14 keeps Register for an event that is not high-demand ; EN-19-T14 sends an attendee whose plain register was refused for want of a token to the waiting room ; EN-19-T14 says the wait in words an attendee can use, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41532885735 · Defect: — · UI walk-through in Chrome pending at the sprint review |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
