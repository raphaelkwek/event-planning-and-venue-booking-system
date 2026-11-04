# Staging dry run, the rest: the Lead, the Safety Officer and Technical Support are told of new work, and the low defects D5 to D12 are fixed

**Timestamp:** 2026-11-04T15:01+08:00 (SGT)
**Author:** Joash
**Reason:** The 4 Nov browser dry run of staging left D3 (missing notifications) and eight low
defects (D5 to D12) after #111. Joash recorded the team's decision to build D3 ("complete
everything"), since the brief's notification requirement (Week 4, core feature 20) covers it:
team decision D-02 in `documentation/clarifications.md`. Everything is fixed test first.
**Scope:** contracts (`event.submitted`, `event.arrangements-confirmed`, the new
`equipment-request.line-submitted`, regenerated JSON Schemas), planning-core `identity`, `event`,
`equipment` and `venue` modules, the notification service's rules, the registration service's
register answer, the frontend (review page, both equipment screens, attendee event page, venue
search, All events, My requests, the organiser's request page, Outstanding flags, inventory
history, the API client and `Refusal`), the OpenAPI files, the stories E3, U1, O1 and T2, cards
E3-T9, U1-T17, O1-T27 and F5-T19, and traceability. No migration, no new route, no new error code.

## Added

- **D3, D-02: the Lead, the Safety Officer and Technical Support are notified of work entering
  their queues.** As for every notification, the message names its recipients (implementation.md
  §3.5); the producer reads the active holders of the role through the identity module's new
  `listActiveUserIdsWithRole`, inside the transaction that writes the message.
  - E3: `event.submitted` names every active Lead (`leadIds`); each is told "Event request … was
    submitted and is waiting in your unassigned queue to be assigned a coordinator." (E3-T9)
  - U1: `event.arrangements-confirmed` names every active Safety Officer (`safetyOfficerIds`);
    each is told the event is waiting in their Safety Review queue, after F5's recipients (U1-T17).
    The confirm-arrangements dialog now says the Safety Officers are notified.
  - O1: saving equipment lines writes one new `equipment-request.line-submitted` per line, keyed by
    the line, naming every active Technical Support member; each is told the equipment, quantity and
    when it is needed (O1-T27). Nobody to tell writes no message, as for L1's Venue Staff.
  - Both new fields are optional, so messages written before D-02 still read and notify nobody new
    (`schemas:compat`: two changed compatibly, one new, none breaking). Opening a notification takes
    a Lead to the assignment page and a Safety Officer to the safety review.

## Fixed

- **D5, a free-text facility emptied the prefilled venue search.** The prefill now leaves out of the
  filters a facility no venue records (matched ignoring case), returns it in `unmatchedFacilities`,
  and the screen says so beside the accessibility note.
- **D6, "Loading…" or a stale table after an action.** The review page shows Approve's or Reject's
  own answer at once and refreshes the rest quietly (every reload after an action is quiet); the
  coordinator's equipment table shows saved, edited and removed lines from each answer; Technical
  Support's list shows a status change, a reservation and a release from each answer.
- **D7, the attendee's places count was stale after registering.** The browse listing may be cached
  for five seconds (EN-12), so `POST /registrations` now answers with `placesRemaining`, read live,
  and the page shows it; a refusal for capacity shows the event as full.
- **D8, Planning, Safety Review and Confirmed events showed the approval banner.** The decision banner
  shows only on Approved or Rejected events.
- **D9, raw ids.** An equipment reservation in Outstanding flags is "Equipment reservation, <type>",
  and the inventory history names the acting user.
- **D10, "Failed to fetch" beside "No requests yet".** The API client turns a request that never
  reached a service, or a success that is not the service's JSON, into one plain error; `Refusal`
  titles it "Couldn't reach ConnectSphere"; My requests and All events show one error with Try
  again in place of the list.
- **D11, All events had no search or filter.** It searches by part of the name or reference,
  ignoring case, and filters by status; both stay in the address.
- **D12, the organiser saw only the latest change outcome.** The request page lists every change
  request's outcome, newest first, under "Change requests".

## Changed

- `F5-T19` sets the Safety Officers aside (U1-T17 checks them), and its card says so.
- `equipmentAvailability.test.tsx` expects the plain unreachable message instead of the raw fetch
  error (D10).
