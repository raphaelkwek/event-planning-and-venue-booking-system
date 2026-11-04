# ConnectSphere: README, code repository and instructor access

ConnectSphere handles a university campus's event requests, venue and equipment booking, safety
review and attendee registration. It is the IS212 project of a six-person team at Singapore
Management University.

**Git repository:** https://github.com/joass1/event-planning-and-venue-booking-system

The repository holds the whole software release: `frontend/` (the web app), `backend/` (the
planning-core, registration and notification services, and the shared contracts), `tests/` (the
test cards and browser tests), `documentation/`, and the CI/CD pipeline in `.github/workflows/`
(`ci.yml`, `release.yml`, `codeql.yml`, `deploy.yml`, `mutation.yml` and others). Its `README.md`
starts with a table of where to find each part of the submission, then says how to run the system.

## Try it without installing anything

| | |
|---|---|
| Staging | https://connectsphere-staging.vercel.app, with demonstration data. The sign-in page lists the test accounts; all use the password `ConnectSphere-Test-1234!`. |
| Production | https://connectsphere-is212.vercel.app, the same release with no demonstration data and no test accounts. |
| CI and deployment runs | https://github.com/joass1/event-planning-and-venue-booking-system/actions |

Test accounts on staging, one per role:

| Email | Role |
|---|---|
| `organiser@connectsphere.test` | Event Organiser |
| `coordinator@connectsphere.test` | Event Coordinator |
| `lead@connectsphere.test` | Event Coordinator Lead |
| `safety@connectsphere.test` | Safety Officer |
| `venuestaff@connectsphere.test` | Venue Staff |
| `techsupport@connectsphere.test` | Technical Support |
| `attendee@connectsphere.test` | Attendee |

## What is in this zip

| Folder | Holds |
|---|---|
| 1. Product Backlog | The Jira export (`.xlsx` and `.json`). |
| 2. System Design (C4) | The C4 model, the ER, domain and state diagrams with an index of what each shows, the ADRs, the operations screenshots and the Operations Evidence PDF. |
| 3. Test Cases | The test cards, the traceability rows, the unit and end-to-end test-script workbooks, and the coverage statement. |
| 4. Sprint Meetings | The Sprint 1 to 4 documents, the Sprint 4 meeting scripts, the Week 11 slides, the Sprint Velocity and Burndowns PDF, and the links to the final sprint's recordings. |
| 5. Slide Deck | The slide deck as a PDF. |
| 6. Software Release | The repository's source at the submitted commit, without `node_modules`. Its `README.md` says how to run it. |
| 7. README and Git Access | This file. |

`MANIFEST.md`, at the top of the zip, lists every part and whether it is present.

## Running it

The repository's `README.md` gives the full steps. In short, with Node 20:

```bash
npm ci
npm run migrate:all     # every schema, with the identity seeds
npm run dev             # the services, the policy decision point and the web app on http://localhost:5173
```

These need the team's hosted Supabase and Kafka credentials in `.env`. Without them, the
repository's README describes how to run the services and the browser tests the way CI does, on a
throwaway local Postgres with a fake sign-in server (`npm run test:e2e`).

## Instructor access

Both instructors must be able to open the repository. Granting it is a GitHub settings action
(repository, Settings, Collaborators) that only the owner can do, so it is recorded here once
done. The builder reports this part as `placeholder` until no `TODO` is left below.

| Instructor | GitHub username | Access granted on |
|---|---|---|
| Instructor 1 | TODO | TODO |
| Instructor 2 | TODO | TODO |

## Rebuilding the submission zip

```bash
npm ci
npm run backlog:export -- <raw Jira search results>   # only to refresh the backlog snapshot
npm run submission:build -- --deliverables "<folder with sprint docs, scripts, slides>" --zip-dir "<output folder>"
```
