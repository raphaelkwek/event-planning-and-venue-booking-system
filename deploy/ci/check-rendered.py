"""EN-10: policy checks on a rendered overlay (kustomize output), beyond schema validity.

Fails if the rendered manifests contain a Secret, or if any workload container is not
hardened and sized: non-root pod, no privilege escalation, read-only root filesystem,
all capabilities dropped, resource requests and limits, and no :latest image.

    python3 deploy/ci/check-rendered.py rendered-overlays-staging.yaml
"""

import sys

import yaml

WORKLOADS = ("Deployment", "Rollout", "Job")


def problems_in(path: str) -> list[str]:
    problems: list[str] = []
    for doc in yaml.safe_load_all(open(path, encoding="utf-8")):
        if not doc:
            continue
        kind = doc.get("kind")
        if kind == "Secret":
            problems.append(f"{path}: contains a Secret ({doc['metadata']['name']}); values must come from outside git")
        if kind not in WORKLOADS:
            continue
        name = f"{kind}/{doc['metadata']['name']}"
        spec = doc["spec"]["template"]["spec"]
        if not spec.get("securityContext", {}).get("runAsNonRoot"):
            problems.append(f"{name}: pod runAsNonRoot is not set")
        if spec.get("automountServiceAccountToken") is not False:
            problems.append(f"{name}: automountServiceAccountToken is not false")
        for container in spec["containers"]:
            who = f"{name}/{container['name']}"
            security = container.get("securityContext", {})
            if security.get("allowPrivilegeEscalation") is not False:
                problems.append(f"{who}: allowPrivilegeEscalation is not false")
            if security.get("readOnlyRootFilesystem") is not True:
                problems.append(f"{who}: readOnlyRootFilesystem is not true")
            if security.get("capabilities", {}).get("drop") != ["ALL"]:
                problems.append(f"{who}: capabilities.drop is not [ALL]")
            resources = container.get("resources", {})
            if not (resources.get("requests") and resources.get("limits")):
                problems.append(f"{who}: resource requests and limits are required")
            if container["image"].endswith(":latest"):
                problems.append(f"{who}: image uses :latest")
    return problems


def main() -> int:
    problems = [p for path in sys.argv[1:] for p in problems_in(path)]
    for problem in problems:
        print(f"::error::{problem}")
    if not problems:
        print(f"ok: {len(sys.argv) - 1} rendered overlays pass the hardening checks")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
