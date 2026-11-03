# G2 — Change Impact Preview: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A coordinator reviewing a pending significant change request sees which bookings and reservations approval would flag, and why, without anything being altered (SPM-31).

**Architecture:** A read-only route in the change module runs S3's `assessChangeImpact` over the event's current values overlaid with the request's proposed values, reading arrangements through the venue and equipment indexes without locks, in a `read only` transaction. The review screen reuses S3's `ChangeImpactView`.

**Tech Stack:** TypeScript, Express, porsager `postgres`, React + Atlaskit, Vitest.

**Spec:** `documentation/superpowers/specs/2026-10-29-g2-change-impact-preview-design.md`. **Branch:** `feature-raphael/g2-change-impact-preview`, stacked on `feature-raphael/s3-change-impact`.

---

## Ground rules

- Read `CLAUDE.md`, the spec, and S3's code (`git log origin/main..feature-raphael/s3-change-impact`). `PC` = `backend/services/planning-core`.
- Never touch the shared DB, never read `.env`; DB tests run only in CI. Type-check new DB tests ad hoc with a temporary tsconfig and delete it.
- Root gate before each commit: export `DATABASE_URL=postgres://ci:ci@127.0.0.1:1/ci_unused SUPABASE_URL=https://ci.invalid SUPABASE_ANON_KEY=ci-placeholder SUPABASE_JWKS_URL=https://ci.invalid/auth/v1/.well-known/jwks.json`, then `npm run lint && npm run typecheck && npm run test:unit`.
- Conventional Commits ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Stage only your files.

## Tasks

### Task 1: Cards
`tests/G2/README.md` (FX-G2) and one card per spec §4 row, in `tests/TEMPLATE.md`'s format, all Not Executed; rows in `documentation/traceability/sprint-4.csv` naming tests `G2-Tn …` in `PC/tests/change/api/g2Cards.test.ts` (G2-T1 in the web suite, G2-T8 manual). Commit `test(g2): functional test cards, before the code`.

### Task 2: Backend
- `venue/repo/arrangementFlags.ts` `bookingsForImpact(tx, eventId, options: { lock?: boolean } = {})` and `equipment/repo/reservationFlags.ts` `reservationsForImpact(...)` the same: `lock` defaults to `true` (S3 unchanged); `false` drops the `for update` clauses (use `sql` fragments, not string concatenation).
- `change/repo/changeImpact.ts`: `previewChangeImpact(tx, event, changes): Promise<ChangeImpact>` — reads both without locks, `valuesAfterChange` + `assessChangeImpact`, writes nothing. Share the "values after" / "changed fields" code with `flagArrangementsForChange` rather than copying it.
- `change/api/changeImpact.ts` (or next to S1's GET in `changeRequests.ts`, whichever reads better): `GET /api/v1/change-requests/:id/impact` — same auth and visibility as S1's GET of a change request (copy its scope handling; 404 when not visible), `sql.begin("read only", …)`; request not PENDING → 409 `ALREADY_DECIDED` with `status` and `decidedAt` (S2's refusal shape); else 200 `{ impact }` with S3's response mapping (`impactBody` from `change/api/decisions.ts` — reuse it). Register in `changeRouter`; OpenAPI path (reuse the `ChangeImpact` schema).
- AC1: check `frontend/` takes its significant-field list from `@connectsphere/contracts` (grep for `proposedStartAt` lists, `SIGNIFICANT`); if the web app has its own copy, replace it with the contracts import and add a web unit test (G2-T1).
- Tests: unit tests for anything pure; DB tests in `PC/tests/change/api/g2Cards.test.ts` for G2-T2…T7 (reuse `PC/tests/support/s3Fixtures.ts`, `venueFixtures.ts`, `lineFixtures.ts`). G2-T5 snapshots the slots, requests, reservation, both flag tables, the change request, the event and the change/event/venue/equipment outboxes before and after and compares them.
- Commits: `feat(g2): preview the arrangements a pending change would affect`, `test(g2): a test per card`.

### Task 3: Screen
- API client `getChangeImpact(token, requestId)` beside S2's decision call in `frontend/src/api/changeRequests.ts`.
- `frontend/src/screens/ReviewDetail.tsx`: for a pending change request, an "If this change is approved" section above the Approve/Reject actions, using `ChangeImpactView` (give it a prop for the empty-state wording: "No venue bookings or equipment reservations would be affected."). Loading and error states as the page's others; a 409 (request just decided) hides the section.
- Web tests: section shown with flags and reasons, empty wording, hidden for decided requests. Commit `feat(g2): show what a pending change would affect`.

### Task 4: Changelog, PR
CHANGELOG entry at the top (no migrations). Push; PR against `feature-raphael/s3-change-impact` (retarget to `main` after #69 merges), card table in the body, Claude Code line last. Record card results from the green CI run.
