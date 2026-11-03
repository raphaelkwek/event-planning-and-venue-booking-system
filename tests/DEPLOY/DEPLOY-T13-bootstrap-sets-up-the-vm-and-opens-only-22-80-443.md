# DEPLOY-T13 — bootstrap.sh installs k3s, cert-manager, Argo CD, the namespaces and Applications, opens only 22, 80 and 443, and is safe to run twice

## Specification

| Item | Content |
|---|---|
| Test Case ID | DEPLOY-T13 |
| Test Scenario | bootstrap.sh installs k3s, cert-manager, Argo CD, the namespaces and Applications, opens only 22, 80 and 443, and is safe to run twice |
| Pre-conditions | 1. An Oracle Always Free Ampere VM on Ubuntu, reachable over SSH. |
| Test Steps | 1. Run `sudo bash deploy/oracle/bootstrap.sh` with the arguments in the runbook.<br>2. Run it again.<br>3. From outside, probe ports 22, 80, 443 and 6443. |
| Test Data | None. |
| Expected Result | Step 1 ends with both Applications created and the deploy user set up; step 2 changes nothing; step 3 finds only 22, 80 and 443 open. |
| Acceptance criterion | An idempotent bootstrap.sh run once on the VM over SSH, opening only 80 and 443 (plus 22). |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | — |
| Status | Blocked |
| Remarks | Blocked: no Oracle VM exists yet. Proven in CI: shellcheck passes on bootstrap.sh, and the deployer RBAC and kubeconfig it makes are the ones the kind job uses (DEPLOY-T7). |
| Executed By | — |
| Date of Execution | — |
