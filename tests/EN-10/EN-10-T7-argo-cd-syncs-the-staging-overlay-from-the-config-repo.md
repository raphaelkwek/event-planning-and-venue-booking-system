# EN-10-T7 — Argo CD syncs the staging overlay from this repository, with automated sync and self-heal

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-10-T7 |
| Test Scenario | Argo CD syncs the staging overlay from this repository, with automated sync and self-heal |
| Pre-conditions | 1. The Deploy workflow runs `Argo CD syncs the staging overlay (kind)`.<br>2. The repository is public, so Argo CD needs no credentials. |
| Test Steps | 1. Open the `Argo CD syncs the staging overlay (kind)` job.<br>2. Check it installed Argo CD, applied `deploy/argocd/appproject.yaml` and `application-staging.yaml` (with only the revision, this build's images and the worker's replica count overridden, shown in the uploaded `applied-application.yaml`), and waited for `Synced` and `Healthy`.<br>3. Check the self-heal step: a ConfigMap deleted by hand was recreated by Argo CD. |
| Test Data | The staging Application: automated sync, prune and self-heal, path `deploy/k8s/overlays/staging`. |
| Expected Result | The Application reaches Synced and Healthy at the pull request's commit, including its PreSync migration hook, and heals the deleted ConfigMap. Not shown: the Application pointing at `main` (that happens after the merge), and a real cluster's ingress controller (an Ingress without one is treated as healthy in this run only). |
| Acceptance criterion | Argo CD Application manifests syncing the staging overlay from the config repo, validated with kubeconform and, where practical, shown syncing in kind. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Argo CD v2.14.11 synced deploy/k8s/overlays/staging from this public repo at the PR commit: Synced and Healthy with the PreSync migrate hook, and a ConfigMap deleted by hand was recreated. |
| Status | Pass |
| Remarks | Commit: 7f31fe5f8158bc75ca285a38e4ccca713e778a9f · Automated · Evidence: .github/workflows/deploy.yml › job 'Argo CD syncs the staging overlay (kind)'; kubeconform in job 'Manifests (kustomize and kubeconform)', CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41511260190 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
