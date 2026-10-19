# S2 — Decide a Change Request: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The assigned coordinator approves (applying the change, with field history) or rejects (with a reason) a pending change request; the organiser is notified (SPM-58).

**Architecture:** `change/0002–0003` add the decision columns. `decideChangeRequest` (change module) locks the request, then the event through `event/index.ts`, re-checks an approval with S1's `checkProposedChange`, and calls the event module's new `applyApprovedChange`, which writes the event and its FIELD_CHANGE history (the version trigger bumps `version`). Messages `change-request.approved|rejected` go on the event topic.

**Tech Stack:** TypeScript, Express, porsager `postgres`, zod, Vitest + supertest, React + Atlaskit.

**Spec:** `documentation/superpowers/specs/2026-10-18-s2-decide-change-request-design.md`. **Branch:** `feature-raphael/s2-decide-change-request`, stacked on `feature-raphael/s1-change-request` (#45).

---

## Ground rules for every task

- Read `CLAUDE.md`, `documentation/planning/implementation.md`. `PC` = `backend/services/planning-core`.
- **Never** run migrations or writes against the shared DB, never point race tests at it, never read `.env`. DB tests run only in CI.
- Before each commit, from the repo root: `export DATABASE_URL=postgres://ci:ci@127.0.0.1:1/ci_unused SUPABASE_URL=https://ci.invalid SUPABASE_ANON_KEY=ci-placeholder SUPABASE_JWKS_URL=https://ci.invalid/auth/v1/.well-known/jwks.json`, then `npm run lint && npm run typecheck && npm run test:unit` (the root unit gate runs every workspace with coverage, as CI does). Type-check new test files ad hoc with a temporary tsconfig and delete it.
- Conventional Commits ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Stage only your files.
- jsonb: send JSON as `${JSON.stringify(v)}::text::jsonb` (casting a parameter straight to jsonb makes the driver encode it twice — S1's bug).
- Patterns: S1's change module (`src/modules/change/**`, `tests/change/**`), `event/repo/eventHistory.ts` (`recordFieldChanges`), D5's reject dialog in the frontend.

## File map

| File | Responsibility |
|---|---|
| `tests/S2/README.md`, `tests/S2/S2-T*.md` | 12 cards, FX-S2 |
| contracts `errorCodes.ts` + OpenAPI enum | `CHANGE_REQUEST_NOT_FOUND`, `CHANGE_REQUEST_ALREADY_DECIDED`, `CHANGE_REQUEST_NO_LONGER_VALID` |
| contracts `changeRequestEvents.ts` | `change-request.approved`, `change-request.rejected` |
| notification `recipients.ts` (+ tests) | two organiser rules |
| `PC/migrations/change/0002_change_request_decisions.sql`, `0003_validate_change_request_decisions.sql` | decision columns + check |
| `PC/src/modules/event/repo/proposedChange.ts` (new) or `repo/events.ts`, `event/domain/proposedChange.ts`, `event/index.ts` | `applyApprovedChange`, `historyText` |
| `PC/src/modules/change/domain/changeRequests.ts` | `validateDecisionBody` |
| `PC/src/modules/change/repo/changeRequests.ts` | decision columns, `lockRequest`, `recordDecision` |
| `PC/src/modules/change/repo/decisions.ts` (new) | `decideChangeRequest` |
| `PC/src/modules/change/api/decisions.ts` (new), `change/index.ts` | the route |
| tests: `tests/change/domain`, `tests/change/repo/decisions.test.ts`, `tests/change/api/s2Cards.test.ts`, `tests/race/invariants.test.ts`, `tests/event/domain/proposedChange.test.ts` | |
| frontend `api/changeRequests.ts`, `components/PendingChangeNotice.tsx`, `screens/ReviewDetail.tsx`, `screens/RequestDetail.tsx`, tests | Approve/Reject, outcomes |
| OpenAPI, `sprint-3.csv`, `CHANGELOG.md` | docs |

---

### Task 1: Cards (before any code)

`tests/S2/README.md` and the 12 cards from spec §7, in exactly the layout of `tests/S1/` (read `tests/S1/README.md` and `tests/S1/S1-T1-request-records-snapshot.md`). FX-S2 = FX-S1 plus actor C2 (coordinator, not assigned to E1) plus CR1: ORG's pending request on E1 made through `POST /api/v1/events/<E1>/change-requests` with `{"reason":"Keynote speaker arrives late","changes":{"proposedStartAt":"D 15:00","expectedAttendance":180}}`. Decision calls are `POST /api/v1/change-requests/<CR1>/decision` as C1 unless stated.

Expected results (exact):

| Card | Body / action | Expected result |
|---|---|---|
| `S2-T1-approve-applies-and-records-history.md` | `{"decision":"APPROVE"}` | 200; `changeRequest.status` APPROVED, decidedBy C1, decidedAt between the instants around the request, rejectionReason null; `GET /api/v1/events/<E1>` shows start `D 15:00`, end `D 18:00`, attendance 180 and a version one higher than before; E1's history has exactly two new FIELD_CHANGE entries: `proposedStartAt` `D 14:00` → `D 15:00` and `expectedAttendance` `150` → `180`, each by C1 (EVENT_COORDINATOR) with a timestamp within the request. |
| `S2-T2-reject-keeps-the-event.md` | `{"decision":"REJECT","reason":"The hall is booked until 15:30"}` | 200; REJECTED, decidedBy C1, decidedAt, rejectionReason as sent; E1 still `D 14:00` and 150, equal to CR1's snapshots; version unchanged; no new FIELD_CHANGE entry. |
| `S2-T3-reject-needs-a-reason.md` | REJECT with no reason, `""`, `"   "` | 400 `VALIDATION_FAILED` on `reason` each; CR1 PENDING with null decidedBy/decidedAt; E1 unchanged. |
| `S2-T4-decided-request-cannot-be-decided-again.md` | approve then approve again; (fresh FX-S2) reject then approve | 409 `CHANGE_REQUEST_ALREADY_DECIDED` naming Approved / Rejected and when, `details` `{status, decidedAt}`; the first decision and E1 unchanged. |
| `S2-T5-only-the-assigned-coordinator.md` | as C2, ORG, TS, VS; as C1 on an unknown request id | 403 `ROLE_NOT_AUTHORISED` each (C2 because not assigned; the others by role); unknown id 404 `CHANGE_REQUEST_NOT_FOUND`; CR1 still PENDING. |
| `S2-T6-approval-rechecks-the-values.md` | CR1's proposed start set to now − 1 day directly in the database; approve; then reject with a reason | approve 409 `CHANGE_REQUEST_NO_LONGER_VALID` with `details.fields` naming `changes.proposedStartAt`; CR1 still PENDING, E1 unchanged; the reject then returns 200 REJECTED. |
| `S2-T7-approval-refused-once-event-cancelled.md` | E1 set to CANCELLED directly; approve | 409 `CHANGE_REQUEST_NO_LONGER_VALID`; CR1 PENDING; E1 unchanged. |
| `S2-T8-organiser-notified.md` | approve (fresh fixture: reject with reason) | one `change-request.approved` (resp. `.rejected`) message in `change.outbox` keyed by E1 on the event topic, addressed to ORG; through the notification service's recipient rule, one notification for ORG containing E1's reference and "start, expected attendance" (approved) or the rejection reason (rejected). |
| `S2-T9-new-request-after-a-decision.md` | approve; then ORG posts a new request (attendance 200) | 201 PENDING; a third request then gets 409 `CHANGE_REQUEST_ALREADY_PENDING`. |
| `S2-T10-stale-details-edit-refused.md` | read E1's ETag; approve; ORG sends G1's details edit with the old `If-Match` | 412 `EVENT_VERSION_MISMATCH`; E1's details unchanged. |
| `S2-T11-approve-reject-race.md` | 50 simultaneous decisions on one pending request, half approve half reject, 10 rounds (CI throwaway Postgres only) | exactly one fulfilled per round; every other returns ALREADY_DECIDED; the request has one decision; FIELD_CHANGE entries exist only if that decision was APPROVE. |
| `S2-T12-decide-in-the-browser.md` | Standard environment, `KAFKA_*`, migrations; two Approved requests of the seeded organiser each with a pending change request | Browser: coordinator → review page → "Approve" → confirm on the first; "Reject" → empty reason → "Reject change" → enter `No larger hall` → "Reject change" on the second; organiser → both requests and Notifications | Approve applies and the notice shows "Change approved on …"; empty reason refused inline; reject shows "Change rejected on …: No larger hall"; no Approve/Reject on decided requests; the organiser sees both outcomes and two notifications. |

Commit `test(s2): write the S2 cards and fixture FX-S2 before the code`. **STOP — show Raphael the cards.**

---

### Task 2: Contracts, notification rules, migrations

- [ ] Error codes appended to `ERROR_CODES` and the OpenAPI `ErrorCode` enum in the same order (a unit test on main holds them equal): `CHANGE_REQUEST_NOT_FOUND`, `CHANGE_REQUEST_ALREADY_DECIDED`, `CHANGE_REQUEST_NO_LONGER_VALID`.
- [ ] In `changeRequestEvents.ts`:

```ts
const decided = {
  eventId: z.string().uuid(),
  eventReference: z.string(),
  eventName: z.string(),
  ownerId: z.string().uuid(),
  changeRequestId: z.string().uuid(),
  fields: z.array(z.enum(SIGNIFICANT_EVENT_FIELDS)).min(1),
  decidedBy: z.string().uuid(),
  decidedAt: z.string().datetime(),
};
export const changeRequestApprovedPayloadSchema = z.object(decided);
export const changeRequestRejectedPayloadSchema = z.object({ ...decided, reason: z.string().min(1) });
```

and add both to `CHANGE_REQUEST_PAYLOAD_SCHEMAS`. Contracts tests: each accepted when valid; rejected without `reason` refused.
- [ ] `recipients.ts` rules, both to `d.ownerId`:
  - approved: `Your change request for ${event} was approved: ${joinLabels(d.fields)}.`
  - rejected: `Your change request for ${event} was rejected. Reason: ${d.reason}`
  Tests assert the full sentences.
- [ ] `PC/migrations/change/0002_change_request_decisions.sql`: add `decided_by uuid`, `decided_at timestamptz`, `rejection_reason text`; add constraint `change_requests_decision_recorded` with the spec §3 check, `not valid`. `0003_validate_change_request_decisions.sql`: `alter table change.change_requests validate constraint change_requests_decision_recorded;`. Squawk both.
- [ ] Root gate. Commit `feat(s2): decision codes, messages, notification rules and columns`.

### Task 3: Event module — apply an approved change

- [ ] `event/domain/proposedChange.ts`: add `historyText(field, value): string | null` — instants as UTC ISO, numbers and booleans via `String`, the requirements as `JSON.stringify`, null as null. Unit tests for each kind.
- [ ] `event/repo` (beside `findEventForChange`'s SQL): let the locked read take `lock: "share" | "update"` (S1's `lock: true` becomes `"share"`; update S1's caller). Add:

```ts
/** S2 — writes an approved change's values and one FIELD_CHANGE entry per field (AC3). The version trigger bumps `version`. */
export async function applyApprovedChange(
  tx: TransactionSql,
  event: { id: string; current: ChangeableEvent },
  changes: ProposedChanges,
  actor: { userId: string; role: string },
): Promise<void>
```

It updates only the columns present in `changes` (map: proposedStartAt→proposed_start_at, proposedEndAt→proposed_end_at, expectedAttendance→expected_attendance, venueRequirements→venue_requirements (jsonb via `::text::jsonb`), equipmentRequired→equipment_required, equipmentRequirements→equipment_requirements (jsonb)), sets `updated_at = now(), updated_by`, then `recordFieldChanges(tx, id, fields.map(f => ({ fieldName: f, previousValue: historyText(f, event.current[f]), newValue: historyText(f, changes[f]) })), actor, "CHANGE_REQUEST_APPROVED")`. Check `triggering_action` has no check constraint that refuses the new value (migrations/event); if it does, use the closest permitted value and report it. Export from `event/index.ts`.
- [ ] Repo test (CI only) `tests/event/repo/applyApprovedChange.test.ts`: values written, version +1, two history rows with the expected text. Root gate. Commit `feat(s2): the event module applies an approved change`.

### Task 4: Change module — decide

- [ ] Domain: `validateDecisionBody(raw)` → `{ ok: true, decision: "APPROVE" } | { ok: true, decision: "REJECT", reason } | { ok: false, fields }`: `decision` must be APPROVE or REJECT (`decision`: "Choose Approve or Reject."); REJECT needs a reason, trimmed, ≤ 1000 (`reason`: "Give a reason for rejecting the change."). 100% unit tests.
- [ ] Repo `changeRequests.ts`: add the three columns to the record (`decidedBy`, `decidedAt`, `rejectionReason`); `lockRequest(tx, id)` (`for update`, returns the record or null); `recordDecision(tx, id, { status, actorId, reason })` setting status, `decided_by`, `decided_at = clock_timestamp()`, `rejection_reason`, `updated_*`.
- [ ] `change/repo/decisions.ts` — `decideChangeRequest(tx, requestId, decision, actor)` per spec §4, returning `{ ok: true, request, event? } | { ok: false, code: "NOT_FOUND" | "ALREADY_DECIDED" | "NOT_ASSIGNED" | "NO_LONGER_VALID", … }`. The event lookup uses the actor's scope (`resolveAccessScope(role, userId, "events")`); an event outside scope → NOT_FOUND. Writes the outbox message for the outcome (to the event's owner) only on success.
- [ ] Route `change/api/decisions.ts`: `POST /api/v1/change-requests/:id/decision`, limiter, `authenticate`, `requireRole("EVENT_COORDINATOR")`; non-UUID → 404 `CHANGE_REQUEST_NOT_FOUND`; body validated before `sql.begin`; outcome mapping per spec §5 with an exhaustive `default`. Mount in `changeRouter`. OpenAPI: the path, `ChangeRequestDecision` body, `ChangeRequest` gains `decidedBy`, `decidedAt`, `rejectionReason` (nullable, required) — in the same commit so the route-documentation test stays green.
- [ ] Repo tests (CI only) `tests/change/repo/decisions.test.ts`: approve applies, reject keeps, already decided, not assigned, no longer valid. Root gate. Commit `feat(s2): decide a change request`.

### Task 5: Card tests and race

- [ ] `tests/change/api/s2Cards.test.ts` modelled on `s1Cards.test.ts` (actor prefix `0c200000`): one `it("S2-Tn …")` per card T1–T10 asserting each card's Expected Result exactly; T8 via `parseCloudEvent` + `notificationsFor`; T10 via G1's details route with `If-Match`.
- [ ] Race `"S2-T11 …"` in `tests/race/invariants.test.ts` (throwaway-only describe, cleanup in `finally`): per round a fresh event + pending request; `race(ATTEMPTS, (tx, i) => decideChangeRequest(tx, id, i % 2 ? approve : reject, C1))`.
- [ ] Eslint and ad hoc type-check both files. Commit `test(s2): a test per card and the decision race`.

### Task 6: Screens

- [ ] `frontend/src/api/changeRequests.ts`: `decideChangeRequest(token, id, body)` → POST `/event/api/v1/change-requests/<id>/decision`; types gain the decision fields.
- [ ] Tests first (`frontend/tests/changeRequest.test.tsx`): the assigned coordinator sees Approve and Reject on a pending request, others don't; Approve confirm lists before → after and posts `{decision:"APPROVE"}`; Reject dialog with empty reason shows the server's `reason` error inline; reject posts the reason; a decided request shows its outcome and no buttons; the organiser sees "Change approved on …" / "Change rejected on …: <reason>" and the "Request a change" button again.
- [ ] Implement in `PendingChangeNotice` (or a `ChangeRequestNotice` that handles all three states) and the two screens; reuse D5's reject dialog component if one exists. Web suite, typecheck, eslint. Commit `feat(s2): approve or reject a change from the review page`.

### Task 7: Traceability, changelog, PR, results

- [ ] `sprint-3.csv` S2 rows (AC1 → T4, T5, T9, race; AC2 → T3; AC3 → T1; AC4 → T2; AC5 → T8; AC6 → T4 and the web test), exact test names.
- [ ] CHANGELOG entry at the top: Added/Changed; "Before using it on the shared database": `npm run migrate -- change` applies 0002–0003; deploy the notification service with planning-core (unknown types are dead-lettered).
- [ ] Root gate; push; open the PR with base `feature-raphael/s1-change-request` ("S2: decide a change request"), body with cards, migration/deploy notes, "stacked on #45 — retarget to main after it merges", and the Claude Code line last.
- [ ] When CI is green, fill card execution records from that run (S2-T12 Not Executed until the shared DB is migrated); commit and push.
