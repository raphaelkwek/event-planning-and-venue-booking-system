# EN-21 — Software supply chain security

EN-21 is an enabler: it has no screens. Its cards check the delivery pipeline, and each is checked by
a job of the Supply chain workflow (`.github/workflows/supply-chain.yml`), or on main by the Deploy
workflow, rather than by a vitest test. Neither workflow is a required check.

| Criterion | Card | Status |
|---|---|---|
| SBOM: a CycloneDX SBOM per image and for the npm workspace, uploaded as artifacts. | EN-21-T1 | Pass |
| Trivy scans the filesystem (dependencies, IaC across deploy/ and the Dockerfiles, secrets); fails on CRITICAL with a fix; reports HIGH; SARIF to code scanning; findings triaged. | EN-21-T2 | Pass |
| Trivy scans each built image on the same terms. | EN-21-T3 | Pass |
| cosign: keyless signing of the images pushed to GHCR on main, SBOM attestations, and a verify step after signing. | EN-21-T4 | Not Executed |
| cosign on pull requests: sign-blob the SBOMs, and sign, attest and verify an image in a throwaway registry, with a verify step. | EN-21-T5 | Pass |
| ZAP baseline against the running web app and the planning-core API on a throwaway database, a rules file with justified ignores, the report uploaded and summarised. | EN-21-T6 | Pass |
| Third-party actions the pipeline adds are pinned by commit SHA. | EN-21-T7 | Pass |
| documentation/supply-chain.md explains how to verify an image's signature and SBOM. | EN-21-T8 | Not Executed |

T4 and T8 can only run after the first push to main: main has never run this pipeline, so nothing has
been signed in GHCR yet. T5 is the pull-request counterpart that does run, against a registry that
lives for the length of the job.
