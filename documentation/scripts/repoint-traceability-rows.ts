#!/usr/bin/env node
/**
 * Repoints the traceability rows that name no test with a result: the rows check-traceability.ts
 * refuses, and the rows the matrix (traceability-matrix.ts) reports as "not found".
 *
 * Each repair names a story's file (sprint-<n>/<STORY>.csv), a line of it, the `test_file,test_name`
 * tail that line has now, and what the tail becomes. A line that does not end the way the repair
 * expects is an error, not a guess: the file has moved on since the audit and the repair needs
 * another look. A line that already ends the new way is skipped, so running this twice changes
 * nothing.
 *
 * Four kinds of repair:
 *   - renamed: the test lives on under a longer or reworded title (often its describe block's title
 *     and its own, as the runner names it), or the row misquoted a card's heading;
 *   - replaced: E4 took the test away and another test now covers the same criterion;
 *   - superseded: the criterion itself is gone, so the row keeps its criterion and its test_file and
 *     says so in test_name with a marker the team can recognise (see SUPERSEDED_MARKER in
 *     traceability-matrix.ts);
 *   - carded: the row named something CI's matrix can never have a result for: a workflow, a shell
 *     or Python script, a document, or a test that only another workflow runs because it needs that
 *     workflow's containers (gateway.yml's Kong and Redis, load-chaos.yml's k6 and Toxiproxy). It now
 *     names the card that records that run, by its file and its first heading, and the matrix takes
 *     the card's Status as the row's result.
 *
 * This table is the audit of CI run 41777894379's matrix (4 Nov 2026). Three rows that this audit
 * removed outright are not in it, because they had nothing left to point at: E2.csv line 12 (the
 * decline test, whose criterion line 13 already marks superseded), R5.csv line 11 (a nominee's
 * accept, retired by E4; line 10 covers the listing on the Lead's reassignment) and EN-20.csv line 9
 * (the second Toxiproxy test, whose card line 8 now names). The line numbers below are those of the
 * files after the removals. The first audit's 21 repairs were made against the sprint-<n>.csv
 * files before they were split per story on 3 Nov 2026, and are in this file's git history.
 *
 * Usage: tsx documentation/scripts/repoint-traceability-rows.ts [--root <repo>]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const TESTS = "backend/services/planning-core/tests";
const REASSIGNMENTS = `${TESTS}/event/api/reassignments.test.ts`;
const LEAD_ASSIGNMENT = `${TESTS}/event/api/leadAssignment.test.ts`;

/** E2's peer proposals were retired by E4 (W9-FX-5). */
const E2_SUPERSEDED = "SUPERSEDED by E4 (W9-FX-5)";

export interface Repair {
  /** The story's file under documentation/traceability, e.g. "sprint-4/EN-18.csv". */
  csv: string;
  /** 1-based line of the file. */
  line: number;
  from: { file: string; name: string };
  to: { file: string; name: string };
}

const renamed = (csv: string, line: number, file: string, from: string, to: string): Repair => ({
  csv,
  line,
  from: { file, name: from },
  to: { file, name: to },
});

const replaced = (csv: string, line: number, from: Repair["from"], to: Repair["to"]): Repair => ({ csv, line, from, to });

const superseded = (csv: string, line: number, from: Repair["from"], marker: string): Repair => ({
  csv,
  line,
  from,
  to: { file: from.file, name: marker },
});

/** The cards a carded row now names: the path under tests/ and the card's first heading. */
const CARDS: Record<string, [path: string, heading: string]> = {
  "DEPLOY-T1": ["DEPLOY/DEPLOY-T1-every-release-image-builds-for-amd64-and-arm64-and-starts-hardened.md", "DEPLOY-T1 — Every image the release ships builds natively for linux/amd64 and linux/arm64 and starts hardened"],
  "DEPLOY-T2": ["DEPLOY/DEPLOY-T2-a-merge-to-main-pushes-one-signed-multi-arch-index-per-image.md", "DEPLOY-T2 — A merge to main pushes each image once to GHCR as one multi-arch index, signs it keylessly and attests its SBOM"],
  "DEPLOY-T3": ["DEPLOY/DEPLOY-T3-the-k3s-overlays-render-validate-and-differ-only-in-names.md", "DEPLOY-T3 — The k3s overlays render, validate strictly with their CRDs, pass the hardening checks, and differ only in namespace, hostnames and Secret names"],
  "DEPLOY-T4": ["DEPLOY/DEPLOY-T4-the-k3s-staging-overlay-runs-on-kind-with-its-own-kafka-temporal-and-cerbos.md", "DEPLOY-T4 — The k3s staging overlay deploys on kind with its own Redpanda, Temporal dev server and Cerbos, and every service reports ready"],
  "DEPLOY-T5": ["DEPLOY/DEPLOY-T5-only-the-public-api-routes-are-exposed-through-traefik.md", "DEPLOY-T5 — Only the public API routes are exposed through Traefik, with the service prefix stripped"],
  "DEPLOY-T6": ["DEPLOY/DEPLOY-T6-cert-manager-issues-the-api-certificate-and-traefik-serves-it.md", "DEPLOY-T6 — cert-manager issues the API certificate from the ClusterIssuer the Ingress names, and Traefik serves it over HTTPS"],
  "DEPLOY-T7": ["DEPLOY/DEPLOY-T7-the-deploy-gate-writes-only-its-own-namespaces-secret.md", "DEPLOY-T7 — The deploy gate writes the environment's Secret only in its own namespace, accepts only known keys and never prints a value"],
  "DEPLOY-T11": ["DEPLOY/DEPLOY-T11-the-migrate-job-uses-the-session-pooler-url.md", "DEPLOY-T11 — The migrate Job applies every migration through MIGRATE_DATABASE_URL, and a second run applies nothing"],
  "DEPLOY-T12": ["DEPLOY/DEPLOY-T12-a-merge-deploys-staging-and-an-approval-deploys-the-same-digests-to-production.md", "DEPLOY-T12 — A merge to main deploys staging and smoke-tests it; production waits for approval and deploys the same digests"],
  "DEPLOY-T13": ["DEPLOY/DEPLOY-T13-bootstrap-sets-up-the-vm-and-opens-only-22-80-443.md", "DEPLOY-T13 — bootstrap.sh installs k3s, cert-manager, Argo CD, the namespaces and Applications, opens only 22, 80 and 443, and is safe to run twice"],
  "DEPLOY-T15": ["DEPLOY/DEPLOY-T15-the-runbook-takes-joash-from-no-accounts-to-both-environments.md", "DEPLOY-T15 — The runbook takes Joash from no accounts to both environments"],
  "DEPLOY-T17": ["DEPLOY/DEPLOY-T17-the-space-image-runs-every-process-behind-one-port.md", "DEPLOY-T17 — The Hugging Face Space image runs every process behind one port, as a Space runs it"],
  "EN-03-T18": ["EN-03/EN-03-T18-the-verify-command-fails-on-an-edited-row-in-ci.md", "EN-03-T18 — `npm run event-store:verify` fails on CI's database after a row is edited"],
  "EN-05-T6": ["EN-05/EN-05-T6-ci-checks-every-pull-request.md", "EN-05-T6 — Every pull request runs the schema checks in CI, and a breaking change fails the build"],
  "EN-05-T7": ["EN-05/EN-05-T7-redpanda-registry-agrees-with-checker.md", "EN-05-T7 — A real schema registry (Redpanda's) gives the same verdict as the checker, and the branch passes the registry's own compatibility check"],
  "EN-05-T8": ["EN-05/EN-05-T8-debezium-router-publishes-what-relay-publishes.md", "EN-05-T8 — Debezium Server's outbox router puts the same message on Kafka as the polling relay does, for every message type"],
  "EN-05-T9": ["EN-05/EN-05-T9-cdc-component-renders-as-valid-manifests.md", "EN-05-T9 — The Debezium Server kustomize component renders into valid Kubernetes objects that the deployment can include"],
  "EN-12-T1": ["EN-12/EN-12-T1-kong-parses-the-committed-and-the-rendered-configuration.md", "EN-12-T1 — Kong accepts the committed `gateway/kong.yml` and the configuration rendered from it"],
  "EN-12-T2": ["EN-12/EN-12-T2-each-prefix-is-routed-to-its-own-upstream.md", "EN-12-T2 — Requests reach the service their prefix names, with the prefix stripped"],
  "EN-12-T3": ["EN-12/EN-12-T3-a-token-is-checked-against-the-jwks-and-a-bad-one-is-refused.md", "EN-12-T3 — Kong checks the bearer token against the signing keys: none, malformed, wrong key and expired are refused with 401; a valid one passes"],
  "EN-12-T5": ["EN-12/EN-12-T5-staff-and-public-routes-are-separate-and-nothing-internal-is.md", "EN-12-T5 — Staff and public traffic use separate routes and upstream pools; health endpoints and unknown prefixes are not reachable"],
  "EN-12-T6": ["EN-12/EN-12-T6-a-public-route-is-limited-per-address-and-answers-429-with-r.md", "EN-12-T6 — A public route allows its budget per address and then answers 429 with Retry-After"],
  "EN-12-T7": ["EN-12/EN-12-T7-the-limit-is-shared-by-two-kong-instances-through-redis.md", "EN-12-T7 — Two Kong instances share one count through Redis"],
  "EN-12-T8": ["EN-12/EN-12-T8-a-staff-route-is-limited-per-user.md", "EN-12-T8 — A staff route is limited per signed-in user: one user at the limit does not slow another"],
  "EN-12-T9": ["EN-12/EN-12-T9-the-user-id-the-limit-counts-by-cannot-be-chosen-by-the-clie.md", "EN-12-T9 — A client-sent `x-user-id` is replaced by the token's subject (staff) or removed (public)"],
  "EN-12-T10": ["EN-12/EN-12-T10-trace-headers-are-generated-or-propagated-and-reach-the-upst.md", "EN-12-T10 — `traceparent` and `x-correlation-id` are generated when absent, kept when present, reach the upstream and come back in the response"],
  "EN-12-T11": ["EN-12/EN-12-T11-the-browse-api-is-cacheable-and-personal-data-is-never-cache.md", "EN-12-T11 — Through the gateway, the browse API carries the CDN's cache headers and every personal response is `no-store`"],
  "EN-12-T13": ["EN-12/EN-12-T13-the-kubernetes-manifests-for-kong-and-redis-are-valid.md", "EN-12-T13 — The Kubernetes manifests for Kong and Redis render with kustomize and pass kubeconform in strict mode"],
  "EN-18-T1": ["EN-18/EN-18-T1-spike-500-register-attempts-a-second-for-100-seats-register.md", "EN-18-T1 — Spike: 500 register attempts a second for 100 seats register exactly 100 attendees"],
  "EN-18-T2": ["EN-18/EN-18-T2-spike-no-over-admission-and-every-other-attempt-is-refused.md", "EN-18-T2 — Spike: no over-admission, and every other attempt is refused REGISTRATION_FULL"],
  "EN-18-T3": ["EN-18/EN-18-T3-spike-registration-latency-p95-is-measured-against-the-800.md", "EN-18-T3 — Spike: registration latency p95 is measured against the 800 ms SLO at the rate achieved"],
  "EN-18-T4": ["EN-18/EN-18-T4-smoke-a-small-load-on-every-pull-request-keeps-the.md", "EN-18-T4 — Smoke: a small load on every pull request keeps the invariants"],
  "EN-18-T5": ["EN-18/EN-18-T5-soak-a-steady-mixed-load-for-several-minutes-shows-no.md", "EN-18-T5 — Soak: a steady mixed load for several minutes shows no errors and no unbounded growth"],
  "EN-18-T6": ["EN-18/EN-18-T6-stress-ramp-the-arrival-rate-until-the-service-breaks-and.md", "EN-18-T6 — Stress: ramp the arrival rate until the service breaks, and keep the invariants"],
  "EN-18-T7": ["EN-18/EN-18-T7-autoscaling-is-tuned-from-the-measurements-and-the-numbers.md", "EN-18-T7 — Autoscaling is tuned from the measurements and the numbers are checked"],
  "EN-18-T8": ["EN-18/EN-18-T8-the-results-are-committed-as-evidence-with-the-run-urls.md", "EN-18-T8 — The results are committed as evidence with the run URLs"],
  "EN-20-T1": ["EN-20/EN-20-T1-experiment-1-a-crash-mid-cancellation-leaves-no-partial.md", "EN-20-T1 — Experiment 1: a crash mid-cancellation leaves no partial release"],
  "EN-20-T2": ["EN-20/EN-20-T2-experiment-2-a-broker-outage-loses-no-notifications.md", "EN-20-T2 — Experiment 2: a broker outage loses no notifications"],
  "EN-20-T3": ["EN-20/EN-20-T3-experiment-3-a-slow-database-never-causes-over-admission.md", "EN-20-T3 — Experiment 3: a slow database never causes over-admission"],
  "EN-20-T4": ["EN-20/EN-20-T4-experiment-4-a-public-outage-does-not-reach-staff.md", "EN-20-T4 — Experiment 4: a public outage does not reach staff"],
  "EN-20-T5": ["EN-20/EN-20-T5-experiment-5-duplicate-delivery-is-harmless.md", "EN-20-T5 — Experiment 5: duplicate delivery is harmless"],
  "EN-20-T6": ["EN-20/EN-20-T6-experiment-6-a-partition-cannot-push-seats-over-a-reduced.md", "EN-20-T6 — Experiment 6: a partition cannot push seats over a reduced capacity"],
  "EN-20-T7": ["EN-20/EN-20-T7-toxiproxy-runs-in-ci-and-a-toxic-really-changes-the.md", "EN-20-T7 — Toxiproxy runs in CI and a toxic really changes the connection"],
  "EN-20-T8": ["EN-20/EN-20-T8-the-chaos-mesh-manifests-are-valid.md", "EN-20-T8 — The Chaos Mesh manifests are valid"],
  "EN-21-T1": ["EN-21/EN-21-T1-every-image-and-the-npm-workspace-have-a-cyclonedx-sbom.md", "EN-21-T1 — Every image and the npm workspace has a CycloneDX SBOM, uploaded as an artifact"],
  "EN-21-T2": ["EN-21/EN-21-T2-trivy-scans-dependencies-iac-and-secrets-in-the-repository.md", "EN-21-T2 — Trivy scans the repository's dependencies, Dockerfiles, deploy/ manifests and secrets; a CRITICAL finding with a fix fails the build"],
  "EN-21-T3": ["EN-21/EN-21-T3-trivy-scans-each-built-image.md", "EN-21-T3 — Trivy scans each built image; a CRITICAL operating-system or library finding with a fix fails the build"],
  "EN-21-T4": ["EN-21/EN-21-T4-main-signs-the-ghcr-images-and-attests-their-sboms.md", "EN-21-T4 — A push to main signs each GHCR image keylessly, attests its SBOM, and verifies both"],
  "EN-21-T5": ["EN-21/EN-21-T5-cosign-signs-attests-and-verifies-on-a-pull-request-without-a-push.md", "EN-21-T5 — A pull request signs the SBOMs as blobs, and signs, attests and verifies an image in a throwaway local registry"],
  "EN-21-T6": ["EN-21/EN-21-T6-zap-baseline-scans-the-running-web-app-and-api.md", "EN-21-T6 — A ZAP baseline scan runs against the running web app and the planning-core API on a throwaway database; the rules file records each ignore"],
  "EN-21-T7": ["EN-21/EN-21-T7-every-action-the-pipeline-adds-is-pinned-by-commit-sha.md", "EN-21-T7 — Every third-party action the supply-chain pipeline adds is pinned by commit SHA"],
  "EN-21-T8": ["EN-21/EN-21-T8-the-supply-chain-guide-lets-a-newcomer-verify-an-image.md", "EN-21-T8 — documentation/supply-chain.md lets a newcomer verify an image's signature and SBOM"],
};

/** The row now names the card `id` from CARDS: its file under tests/ and its heading. */
function carded(csv: string, line: number, from: Repair["from"], id: string): Repair {
  const card = CARDS[id];
  if (!card) throw new Error(`no card ${id} in CARDS`);
  return { csv, line, from, to: { file: `tests/${card[0]}`, name: card[1] } };
}

export const REPAIRS: Repair[] = [
  // sprint-4/DEPLOY.csv
  carded("sprint-4/DEPLOY.csv", 2, { file: ".github/workflows/deploy.yml", name: "job: Image (planning-core, registration, notification, migrate, cerbos) and Image arm64 (the same five) (DEPLOY-T1)" }, "DEPLOY-T1"),
  carded("sprint-4/DEPLOY.csv", 3, { file: ".github/workflows/release.yml", name: "jobs: Build (<image>, <arch>), Publish (<image>) (DEPLOY-T2)" }, "DEPLOY-T2"),
  carded("sprint-4/DEPLOY.csv", 4, { file: "deploy/ci/check-parity.py", name: "step: Staging and production (k3s) differ only in namespace, hostnames and Secret names (DEPLOY-T3)" }, "DEPLOY-T3"),
  carded("sprint-4/DEPLOY.csv", 5, { file: "deploy/ci/kind-k3s.sh", name: "job: kind: k3s staging overlay (Redpanda, Temporal, Cerbos, Traefik) (DEPLOY-T4)" }, "DEPLOY-T4"),
  carded("sprint-4/DEPLOY.csv", 6, { file: "deploy/release/smoke-api.sh", name: "job: kind: k3s staging overlay, step Through Traefik over TLS (DEPLOY-T5)" }, "DEPLOY-T5"),
  carded("sprint-4/DEPLOY.csv", 7, { file: "deploy/ci/kind-k3s.sh", name: "job: kind: k3s staging overlay, certificate and TLS checks (DEPLOY-T6)" }, "DEPLOY-T6"),
  carded("sprint-4/DEPLOY.csv", 10, { file: "deploy/ci/kind-k3s.sh", name: "job: kind: k3s staging overlay, step The deploy gate writes the Secret, and refuses what it should (DEPLOY-T7)" }, "DEPLOY-T7"),
  carded("sprint-4/DEPLOY.csv", 17, { file: "deploy/ci/kind-k3s.sh", name: "job: kind: k3s staging overlay, migrate Job through MIGRATE_DATABASE_URL, then a second run (DEPLOY-T11)" }, "DEPLOY-T11"),
  carded("sprint-4/DEPLOY.csv", 18, { file: ".github/workflows/deploy-environment.yml", name: "jobs: Deploy staging, Deploy production (DEPLOY-T12)" }, "DEPLOY-T12"),
  carded("sprint-4/DEPLOY.csv", 19, { file: "deploy/oracle/bootstrap.sh", name: "manual: DEPLOY-T13" }, "DEPLOY-T13"),
  carded("sprint-4/DEPLOY.csv", 22, { file: "documentation/deploy/README.md", name: "manual: DEPLOY-T15" }, "DEPLOY-T15"),
  carded("sprint-4/DEPLOY.csv", 27, { file: "deploy/ci/space-smoke.sh", name: "job: Space image (one container: services, Redpanda, Temporal, Cerbos, Caddy on 7860) (DEPLOY-T17)" }, "DEPLOY-T17"),
  // sprint-4/EN-03.csv
  carded("sprint-4/EN-03.csv", 20, { file: ".github/workflows/ci.yml", name: "Event store tamper check (EN-03)" }, "EN-03-T18"),
  renamed("sprint-4/EN-03.csv", 21, "backend/services/planning-core/tests/event/domain/eventStream.test.ts", "checking one link (EN-03-T15 to T17)", "checking one link (EN-03-T15 to T17) refuses an edited entry: its stored hash no longer matches what it stores"),
  // sprint-4/EN-05.csv
  renamed("sprint-4/EN-05.csv", 2, "tests/EN-05/EN-05-T1-spike-records-feasibility-and-decision.md", "EN-05-T1 spike answers both questions with sources and the decision is in ADR-0008 (document review)", "EN-05-T1 — The spike answers both questions with sources, and the decision is written into ADR-0008"),
  carded("sprint-4/EN-05.csv", 3, { file: "backend/scripts/cdc-parity-check.ts", name: "EN-05-T8 Debezium Server publishes what the relay publishes, for every message type (CI job cdc-and-registry)" }, "EN-05-T8"),
  carded("sprint-4/EN-05.csv", 4, { file: "deploy/ci/check-cdc-rendered.py", name: "EN-05-T9 the CDC component renders as valid, hardened manifests (CI job cdc-manifests)" }, "EN-05-T9"),
  carded("sprint-4/EN-05.csv", 9, { file: ".github/workflows/ci.yml", name: "EN-05-T6 job schema-compat: Message schema compatibility, on every pull request" }, "EN-05-T6"),
  carded("sprint-4/EN-05.csv", 10, { file: "backend/scripts/schema-registry-check.ts", name: "EN-05-T7 Redpanda registry agrees with the checker on every case and on this branch (CI job cdc-and-registry)" }, "EN-05-T7"),
  // sprint-4/EN-07.csv
  renamed("sprint-4/EN-07.csv", 9, "backend/services/planning-core/tests/identity/api/permissions.unit.test.ts", "EN-07-T5 refuses 51 checks, one over the limit with 400 VALIDATION_FAILED naming the field", "EN-07-T5 refuses 51 checks, one over the limit with 400 VALIDATION_FAILED naming the field"),
  // sprint-4/EN-08.csv
  renamed("sprint-4/EN-08.csv", 93, "tests/EN-08/EN-08-T12-grafana-cloud-shows-the-d4-approval-as-one-trace.md", "EN-08-T12 Grafana Cloud shows the D4 approval as one trace (manual; Not Executed until the Grafana Cloud account exists)", "EN-08-T12 — Grafana Cloud shows the D4 approval as one trace"),
  // sprint-4/EN-12.csv
  carded("sprint-4/EN-12.csv", 9, { file: "gateway/tests/integration/gateway.int.mjs", name: "EN-12-T2 routes each prefix to its own upstream with the prefix stripped" }, "EN-12-T2"),
  carded("sprint-4/EN-12.csv", 10, { file: "gateway/tests/integration/gateway.int.mjs", name: "EN-12-T3 refuses no token, a malformed token, a wrong key, an expired token and an unknown key id, and lets a valid token through" }, "EN-12-T3"),
  carded("sprint-4/EN-12.csv", 17, { file: "gateway/tests/integration/gateway.int.mjs", name: "EN-12-T5 keeps staff and public routes apart and exposes no health endpoint" }, "EN-12-T5"),
  carded("sprint-4/EN-12.csv", 18, { file: "gateway/tests/integration/gateway.int.mjs", name: "EN-12-T6 limits a public route per address and answers 429 with Retry-After" }, "EN-12-T6"),
  carded("sprint-4/EN-12.csv", 19, { file: "gateway/tests/integration/gateway.int.mjs", name: "EN-12-T7 shares one count between two Kong instances through Redis" }, "EN-12-T7"),
  carded("sprint-4/EN-12.csv", 20, { file: "gateway/tests/integration/gateway.int.mjs", name: "EN-12-T8 limits a staff route per user, not per address" }, "EN-12-T8"),
  carded("sprint-4/EN-12.csv", 21, { file: "gateway/tests/integration/gateway.int.mjs", name: "EN-12-T9 overwrites a client-sent x-user-id with the token's subject" }, "EN-12-T9"),
  carded("sprint-4/EN-12.csv", 22, { file: "gateway/tests/integration/gateway.int.mjs", name: "EN-12-T10 generates or propagates traceparent and x-correlation-id" }, "EN-12-T10"),
  carded("sprint-4/EN-12.csv", 26, { file: "gateway/tests/integration/gateway.int.mjs", name: "EN-12-T11 serves the browse API as cacheable and everything personal as no-store" }, "EN-12-T11"),
  carded("sprint-4/EN-12.csv", 32, { file: ".github/workflows/gateway.yml", name: "EN-12-T1 Kong configuration job: kong config parse of the committed and the rendered file" }, "EN-12-T1"),
  carded("sprint-4/EN-12.csv", 33, { file: ".github/workflows/gateway.yml", name: "EN-12-T13 Kubernetes manifests job: kustomize and kubeconform" }, "EN-12-T13"),
  // sprint-4/EN-18.csv
  carded("sprint-4/EN-18.csv", 2, { file: ".github/workflows/load-chaos.yml", name: "job: Load (k6 smoke and 500 req/s spike): step Spike (EN-18-T1)" }, "EN-18-T1"),
  carded("sprint-4/EN-18.csv", 6, { file: ".github/workflows/load-chaos.yml", name: "job: Load (k6 smoke and 500 req/s spike): step Spike (EN-18-T2)" }, "EN-18-T2"),
  carded("sprint-4/EN-18.csv", 7, { file: ".github/workflows/load-chaos.yml", name: "job: Load (k6 smoke and 500 req/s spike): step Spike, result.md (EN-18-T3)" }, "EN-18-T3"),
  carded("sprint-4/EN-18.csv", 9, { file: ".github/workflows/load-chaos.yml", name: "job: Load (k6 smoke and 500 req/s spike): step Smoke (EN-18-T4)" }, "EN-18-T4"),
  carded("sprint-4/EN-18.csv", 10, { file: ".github/workflows/load-chaos.yml", name: "job: Load (k6 soak) (EN-18-T5)" }, "EN-18-T5"),
  carded("sprint-4/EN-18.csv", 12, { file: ".github/workflows/load-chaos.yml", name: "job: Load (k6 stress, ramp to breaking) (EN-18-T6)" }, "EN-18-T6"),
  carded("sprint-4/EN-18.csv", 16, { file: ".github/workflows/load-chaos.yml", name: "job: Manifests (kubeconform, Chaos Mesh, autoscaling): step Render the autoscaling component and validate the result (EN-18-T7)" }, "EN-18-T7"),
  carded("sprint-4/EN-18.csv", 17, { file: "documentation/evidence/EN-18/README.md", name: "write-up with the k6 summaries and the run URLs (EN-18-T8)" }, "EN-18-T8"),
  renamed("sprint-4/EN-18.csv", 3, "load/tests/evaluate.unit.test.ts", "evaluateSpike passes a clean spike: 100 registered, the rest refused full, and says whether the rate was held (EN-18-T1)", "evaluateSpike (EN-18-T1, T2, T3, T4) passes a clean spike: 100 registered, the rest refused full, and says whether the rate was held"),
  renamed("sprint-4/EN-18.csv", 4, "load/tests/evaluate.unit.test.ts", "seatChecks fails on over-admission, a seat claimed twice, an attendee registered twice, a seat claimed with no registration (EN-18-T1, T2)", "seatChecks (EN-18-T1, T2) fails on %s"),
  renamed("sprint-4/EN-18.csv", 5, "load/tests/evaluate.unit.test.ts", "evaluateSpike fails when any attempt was rate-limited, errored or timed out instead of refused full (EN-18-T2)", "evaluateSpike (EN-18-T1, T2, T3, T4) fails when any attempt was rate-limited, errored or timed out instead of refused full"),
  renamed("sprint-4/EN-18.csv", 8, "load/tests/evaluate.unit.test.ts", "evaluateSpike reports a rate that was not sustained, without failing the invariants (EN-18-T3)", "evaluateSpike (EN-18-T1, T2, T3, T4) reports a rate that was not sustained, without failing the invariants"),
  renamed("sprint-4/EN-18.csv", 11, "load/tests/evaluate.unit.test.ts", "evaluateSoak fails on a ghost seat, a missing withdrawal, slow reads, a failed read or runaway memory (EN-18-T5)", "evaluateSoak (EN-18-T5) fails on a ghost seat, a missing withdrawal, slow reads, a failed read or runaway memory"),
  renamed("sprint-4/EN-18.csv", 13, "load/tests/evaluate.unit.test.ts", "evaluateStress names the highest step that held before the first that broke (EN-18-T6)", "evaluateStress (EN-18-T6) names the highest step that held before the first that broke"),
  renamed("sprint-4/EN-18.csv", 14, "load/tests/sizing.unit.test.ts", "sizeAutoscaling bounds the maximum by the connection budget: pods x pool at most 80% of the pooler (EN-18-T7)", "sizeAutoscaling (EN-18-T7) bounds the maximum by the connection budget: pods x pool at most 80% of the pooler"),
  renamed("sprint-4/EN-18.csv", 15, "load/tests/autoscaling.unit.test.ts", "the committed HorizontalPodAutoscaler patch follows from the sizing inputs (EN-18-T7)", "the autoscaling component (EN-18-T7) sets the HPA's minimum and maximum to what the sizing works out"),
  renamed("sprint-4/EN-18.csv", 18, "backend/services/registration/tests/config.unit.test.ts", "positiveIntFromEnv reads a positive whole number, ignoring surrounding spaces (EN-18)", "positiveIntFromEnv (EN-18) reads a positive whole number, ignoring surrounding spaces"),
  renamed("sprint-4/EN-18.csv", 19, "backend/services/registration/tests/config.unit.test.ts", "registrationRateLimiter keeps 120 a minute when it is given no number (EN-18)", "registrationRateLimiter (EN-18) keeps 120 a minute when it is given no number"),
  // sprint-4/EN-20.csv
  carded("sprint-4/EN-20.csv", 2, { file: "documentation/evidence/EN-20/1-crash-mid-cancellation.md", name: "designed, not run: blocked by F3 and F4 (EN-20-T1)" }, "EN-20-T1"),
  carded("sprint-4/EN-20.csv", 3, { file: "chaos/experiments/02-broker-outage.test.ts", name: "registrations commit during the outage, and after it every message is published and notified exactly once (EN-20-T2)" }, "EN-20-T2"),
  carded("sprint-4/EN-20.csv", 4, { file: "chaos/experiments/03-slow-database.test.ts", name: "seats stay exact while every database answer takes 500 ms longer (EN-20-T3)" }, "EN-20-T3"),
  carded("sprint-4/EN-20.csv", 5, { file: "chaos/experiments/04-public-outage.test.ts", name: "staff functions answer exactly as before while registration is down, and the public routes return when it is back (EN-20-T4)" }, "EN-20-T4"),
  carded("sprint-4/EN-20.csv", 6, { file: "chaos/experiments/05-duplicate-delivery.test.ts", name: "replaying every topic twice, after a connection reset, builds no extra seats and sends no extra notifications (EN-20-T5)" }, "EN-20-T5"),
  carded("sprint-4/EN-20.csv", 7, { file: "documentation/evidence/EN-20/6-partition-and-reduced-capacity.md", name: "designed, not run: blocked by the ReduceCapacity workflow (EN-20-T6)" }, "EN-20-T6"),
  carded("sprint-4/EN-20.csv", 8, { file: "chaos/experiments/00-toxiproxy.test.ts", name: "a 500 ms latency toxic makes a query through the proxy at least 500 ms slower (EN-20-T7)" }, "EN-20-T7"),
  carded("sprint-4/EN-20.csv", 9, { file: ".github/workflows/load-chaos.yml", name: "job: Manifests (kubeconform, Chaos Mesh, autoscaling): step Validate the Chaos Mesh manifests (EN-20-T8)" }, "EN-20-T8"),
  // sprint-4/EN-21.csv
  carded("sprint-4/EN-21.csv", 2, { file: ".github/workflows/supply-chain.yml", name: "jobs: SBOM (npm workspace); Image (<name>) SBOM, Trivy, signing (EN-21-T1)" }, "EN-21-T1"),
  carded("sprint-4/EN-21.csv", 3, { file: ".github/workflows/supply-chain.yml", name: "job: Trivy (filesystem: dependencies, IaC, secrets) (EN-21-T2)" }, "EN-21-T2"),
  carded("sprint-4/EN-21.csv", 4, { file: ".github/workflows/supply-chain.yml", name: "jobs: Image (<name>) SBOM, Trivy, signing (EN-21-T3)" }, "EN-21-T3"),
  carded("sprint-4/EN-21.csv", 5, { file: ".github/workflows/release.yml", name: "step: Sign, attest and verify (cosign, keyless), on a push to main (EN-21-T4)" }, "EN-21-T4"),
  carded("sprint-4/EN-21.csv", 6, { file: ".github/workflows/supply-chain.yml", name: "steps: Sign the SBOM as a blob; Sign, attest and verify an image in a local registry (EN-21-T5)" }, "EN-21-T5"),
  carded("sprint-4/EN-21.csv", 7, { file: ".github/workflows/supply-chain.yml", name: "job: ZAP baseline (web app and planning-core API) (EN-21-T6)" }, "EN-21-T6"),
  carded("sprint-4/EN-21.csv", 8, { file: ".github/scripts/check-action-pins.mjs", name: "job: Actions are pinned by commit SHA (EN-21-T7)" }, "EN-21-T7"),
  carded("sprint-4/EN-21.csv", 9, { file: "documentation/supply-chain.md", name: "commands run in step Sign, attest and verify; whole guide checked after the first push to main (EN-21-T8)" }, "EN-21-T8"),
  // sprint-1/E2.csv
  superseded("sprint-1/E2.csv", 9, { file: REASSIGNMENTS, name: "refuses a caller who is not the nominee" }, E2_SUPERSEDED),
  replaced("sprint-1/E2.csv", 10, { file: REASSIGNMENTS, name: "moves coordinator permissions to the nominee and closes the outgoing assignment" }, { file: LEAD_ASSIGNMENT, name: "moves the event at once, closing the outgoing assignment and recording the new one with the Lead (E4-T1)" }),
  replaced("sprint-1/E2.csv", 11, { file: REASSIGNMENTS, name: "writes the reassignment-accepted event naming both coordinators" }, { file: LEAD_ASSIGNMENT, name: "tells the outgoing and new coordinators and the owner, and raises the event's version (E4-T5)" }),
  // sprint-2/H1.csv
  renamed("sprint-2/H1.csv", 6, "backend/services/planning-core/tests/venue/api/venues.test.ts", "lets any Venue Staff member update a venue, recording only the changed fields with their previous values", "lets another Venue Staff member who looks after the venue update it, recording only the changed fields with their previous values"),
];

/** A CSV field, quoted when it holds a comma, a quote or a line break. */
export function csvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** The text of a row from `test_file` onward. A name that was written quoted is accepted either way. */
const tail = (t: Repair["from"]): string[] => [`,${t.file},${t.name}`, `,${t.file},"${t.name}"`, `,${t.file},${csvField(t.name)}`];

export interface ApplyResult {
  text: string;
  /** Lines that were changed. */
  changed: number[];
  /** Lines that already had the new tail. */
  alreadyDone: number[];
}

/** Applies the repairs for one story's file to its text. Throws if a line is not as the repair expects. */
export function applyRepairs(csv: string, text: string, repairs: Repair[] = REPAIRS): ApplyResult {
  const parts = text.split(/(\r\n|\n)/);
  const changed: number[] = [];
  const alreadyDone: number[] = [];
  for (const repair of repairs.filter((r) => r.csv === csv)) {
    const index = (repair.line - 1) * 2;
    const line = parts[index];
    if (line === undefined) throw new Error(`${csv}:${repair.line} does not exist`);
    const toTail = `,${repair.to.file},${csvField(repair.to.name)}`;
    if (line.endsWith(toTail)) {
      alreadyDone.push(repair.line);
      continue;
    }
    const fromTail = tail(repair.from).find((candidate) => line.endsWith(candidate));
    if (fromTail === undefined) {
      throw new Error(`${csv}:${repair.line} does not end with ,${repair.from.file},${repair.from.name}; audit it again`);
    }
    parts[index] = line.slice(0, line.length - fromTail.length) + toTail;
    changed.push(repair.line);
  }
  return { text: parts.join(""), changed, alreadyDone };
}

function main(): void {
  const rootFlag = process.argv.indexOf("--root");
  const root = rootFlag === -1 ? process.cwd() : process.argv[rootFlag + 1];
  for (const csv of [...new Set(REPAIRS.map((r) => r.csv))].sort()) {
    const path = join(root, "documentation", "traceability", csv);
    const result = applyRepairs(csv, readFileSync(path, "utf8"));
    if (result.changed.length > 0) writeFileSync(path, result.text);
    console.log(`${csv}: changed ${result.changed.length}, already done ${result.alreadyDone.length}`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
