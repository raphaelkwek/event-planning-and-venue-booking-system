# API contracts

**Author:** Joash · **Jira:** EN-09 (SPM-127) · **Decision:** ADR-0015 (contract-first HTTP APIs)

| File | Describes | Status |
|---|---|---|
| `planning-core.openapi.yaml` | Every HTTP route planning-core serves (identity and event modules today) | OpenAPI 3.1, matches the code |
| `events.asyncapi.yaml` | Kafka topics and message envelopes | Waiting on EN-04.1 (SPM-161), which replaces today's envelope with CloudEvents and topics per aggregate. Write it then, not before |
| registration and notification specs | The two edge services | Written with EN-13 and EN-04.3 |

## Rules

- **Spec first.** A new or changed route changes `planning-core.openapi.yaml` in the same pull request (ADR-0015).
- **CI checks the spec two ways:**
  - `npm run lint:api` runs Redocly. The spec must be valid. Two warnings are expected: the health probes have no 4XX response.
  - `tests/api/openapiRoutes.unit.test.ts` in planning-core fails if the spec and the Express routes differ: a route missing from the spec, or a spec path with no route.
- **Shapes come from the code,** so keep them in step:
  - request bodies from the zod schemas in `modules/<module>/api/schemas.ts`;
  - response bodies from the repo row types;
  - error codes from `backend/packages/contracts/src/errorCodes.ts`.
- **Reading it:** `npx redocly build-docs documentation/api/planning-core.openapi.yaml -o api.html` builds a browsable page; open `api.html` in a browser. Pasting the file into <https://editor.swagger.io> also works.
