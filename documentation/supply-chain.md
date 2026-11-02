# Supply chain security (EN-21)

What we ship is a set of container images built from our code and from other people's packages. This
page says what the pipeline records about them, what it refuses, and how to check an image yourself.

| Question | Answer | Where |
|---|---|---|
| What is in this image? | A CycloneDX SBOM per image, and one for the npm workspace | `Supply chain` workflow, artifacts `sbom-*`; on main also attached to the image as a signed attestation |
| Is it the image we built? | A keyless cosign signature that names the workflow and branch that built it | `Deploy` workflow on main, verified below |
| Does it contain a known serious flaw? | Trivy fails the build on a CRITICAL finding that has a fix; HIGH is reported | `Supply chain` workflow, job logs, code scanning |
| Does the running app give things away? | A passive ZAP baseline scan of the web app and the API | `Supply chain` workflow, artifact `zap-report` |
| Can someone swap an action under us? | Third-party actions are pinned by commit SHA, and a job checks it | `Actions are pinned by commit SHA` job |

The files: `.github/workflows/supply-chain.yml`, `.github/workflows/deploy.yml` (the signing step),
`.github/actions/sign-and-attest/action.yml`, `.github/scripts/`, `.trivyignore.yaml` and
`.zap/rules.tsv`. Findings and what was done about them are in `documentation/evidence/EN-21/`.

## Verify an image's signature and SBOM

Images are published to GHCR by the `Deploy` workflow on every push to main, tagged with the commit
sha (EN-10), and are signed right after the push. You need [`cosign`](https://docs.sigstore.dev/cosign/system_config/installation/)
3.x. You do not need a GitHub login if the package is public; otherwise run `docker login ghcr.io`
first (a GitHub token with `read:packages`). The package's visibility is a setting of the
organisation or account that owns the repository, not something this repository controls.

```bash
OWNER=raphaelkwek
REPO=event-planning-and-venue-booking-system
IMAGE=ghcr.io/$OWNER/connectsphere-planning-core        # or -registration, -notification, -web, -migrate
SHA=<a commit sha on main>

# 1. Resolve the tag to the digest. A tag can move; a digest cannot, and the signature is on the digest.
DIGEST=$(docker buildx imagetools inspect $IMAGE:$SHA --format '{{json .Manifest.Digest}}' | tr -d '"')
# (or: crane digest $IMAGE:$SHA)

# 2. Verify the signature: it must have been made by the Deploy workflow, on main, of this repository.
cosign verify $IMAGE@$DIGEST \
  --certificate-identity "https://github.com/$OWNER/$REPO/.github/workflows/deploy.yml@refs/heads/main" \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com

# 3. Verify the SBOM attestation the same way.
cosign verify-attestation $IMAGE@$DIGEST --type cyclonedx \
  --certificate-identity "https://github.com/$OWNER/$REPO/.github/workflows/deploy.yml@refs/heads/main" \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com > attestation.json

# 4. Read the SBOM out of the attestation (the payload is base64 of an in-toto statement).
jq -r '.payload' attestation.json | base64 -d | jq '.predicate' > sbom.cdx.json
jq -r '.components[] | "\(.name)@\(.version)"' sbom.cdx.json | sort | head
jq '.components | length' sbom.cdx.json

# 5. See everything attached to the image.
cosign tree $IMAGE@$DIGEST
```

What a pass means: the signature is valid, and the certificate Fulcio issued to the signer names exactly
that workflow file on `refs/heads/main` of this repository, issued to GitHub's OIDC provider. Anyone
can sign something with cosign; only a run of our workflow on main can sign as this identity. A wrong
identity makes `cosign verify` fail, and the pipeline checks that too after every signing.

Keyless signing has no key to lose. The signature, the certificate and the time are recorded in the
public Rekor transparency log, which is how a certificate that lived for ten minutes can still be
verified later. Because the log is public, the name of this repository and workflow are in it.

If the SBOM is all you want and you trust the CI run, download the artifact instead: the `Deploy` run
on main uploads `sbom-attested-<image>` (the file that was attested), and `Supply chain` uploads
`sbom-image-<image>` for every pull request.

## What a pull request shows

Main is the only place the images are pushed, so a pull request cannot sign what is in GHCR. It does
two things instead, both with a real keyless signature (GitHub's OIDC token for the pull request's merge
ref, a Fulcio certificate, a Rekor entry):

1. `cosign sign-blob` signs each image's SBOM file, and `cosign verify-blob` checks it. The bundle is the
   artifact `signed-sbom-<image>`. To check one yourself, with the SBOM and bundle from the same artifact set:

   ```bash
   cosign verify-blob sbom-image-planning-core.cdx.json \
     --bundle sbom-image-planning-core.cdx.json.bundle \
     --certificate-identity "https://github.com/$OWNER/$REPO/.github/workflows/supply-chain.yml@refs/pull/<number>/merge" \
     --certificate-oidc-issuer https://token.actions.githubusercontent.com
   ```

2. The image is pushed to a registry container that lives only for the job, then signed, attested and
   verified by `.github/actions/sign-and-attest`, the same action `Deploy` runs on main. That proves the
   commands and flags work end to end; it does not prove the GHCR package settings or permissions on
   main. Those can only be proven by the first push to main.

A pull request from a fork gets no OIDC token. The jobs say so and skip signing; the SBOM and scan jobs run
regardless.

## Trivy

- **Filesystem scan** (`Trivy (filesystem: dependencies, IaC, secrets)`): `package-lock.json` (production
  dependencies), the Dockerfiles, `deploy/k8s` and `deploy/terraform`, and secrets in any file.
  Gitleaks still scans the whole history (`ci.yml`).
- **Image scan** (in each `Image (...)` job): the operating-system packages and libraries of the built image, and secrets in its layers.
- **Reported:** HIGH and CRITICAL, in the job summary, in `trivy-*` artifacts, and as code scanning alerts
  (SARIF; categories `trivy-fs` and `trivy-image-<name>`).
- **Fails the build:** CRITICAL where a fixed version exists (`--ignore-unfixed`). A misconfiguration has no
  "fix available", so a CRITICAL misconfiguration fails unless `.trivyignore.yaml` explains it.
- **Ignores** live in `.trivyignore.yaml`, each with a reason and an expiry date, after which the finding
  fails the build again. Do not add one to get a build green; fix the finding or write down why it stays.

If the SARIF upload step shows a warning, the token could not write security events (a fork) or code
scanning is off. The scan and the gate still ran.

## ZAP baseline

`zap-baseline.py` from the pinned ZAP image spiders a target for a minute and reports what the responses
give away: missing or weak headers, cookie flags, version banners, error pages, comments in scripts. It
sends no attack traffic. It runs against the web image and the planning-core image, both started read-only
as in the cluster, on a Postgres built from every migration inside the job.

- `.zap/rules.tsv` says what each rule does. A rule not listed warns. `IGNORE` rows carry their reason.
- The build fails only on a rule set to `FAIL`; warnings are reported and do not fail it. Which rules are FAIL and why is in `documentation/evidence/EN-21/zap.md`.
- The scan is unauthenticated, so it sees the web app's public shell and the API's refusals, not what a signed-in user can do. An authenticated scan needs a way to sign in on a throwaway stack, which is a separate piece of work.
- Reports (HTML, JSON, Markdown) and the services' logs are the `zap-report` artifact.

## Changing the pins

- **Actions:** pin to a full commit SHA with the tag in a trailing comment. Resolve a tag with
  `gh api repos/<owner>/<repo>/git/ref/tags/<tag>` (an annotated tag needs one more hop through `git/tags/<sha>`).
  `node .github/scripts/check-action-pins.mjs` fails on anything else.
- **Trivy and syft:** the version and SHA-256 are in `.github/scripts/install-supply-chain-tools.sh`.
  Take the hash from the release's checksums file. They are installed as binaries, not as actions, so
  there is no moving tag to trust: Trivy's own action was compromised in March 2026.
- **cosign:** `sigstore/cosign-installer` is pinned by SHA and installs the cosign version named in `with:`.
- **ZAP and the test registry:** pinned by image digest in `supply-chain.yml`.

## What this does not cover

- Nothing here is a build provenance attestation (SLSA); the images are built with `provenance: false`.
- A signature says who built an image, not that it is safe. The Trivy and ZAP jobs are what says something about that, and they only know about published vulnerabilities and what a passive scan can see.
- Kubernetes admission control that refuses unsigned images (for example a Sigstore policy controller) is not set up, and there is no cluster yet to set it up on.
- Development dependencies are not scanned by Trivy (only what `npm ci --omit=dev` would install). The SBOM of the workspace lists all of them.
