# EN-10-T8 — A teammate follows documentation/deploy.md to build, push, provision, bootstrap Argo CD, promote and roll back

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-10-T8 |
| Test Scenario | A teammate follows documentation/deploy.md to build, push, provision, bootstrap Argo CD, promote and roll back |
| Pre-conditions | 1. An AWS account, a GitHub token that can read packages, `kubectl`, `terraform` and `kustomize` on the teammate's machine. |
| Test Steps | 1. Follow `documentation/deploy.md` from the top, using the staging environment.<br>2. Note every step that is unclear or fails. |
| Test Data | The team's AWS account and cluster, once they exist. |
| Expected Result | Staging runs from a merge, and a canary can be promoted and rolled back with the commands in the guide. |
| Acceptance criterion | README deploy steps. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Not run. Needs a cloud account and a cluster. |
| Status | Not Executed |
| Remarks | Not run: the guide's path needs an AWS account and an EKS cluster, which the team never had; ADR-0016 replaced it (k3s, then one Azure VM in its amendment), so this case cannot be run as written. The live path is covered by DEPLOY-T12 and DEPLOY-T15. · Defect: — |
| Executed By |  |
| Date of Execution |  |
