# Feature flags (EN-15)

planning-core evaluates feature flags through [OpenFeature](https://openfeature.dev) with the
[flagd](https://flagd.dev) provider. There is one flag today, `change-approval`. It gates S2's
**Approve** action: with the flag off, an approval is refused on the server with `403
FEATURE_DISABLED`, and the web app disables the button. **Reject** stays available, because it
changes nothing on the event and a pending request has only those two exits.

## Where the answer comes from

The service picks the first source that applies when it starts (`src/shared/flags/flags.ts`):

| Order | Source | When | Notes |
|---|---|---|---|
| 1 | A running flagd | `FLAGD_HOST` is set | Evaluated by flagd over gRPC. `FLAGD_PORT` (default 8013), `FLAGD_TLS`, `FLAGD_SERVER_CERT_PATH` and the other `FLAGD_*` variables are read by the provider. |
| 2 | A flag file in flagd's format | No `FLAGD_HOST` and the file exists | `FLAGD_OFFLINE_FLAG_SOURCE_PATH`, or the committed [`flags/flags.flagd.json`](../flags/flags.flagd.json). Evaluated in the process. Edits are picked up within about five seconds. |
| 3 | The defaults in the code | Neither | `src/shared/flags/definitions.ts`. |

A flag also takes its default from `definitions.ts` whenever the source can't answer: flagd is
unreachable, the flag isn't in the file, or the provider errors. `change-approval` defaults to
**on**, because S3 has landed and approval is complete behaviour. That means a flagd outage leaves
approval available rather than switching it off; change the default there if a flag should fail the
other way.

Don't set `FLAGD_HOST` and `FLAGD_OFFLINE_FLAG_SOURCE_PATH` together; flagd wins.

## Add a flag

1. Add it to `FLAG_DEFAULTS` in `backend/services/planning-core/src/shared/flags/definitions.ts`
   with the value it takes when nothing answers. Decide that value on purpose.
2. Add it to `flags/flags.flagd.json`:

   ```json
   "my-flag": {
     "state": "ENABLED",
     "variants": { "on": true, "off": false },
     "defaultVariant": "on"
   }
   ```

   flagd's file format also supports targeting rules (for example on the caller's `role`); the
   server passes `targetingKey` (the user id) and `role` as the evaluation context.
3. Check it where the behaviour is: `await isEnabled("my-flag", { targetingKey: actor.userId, role: actor.role })`
   from `src/shared/flags/index.js`. Enforce it **on the server**; the screen reads the same flag
   only to hide or disable an action.
4. The web app reads the evaluated flags from `GET /api/v1/feature-flags` (signed in, rate
   limited). Add the key to `FeatureFlags` in `frontend/src/api/featureFlags.ts` and use
   `useFeatureFlag("my-flag", token)`.
5. Add tests: the default, the flag off, the flag on.

## Flip a flag

- **Locally or in a deployment that reads the file:** change `defaultVariant` to `"off"` in the
  flag file the service reads and wait about five seconds. No restart.
- **Against flagd:** change the flag in the file or ConfigMap flagd watches. flagd streams the
  change to the service, so it takes effect without a restart. The file flagd serves is the same
  format as `flags/flags.flagd.json`.
- Flip it back the same way. A flag that is off stays off until someone turns it on; nothing
  expires it.

To see what a running service answers: `GET /api/v1/feature-flags` with a staff token returns
`{ "flags": { "change-approval": true } }` for that user.

## How flagd is run in staging

Run flagd next to planning-core and point the service at it:

```bash
flagd start --uri file:/etc/flagd/flags.flagd.json      # gRPC evaluation on :8013
```

```bash
FLAGD_HOST=flagd.staging.internal FLAGD_PORT=8013      # planning-core's environment
```

flagd can also sync from an HTTP(S) URI or a Kubernetes custom resource (`--uri
core.openfeature.dev/<namespace>/<name>`). Which one staging uses is decided with EN-10's
Kubernetes work, which owns the manifests; that is a follow-up and nothing in this change deploys
flagd. CI does run a real flagd: the integration job starts `ghcr.io/open-feature/flagd` with the
committed flag file, and `tests/shared/flagdProvider.test.ts` (EN-15-T8) checks that the provider
reads from it.

## Tests

| Card | Test |
|---|---|
| EN-15-T1, T2 | `backend/services/planning-core/tests/shared/flags.unit.test.ts` |
| EN-15-T3 to T5 | `backend/services/planning-core/tests/change/api/en15Cards.test.ts` |
| EN-15-T6 | `.../tests/change/api/featureFlags.unit.test.ts`, `en15Cards.test.ts` |
| EN-15-T7 | `frontend/tests/featureFlags.test.tsx` |
| EN-15-T8 | `.../tests/shared/flagdProvider.test.ts` (CI only: it needs the flagd container) |
