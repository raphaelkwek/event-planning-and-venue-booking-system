"""EN-10: policy checks on a rendered overlay (kustomize output), beyond schema validity.

Fails if the planning-core or registration API is not a Rollout with the canary steps
10%, analyse, 50%, analyse, 100% (EN-16), if the rendered manifests contain a Secret, or if any workload container is not
hardened and sized: non-root pod, no privilege escalation, read-only root filesystem,
all capabilities dropped, resource requests and limits, and no :latest image.

    python3 deploy/ci/check-rendered.py rendered-overlays-staging.yaml
    python3 deploy/ci/check-rendered.py --no-canary rendered-k3s-staging.yaml   # ADR-0016

The k3s overlays (ADR-0016) run plain Deployments, because their canary analysis would need
EN-17's Prometheus; --no-canary skips that one check and keeps every other.
"""

import sys

import yaml

WORKLOADS = ("Deployment", "Rollout", "Job", "StatefulSet")
CANARY_APIS = ("planning-core", "registration")
CANARY_STEPS = ["setWeight:10", "analysis:error-rate-and-p95", "setWeight:50", "analysis:error-rate-and-p95", "setWeight:100"]


def step_signature(step: dict) -> str:
    if "setWeight" in step:
        return f"setWeight:{step['setWeight']}"
    if "analysis" in step:
        return "analysis:" + ",".join(t["templateName"] for t in step["analysis"]["templates"])
    return "other"


def canary_problems(docs: list[dict], path: str) -> list[str]:
    problems: list[str] = []
    rollouts = {d["metadata"]["name"]: d for d in docs if d.get("kind") == "Rollout"}
    for name in CANARY_APIS:
        if name not in rollouts:
            problems.append(f"{path}: {name} is not a Rollout")
            continue
        steps = [step_signature(s) for s in rollouts[name]["spec"]["strategy"]["canary"]["steps"]]
        if steps != CANARY_STEPS:
            problems.append(f"{path}: {name} canary steps are {steps}, expected {CANARY_STEPS}")
        if any(d.get("kind") == "Deployment" and d["metadata"]["name"] == name for d in docs):
            problems.append(f"{path}: {name} is still a Deployment as well")
        for hpa in (d for d in docs if d.get("kind") == "HorizontalPodAutoscaler" and d["metadata"]["name"] == name):
            if hpa["spec"]["scaleTargetRef"]["kind"] != "Rollout":
                problems.append(f"{path}: the {name} HorizontalPodAutoscaler does not target the Rollout")
    return problems


def problems_in(path: str, canary: bool = True) -> list[str]:
    problems: list[str] = []
    docs = [d for d in yaml.safe_load_all(open(path, encoding="utf-8")) if d]
    if canary:
        problems.extend(canary_problems(docs, path))
    for doc in docs:
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
        for container in spec.get("initContainers", []) + spec["containers"]:
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
    args = sys.argv[1:]
    canary = "--no-canary" not in args
    paths = [a for a in args if a != "--no-canary"]
    problems = [p for path in paths for p in problems_in(path, canary)]
    for problem in problems:
        print(f"::error::{problem}")
    if not problems:
        print(f"ok: {len(paths)} rendered overlays pass the hardening checks")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
