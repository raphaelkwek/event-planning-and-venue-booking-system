# P2 — Inventory self-verification and functional cards

P2 (SPM-49) has five acceptance criteria in `documentation/final user stories.md`: inventory details and non-negative quantity; unavailable periods with a reason and increasing times; reservation-safe reductions; audit actor/time/quantities; and writes restricted to Technical Support Staff.

For this follow-up, independent checks were added first, run locally and on CI, and compared with the card expectations before the cards were revised. The original implementation and twelve cards already existed. The added checks do not establish that the original before-code confirmation in implementation.md §11.12 occurred; no waiver is claimed.

## Automated self-check — 8 October 2026

Tested build: `99f607366b94dc8f64741a04b96f0f076136650a`.

| Cards | Acceptance criterion | Self-check result and scope |
|---|---|---|
| P2-T1 to T3 | AC1 | Pass. The UI sends all entered attributes through the real HTTP client, preserves refused input, and displays saved/reopened details. API tests verify list/reopen persistence and no stored record for negative quantity. |
| P2-T4 to T8 | AC2 | Pass. UI checks send each card's exact period/reason, including the one-minute boundary. API tests verify the saved period and unchanged inventory/history after each invalid request. |
| P2-T9, T10, T13 | AC3 | Pass. Database tests use the 6 + 4 overlapping reservations and proposed totals 10, 9, and 11. Refusal names both events/quantities. Reservation rows remain unchanged, and refusal leaves the entire detail/history unchanged. |
| P2-T11 | AC4 | Pass. Database tests verify create 0 → 20, update 20 → 24, unavailability 0 → 3, actor and role, and timestamps within database-clock bounds. An existing UI test checks rendered history. The API test uses isolated actor IDs and equivalent data rather than the seeded user and speaker name. |
| P2-T12 | AC5 | Pass. API tests cover create, update and unavailability writes for each other active role and verify no stored changes. The UI check verifies the coordinator cannot access inventory. Actual sign-in for all four accounts remains pending. |

Evidence: [`evidence/P2-automated-2026-10-08.txt`](evidence/P2-automated-2026-10-08.txt), [CI run](https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/37661185600), and the tests themselves:

- `frontend/tests/equipmentCards.test.tsx`: eight new UI checks; real request serialization with stubbed HTTP responses.
- `frontend/tests/equipmentEditor.test.tsx`: five existing screen checks with stubbed API functions.
- `backend/services/planning-core/tests/equipment/api/inventory.test.ts`: 22 tests against CI's migrated throwaway Postgres, with JWT/actor resolution stubbed.
- `backend/services/planning-core/tests/equipment/domain/inventory.test.ts`: 17 pure-domain tests.

Local lint, typecheck, build, 56 frontend tests with coverage and 270 planning-core unit tests with coverage passed. CI passed lint/typecheck/build/unit tests, integration tests (532 planning-core and 72 notification), migration lint, secret scan and mutation testing. Frontend coverage was 77.15% lines and 80.14% branches; planning-core unit coverage was 48.79% lines and 98.15% branches. All configured thresholds passed.

## Functional execution

P2-T1 through T13 remain **Not Executed** for the full signed-in procedures. Automated checks above establish the tested portions of the expected results; they do not replace real authentication, browser interaction, the seeded accounts, or human execution evidence.

Run the standard setup in `tests/README.md`, including the equipment migration. Set the browser/system timezone to Asia/Singapore for the cards' local date/time inputs. Reset before each case and load the reservation fixture for T9, T10 and T13. After performing every step, replace that card's execution record with the observed result, tested SHA, evidence, executor and execution date.

For follow-up P2 work: create independent acceptance checks, run them, compare their results against the cards, then write or revise the cards from the acceptance criteria. Mark a full card Pass only when its stated steps and expected outcomes have actually been verified.
