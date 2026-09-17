# Functional test cases

One folder per user story, one file per test case. The full rules, the format, and a worked
example are in `documentation/planning/implementation.md` §8.4; this is the short version, plus the shared
setup every case refers to.

```
tests/
  README.md            this file
  TEMPLATE.md          copy this to start a new case
  fixtures/            test-data reset script
  A1/ … D5/            one folder per story
    A1-T1-sign-in-as-an-organiser.md
    evidence/          screenshots and exported responses from runs
```

- **ID** — `<story-id>-T<n>`, the same as the test's Jira issue.
- **Start from** `TEMPLATE.md`. The specification is written once; the execution record at the
  bottom is replaced on every run.
- **Status** is exactly one of `Pass`, `Fail`, `Not Executed`, `Blocked`. Remarks carries the
  commit SHA the run was against, the evidence file, and a defect link if it failed.
- **Cover every category** for each story: happy path, story-specific cross-cutting checks,
  negative cases, and boundaries (just below, exactly at, just above).
- **Write them from the story, before the code** — never by reading the implementation.

---

## Standard environment

Every case's first pre-condition is "Standard environment running and test data reset". That means:

1. `npm install` (once).
2. `npm run migrate:identity`, `npm run migrate:event`, `npm run seed:auth` (safe to repeat).
3. Three terminals, left running:
   - `npm run dev -w @connectsphere/identity-service`
   - `npm run dev -w @connectsphere/event-service`
   - `npm run dev -w @connectsphere/web`
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

## Tools a case may use

- **API console** — sign in, then "API console" in the navigation. Set Method, Path and Body, then
  "Send". It shows the HTTP status and the response body. Requests carry the signed-in user's token
  unless "Send without a token" is ticked.
- **SQL editor** — the Supabase dashboard for the project → SQL Editor. Cases give the exact query.
- **Session storage** — browser developer tools → Application → Session storage →
  `http://localhost:5173`.
