# Functional test cases

One folder per user story, one file per test case. The full rules, the format, and a worked
example are in `documentation/planning/implementation.md` §8.4; this is the short version, plus the shared
setup every case refers to.

```
tests/
  README.md            this file
  TEMPLATE.md          copy this to start a new case
  fixtures/            test-data reset script
  A1/ … E2/            one folder per story
    A1-T1-sign-in-as-an-organiser.md
    evidence/          screenshots and exported responses from runs
  T2/                  a story not built yet — cases wait here, with a README saying why
```

- **ID** — `<story-id>-T<n>`, the same as the test's Jira issue.
- **Start from** `TEMPLATE.md`. The specification is written once; the execution record at the
  bottom is replaced on every run.
- **Status** is exactly one of `Pass`, `Fail`, `Not Executed`, `Blocked`. Remarks carries the
  commit SHA the run was against, the evidence file, and a defect link if it failed.
- **`Blocked` means the case should be runnable now and isn't** — a broken environment, a dependency
  that failed, something to chase today. A case for a story that hasn't been built yet is
  `Not Executed`, with the owning story and its sprint named in Remarks; it is not this sprint's
  problem and shouldn't read like one. If a case is Blocked only because part of it reaches into an
  unbuilt story, split it: the half the story owns stays and runs, the rest moves to the owning
  story's folder (see `T2/README.md` for a worked example).
- **Cover every category** for each story: happy path, story-specific cross-cutting checks,
  negative cases, and boundaries (just below, exactly at, just above).
- **Write them from the story, before the code** — never by reading the implementation.

---

## Standard environment

Every case's first pre-condition is "Standard environment running and test data reset". That means:

1. `npm install` (once).
2. `npm run migrate:identity`, `npm run migrate:event`, `npm run seed:auth` (safe to repeat).
3. `npm run dev` at the repo root, left running. It starts planning-core (the identity and event
   modules in one process, ADR-0004) and the web app in one terminal. To run them separately:
   `npm run dev -w @connectsphere/planning-core` and `npm run dev -w @connectsphere/web`.
4. **`npm run test-cases:reset`** — immediately before the case, every time.
5. Open **http://localhost:5173**. Use `localhost`, not `127.0.0.1`, which the dev server refuses.

The reset removes only requests owned by the two seeded organiser accounts, and everything attached
to them. The database is shared by the whole team, so don't reset while a teammate is mid-demo.

## Accounts

Every account uses the password **`ConnectSphere-Test-1234!`**. The sign-in screen lists them too.

The app shows people by display name; database queries and API responses show user ids.

| Account | Display name | Role | User id |
|---|---|---|---|
| `organiser@connectsphere.test` | Organiser One | Event Organiser | `00000000-0000-0000-0000-000000000001` |
| `organiser2@connectsphere.test` | Organiser Two | Event Organiser | `00000000-0000-0000-0000-000000000007` |
| `coordinator@connectsphere.test` | Coordinator One | Event Coordinator | `00000000-0000-0000-0000-000000000002` |
| `coordinator2@connectsphere.test` | Coordinator Two | Event Coordinator | `00000000-0000-0000-0000-000000000008` |
| `venuestaff@connectsphere.test` | Venue Staff One | Venue Staff | `00000000-0000-0000-0000-000000000003` |
| `techsupport@connectsphere.test` | Tech Support One | Technical Support Staff | `00000000-0000-0000-0000-000000000004` |
| `attendee@connectsphere.test` | Attendee One | Attendee | `00000000-0000-0000-0000-000000000005` |
| `deactivated@connectsphere.test` | Deactivated Organiser | Event Organiser, **deactivated** | `00000000-0000-0000-0000-000000000006` |

## Standard request

The valid request most cases start from. A case says which fields, if any, it changes.

| Field | Value |
|---|---|
| Event name | `Annual Research Symposium` |
| Purpose | `Share faculty research` |
| Description | `A one-day symposium for the school of computing.` |
| Proposed start | 2 December 2026, 14:00 |
| Proposed end | 2 December 2026, 18:00 |
| Expected attendance | `150` |
| Accessibility needs | `Step-free access to the stage` |
| Equipment is required | unticked |
| Attendee registration is required | unticked |

## Setup procedures

Pre-conditions name these. Each ends by noting the request's **id**, which is the last part of the
address bar (`#/requests/<id>`, `#/drafts/<id>` or `#/review/<id>`), and its **reference**
(`EVT-` and six digits) where it has one. Unless a case says otherwise, the request is named
`Annual Research Symposium`; where it gives a different name, use that in the Event name field.

| Name | Steps |
|---|---|
| **FX-DRAFT** | Sign in as `organiser@connectsphere.test` → "New request" → enter the Event name only → "Save draft". |
| **FX-SUBMITTED** | Sign in as `organiser@connectsphere.test` → "New request" → enter the standard request → "Submit request". Do **not** open it as a coordinator. |
| **FX-UNDER-REVIEW** | FX-SUBMITTED → sign out → sign in as `coordinator@connectsphere.test` → "Review queue" → "Open" on the request. |
| **FX-AWAITING** | FX-UNDER-REVIEW → type `Please confirm the expected attendance.` under "Ask for clarification" → "Send clarification request". |
| **FX-APPROVED** | FX-UNDER-REVIEW → "Approve". |
| **FX-REJECTED** | FX-UNDER-REVIEW → "Reject" → reason `No suitable venue is available.` → "Reject request". |
| **FX-REASSIGNMENT-PENDING** | FX-SUBMITTED → sign out → sign in as whichever of `coordinator@connectsphere.test` / `coordinator2@connectsphere.test` the "Assigned coordinator" field on the request names (E1's round-robin means either may be assigned) → open the request from the review queue → "Propose reassignment" → nominee's user id is the *other* seeded coordinator's id (see the Accounts table) → "Send proposal". Note which account is outgoing and which is the nominee — later steps refer to them by role, not by name. |
| **FX-SEEDED** | Run the FX-SEEDED statement below in the Supabase SQL editor, with the status and end time the case gives. Note the returned **id** and **reference**. Used for statuses no user action can reach yet (Confirmed needs F5). |

### FX-SEEDED statement

Replace `<STATUS>` and `<END>` with the case's values, e.g. `'CONFIRMED'` and `now() - interval '1 minute'`.

~~~sql
insert into event.events (
  reference, owner_id, name, purpose, description, proposed_start_at, proposed_end_at,
  expected_attendance, equipment_required, registration_required, status, submitted_at,
  last_saved_at, created_by, updated_by
) values (
  'EVT-' || lpad(nextval('event.event_reference_seq')::text, 6, '0'),
  '00000000-0000-0000-0000-000000000001', 'Annual Research Symposium',
  'Share faculty research', 'A one-day symposium for the school of computing.',
  <END> - interval '4 hours', <END>, 150, false, false, <STATUS>, now(), now(),
  '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001'
)
returning id, reference;
~~~

The event is owned by `organiser@connectsphere.test`, so `npm run test-cases:reset` removes it.

**The completion sweep is not scoped to your data.** `npm run jobs:complete-events` completes
*every* Confirmed event in the shared database whose end has passed, a teammate's included. That is
what the job does in production too.

## Tools a case may use

- **API console** — sign in, then "API console" in the navigation. Set Method, Path and Body, then
  "Send". It shows the HTTP status and the response body. Requests carry the signed-in user's token
  unless "Send without a token" is ticked.
- **SQL editor** — the Supabase dashboard for the project → SQL Editor. Cases give the exact query.
- **Session storage** — browser developer tools → Application → Session storage →
  `http://localhost:5173`.
