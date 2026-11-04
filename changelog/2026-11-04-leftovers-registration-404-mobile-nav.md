# Registration answers an unknown route in the error envelope, its unit coverage rises to 98%, and staff navigation shows every screen on a phone

**Timestamp:** 2026-11-04T09:30+08:00 (SGT)
**Author:** Joash
**Reason:** Three leftovers from the 4 Nov compliance audit. An unknown registration route answered
Express's HTML "Cannot GET" page instead of the §5 JSON envelope. The registration service's unit
coverage was 71.28% of statements, with the seat SQL, the route handlers, the consumer and the outbox
relay tested only in CI's integration job. And on a 360 px or 375 px phone the staff navigation was a
strip with its scrollbar hidden, so 15 of an Event Coordinator's 18 screens sat past the right edge,
reachable only by an invisible swipe.
**Scope:** `backend/services/registration` (app, tests, unit config), contracts' `errorCodes.ts` and
both OpenAPI `ErrorCode` enums (one new code), `frontend/src/shell/shell.css` and a frontend test.
No migration, no route, no screen file.

## Changed

- **Registration: unknown routes.** A path no router serves now answers `404 NOT_FOUND` in the
  error envelope, from a last catch-all before the error handler. `NOT_FOUND` is a new error code, in
  its alphabetical place in `ERROR_CODES` and in both `ErrorCode` enums.
- **Registration: unit tests.** New unit tests, with a scripted stand-in for the `postgres` client
  (`tests/support/scriptedSql.ts`), cover the seat services (register, withdraw, cancel, manual add,
  waitlist), the route handlers, the waiting-room handlers, the identity client, the repositories'
  row mapping and seat SQL, the consumers' handlers and the outbox relay's passes and loop. Two
  tests of the relay loop were wrong (one spun the event loop under fake timers and ran the worker
  out of memory; one expected a second pass later than the 1 s back-off allows) and were fixed; no
  production code changed for them. Unit coverage: statements 71.28% to 98.23%, branches 97.44%,
  functions 97.19%.
- **Registration: coverage floor.** The unit config's floors rise from 53/53/75/39 (lines,
  statements, branches, functions) to 97/97/96/96, just under what the files outside `domain/` now
  reach (97.95% lines and statements, 96.83% branches, 96.22% functions). The seat-rule `domain/`
  folder keeps its 100% floor.
- **Staff navigation on a phone.** Below 960 px the rail wraps onto more rows instead of scrolling
  sideways with its scrollbar hidden, so every screen the role may open is on show, and the page
  does not scroll sideways at 360, 375 or 768 px (measured in Chromium: page width equals the
  viewport, no link past the right edge). The signed-in line wraps, so the role is no longer clipped
  behind a long email at 360 px. The CI visual baselines of every signed-in screen at 360 and 768 px
  are remade for the new rail.

## Added

- `frontend/tests/mobileNav.test.tsx`: the narrow-width rules of the stylesheet (wrapping, no hidden
  scroll strip) and every screen of the role rendered as a link in the primary navigation.

## Not changed, with the cause written down

- **Sign-in latency.** Not fixed in code. A sign-in makes two password grants to Supabase in series
  (identity's `/auth/login` makes one to learn the user, then the browser makes another for its
  token), then identity's `/permissions/check`, and only then does the landing screen load. The
  proposed fix is in the pull request: have `/auth/login` return the access token it already holds.
