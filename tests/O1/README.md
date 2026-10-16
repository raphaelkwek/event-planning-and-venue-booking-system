# O1 — Record the equipment an event requires

Twenty-six cases, written from the story on 10 Oct 2026, before the code. Cases T1 to T25 are API-level
procedures (HTTP requests with authentication stubbed, against a migrated throwaway Postgres), so an
automated test can perform exactly their steps. T26 is the signed-in browser walk-through.

| Acceptance criterion | Cases |
|---|---|
| A request is made of line items; each records equipment type, quantity, technical notes, required-from and required-to | O1-T1, O1-T2, O1-T26 |
| Times default from the event and stay editable; required-to must be later than required-from | O1-T1, O1-T3, O1-T4, O1-T5, O1-T6, O1-T26 |
| Quantity is a whole number greater than zero | O1-T7, O1-T8, O1-T9 |
| On save each line is Submitted, visible to Technical Support, and records the coordinator and timestamp | O1-T1, O1-T2, O1-T11, O1-T12 |
| The assigned coordinator may edit or remove a line while Submitted or Under Review; a Reserved line cannot be edited or removed | O1-T13, O1-T14, O1-T15, O1-T16, O1-T18, O1-T19, O1-T20, O1-T21, O1-T22 (removal of a Reserved line amended by Q2: it is removed and its reservation released — Q2-T8) |
| Removing a line records the acting user, timestamp, equipment type and quantity | O1-T18, O1-T19 |
| A rejected save creates or changes no line item | O1-T4, O1-T5, O1-T7, O1-T9, O1-T10, O1-T17, O1-T23, O1-T24, O1-T25 |

Boundaries: quantity 0 (T7) and 1 (T8); required-to equal to (T4), before (T5) and one minute after (T6) required-from.

## Fixture FX-O1 (API level)

| Name | Value |
|---|---|
| D | the date 60 days after the day of the run (the event must be in the future) |
| E1 | event in status Approved, owned by ORG, with an active assignment to C1; proposed start `D 14:00` UTC, end `D 18:00` UTC |
| CHAIRS | bulk equipment type `O1 Folding Chairs`, total 50 |
| PROJECTORS | bulk equipment type `O1 Projectors`, total 5 |
| C1 | `EVENT_COORDINATOR`, assigned to E1 |
| C2 | `EVENT_COORDINATOR`, not assigned to E1 |
| ORG | `EVENT_ORGANISER`, owner of E1 |
| TS | `TECH_SUPPORT_STAFF` |
| VS | `VENUE_STAFF` |
| ATT | `ATTENDEE` |

No line exists for E1 at the start of a case unless the case's pre-conditions create one. Cases that need a line in
a status no user action can reach yet (Reserved, Removed) set the status directly in the database; reservation is Q1 (Sprint 3).

## Isolated automated setup

Use CI's `Integration tests (throwaway Postgres)` job. To reproduce it locally, use a throwaway local Postgres database
(never the shared Supabase database), set `DATABASE_URL` to it with the CI placeholder Supabase variables, then run
`npm ci`, `npm run migrate:all` and
`npm test -w @connectsphere/planning-core -- tests/equipment/api/o1Cards.test.ts`. The fixture owns only its own actor ids and rows
and cleans them up.

## Execution

A card is `Pass (automated, API level)` only after the named test in `o1Cards.test.ts` ran and passed in CI; the record then cites the
commit, test and CI run. T26 needs a browser, the real sign-in and the team's seeded accounts, and stays Not Executed until it is run at the sprint review.
