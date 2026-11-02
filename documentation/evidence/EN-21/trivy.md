# EN-21: Trivy findings and what was done about them

Trivy 0.76.1 (binary, SHA-256 pinned), vulnerability database fetched on the run. The scans are in
`.github/workflows/supply-chain.yml`: one over the repository (`Trivy (filesystem: dependencies, IaC,
secrets)`) and one per image (`Image (<name>) SBOM, Trivy, signing`). Both report HIGH and CRITICAL
without failing, then a gate fails the build on a **CRITICAL finding that has a fix** (`--ignore-unfixed`).
Ignores are in `.trivyignore.yaml`, each with a reason and an expiry date.

| Run | Commit | Result | Link |
|---|---|---|---|
| 1 | `2fd33a6` | Gate failed on all five images (the findings below) | <https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41516594848> |
| 2 | `51d610a` | After the Dockerfile fixes: gate failed on planning-core only (one Temporal crate) | <https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41517668853> |
| 3 | `0e5d08b` | Gate passed on the repository and all five images | <https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41519057637> |

SARIF for the repository scan (category `trivy-fs`) and each image (`trivy-image-<name>`) was uploaded to
code scanning in all three runs: the workflow token could write `security-events` on this pull request
(a branch of this repository, not a fork). A fork's pull request would not be able to; the step then warns
and the scan still counts.

## Images: before and after

Counts are HIGH and CRITICAL findings Trivy reported for the image, with how many had a fix available.

| Image | Before (run 1) | After (run 3) |
|---|---|---|
| planning-core | Debian 12.9: 8 CRITICAL (7 fixable), 80 HIGH (48 fixable) | Debian 12.15: 2 CRITICAL (1 fixable, ignored below), 37 HIGH (5 fixable) |
| registration | Alpine 3.21.2: 3 CRITICAL (3 fixable), 46 HIGH (46 fixable) | Alpine 3.23.4: 0 CRITICAL, 2 HIGH (2 fixable) |
| notification | Alpine 3.21.2: 3 CRITICAL (3 fixable), 46 HIGH (46 fixable) | Alpine 3.23.4: 0 CRITICAL, 2 HIGH (2 fixable) |
| web | Alpine 3.20.5: 3 CRITICAL (3 fixable), 35 HIGH (35 fixable) | Alpine 3.24.2: 0 CRITICAL, 0 HIGH |
| migrate | Alpine 3.21.2: 3 CRITICAL (3 fixable), 44 HIGH (44 fixable) | Alpine 3.23.4: 0 CRITICAL, 3 HIGH (3 fixable) |

### What was fixed (in the Dockerfiles)

Two causes accounted for nearly everything:

1. **Stale bases.** The pinned bases were months old, so OpenSSL (`CVE-2026-31789`), GnuTLS, Perl, zlib,
   musl and libxml2 had fixed releases the images did not have. The bases move to Node 20.20.2 (Alpine 3.23
   or Debian bookworm) and nginx-unprivileged 1.31.7, each still pinned by digest, and every runtime stage
   runs `apk upgrade` or `apt-get upgrade` so the image carries the fixes published since its base was built.
   That costs some reproducibility between builds; the alternative is bumping the digests by hand every
   week.
2. **The npm that ships inside the Node image.** Its bundled `tar` 6.2.1 (one CRITICAL, eight HIGH),
   `glob`, `minimatch`, `brace-expansion`, `cross-spawn`, `pacote`, `sigstore` and `ip-address` were 22
   findings in every Node image, for a tool the services never run. planning-core, registration and
   notification run `node dist/index.js`, so they now drop npm, npx, corepack and yarn. migrate runs
   `npm run migrate`, so it keeps npm and installs a pinned 11.21.1, whose bundled dependencies are current.

The smoke checks in `deploy.yml` (read-only root, capabilities dropped, health endpoints, the Temporal
worker bundle, the web SPA fallback, the migrate run) and the kind deploys all passed on the new images
(Deploy run <https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41517668711>).

### What remains in the images

| Finding | Images | Severity | Why it remains |
|---|---|---|---|
| `zlib1g` `CVE-2023-45853` | planning-core | CRITICAL | No fixed version exists (the flaw is in the `minizip` code bundled with zlib, which the image does not use). `--ignore-unfixed` leaves it out of the gate; it stays in the report. |
| `zip` 8.5.1 (Rust crate) `CVE-2026-115905` and three HIGH | planning-core | CRITICAL, HIGH | Reported from `@temporalio/core-bridge/Cargo.lock`, the crate list of Temporal's native core. The crate is compiled in only for the SDK's ephemeral development server (which unzips a server that `createLocal()` downloads in tests); no code here calls it. The fix is a `@temporalio/*` release that bumps the crate to 9.0.5 or later. The CRITICAL is ignored in `.trivyignore.yaml` until 2026-12-15 with this reason; the three HIGH stay in the report. |
| Debian packages with no fix yet (util-linux family `CVE-2026-53613`, `-53615`, `-78410`; `libsystemd0`/`libudev1` `CVE-2026-16742`; `ncurses` `CVE-2025-69720`; `gzip` `CVE-2026-41992`; `libacl1` `CVE-2026-54369`; `perl-base` `CVE-2026-9538`) | planning-core | HIGH (32 findings) | Debian has not shipped a fix. Moving the service image from bookworm-slim to a distroless or Alpine Node base would shed most of them, but Temporal's native core is built for glibc (Dockerfile comment) and the change needs its own test. |
| `body-parser` 1.20.8 `CVE-2026-111181` (fix 1.20.9), `source-map-js` 1.2.1 `CVE-2026-93749` (fix 1.2.2) | planning-core, registration, notification | HIGH | Lockfile dependencies; see the next section. |
| `undici` 6.29.0 `CVE-2026-109383`, `-109869`, `-87018` (fix 6.29.1) | migrate | HIGH | Bundled inside npm 11.21.1, the newest npm release at the time. Waits for an npm release that carries undici 6.29.1. |
| `libcrypto3`/`libssl3` and the rest of the Alpine findings | none | | Cleared by the base and `apk upgrade`. |

Node 20 reached end of life on 30 April 2026, and 20.20.2 is the newest 20.x tag in the image registry. The images stay
on Node 20 because `.nvmrc`, the engines fields and the test suite are on it; moving to a supported line is a
change for the whole repository, not for this pull request, and Trivy does not report it as a finding. It
is listed here because it is the largest standing risk.

## Repository scan

`package-lock.json` (production dependencies), the Dockerfiles, `deploy/k8s`, `deploy/terraform`, and
secrets in every file. No secret was found. HIGH and CRITICAL findings, as reported on run 3:

| Finding | Where | Severity | Disposition |
|---|---|---|---|
| `body-parser` 1.20.8, `CVE-2026-111181`, fix 1.20.9 | `package-lock.json` | HIGH | Listed. A patch bump inside the Express range; `npm update body-parser` changes the lockfile for everyone, so it belongs in its own change with a full test run. |
| `source-map-js` 1.2.1, `CVE-2026-93749`, fix 1.2.2 | `package-lock.json` | HIGH | Listed, same reason. |
| `AWS-0040` and `AWS-0041`, EKS API endpoint public with `0.0.0.0/0` | `deploy/terraform/modules/eks/main.tf` | CRITICAL | **Accepted until 2026-12-31, in `.trivyignore.yaml`.** EN-10 leaves the endpoint public with an open CIDR list until the team knows its address; `deploy/terraform/README.md` says to set `endpoint_public_access_cidrs` before the first apply, and nothing has been applied (no AWS account). A new Terraform file would still be gated. |
| `AWS-0039`, EKS secrets encryption off | `deploy/terraform/modules/eks/main.tf` | HIGH | Listed. Fix: an `encryption_config` block with a KMS key. It changes the plan, so it is a follow-up to EN-10 rather than part of this change. |
| `KSV-0014` (root filesystem not read-only) and `KSV-0118` (default security context) | `deploy/k8s/test/canary-demo/demo.yaml`, `.../prometheus.yaml`, `deploy/k8s/test/deps/postgres.yaml` | HIGH | Listed. These are kind fixtures that exist only inside a CI job (a stand-in service, Prometheus and a Postgres); they are never rendered into the staging or production overlays, whose hardening `deploy/ci/check-rendered.py` enforces. |
| `DS-0026` no `HEALTHCHECK` in the Dockerfiles | all Dockerfiles | LOW | Not reported in CI (below HIGH). Kubernetes ignores `HEALTHCHECK` and uses the probes in the manifests. |
| `KSV-0013` (`:latest` tag), `KSV-0125` (registry not trusted), `KSV-0110` (default namespace) and similar | `deploy/k8s/base` | MEDIUM, LOW | Not reported in CI. The base manifests name the images without a tag and the overlays set the tag per environment. |

Development dependencies are not scanned (Trivy skips them by default); the workspace SBOM lists them.

## How a finding is handled from here

A CRITICAL finding with a fix fails the `Supply chain` job. Fix it (bump the base digest, the package or
the lockfile), or, if it cannot be fixed yet, add an entry to `.trivyignore.yaml` that names the finding,
the path, why it is acceptable and when it expires. HIGH findings are not gated; the `Supply chain` job
summary and the `trivy-*` artifacts list them on every run, and code scanning shows them under Security.
