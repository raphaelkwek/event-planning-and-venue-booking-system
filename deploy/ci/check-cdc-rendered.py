"""EN-05: policy checks on the rendered CDC component, beyond schema validity (EN-05-T9).

Fails if the rendered Debezium Server is not one replica with the Recreate strategy (a
replication slot has one consumer), if the pod does not use the host network the IPv6-only
direct connection needs, if its container is not hardened and sized, if the manifests
contain a Secret, or if a credential is a literal value instead of a secretKeyRef.

    python3 deploy/ci/check-cdc-rendered.py rendered-cdc.yaml
"""

import sys

import yaml

CREDENTIAL_WORDS = ("PASSWORD", "USER", "HOST", "BROKERS", "TOKEN", "SECRET")


def problems_in(path: str) -> list[str]:
    problems: list[str] = []
    docs = [d for d in yaml.safe_load_all(open(path, encoding="utf-8")) if d]
    by_kind = {kind: [d for d in docs if d.get("kind") == kind] for kind in ("Deployment", "ConfigMap", "PersistentVolumeClaim", "Secret")}

    for secret in by_kind["Secret"]:
        problems.append(f"{path}: contains a Secret ({secret['metadata']['name']}); values must come from outside git")

    deployments = [d for d in by_kind["Deployment"] if d["metadata"]["name"] == "debezium-server"]
    if len(deployments) != 1:
        return problems + [f"{path}: expected one Deployment named debezium-server, found {len(deployments)}"]
    spec = deployments[0]["spec"]
    pod = spec["template"]["spec"]

    if spec.get("replicas") != 1:
        problems.append(f"{path}: debezium-server runs {spec.get('replicas')} replicas; a slot has one consumer")
    if spec.get("strategy", {}).get("type") != "Recreate":
        problems.append(f"{path}: debezium-server must use the Recreate strategy so two pods never contend for the slot")
    if pod.get("hostNetwork") is not True:
        problems.append(f"{path}: debezium-server must use hostNetwork to reach an IPv6-only database from a single-stack pod network")
    if pod.get("hostNetwork") and pod.get("dnsPolicy") != "ClusterFirstWithHostNet":
        problems.append(f"{path}: a host-network pod needs dnsPolicy ClusterFirstWithHostNet to resolve cluster names")
    if not pod.get("securityContext", {}).get("runAsNonRoot"):
        problems.append(f"{path}: the pod does not set runAsNonRoot")

    for container in pod["containers"]:
        name = container["name"]
        image = container["image"]
        if image.endswith(":latest") or ":" not in image.rsplit("/", 1)[-1]:
            problems.append(f"{path}: {name} uses an unpinned image ({image})")
        context = container.get("securityContext", {})
        if context.get("allowPrivilegeEscalation") is not False:
            problems.append(f"{path}: {name} allows privilege escalation")
        if context.get("readOnlyRootFilesystem") is not True:
            problems.append(f"{path}: {name} has a writable root filesystem")
        if "ALL" not in context.get("capabilities", {}).get("drop", []):
            problems.append(f"{path}: {name} does not drop all capabilities")
        resources = container.get("resources", {})
        if not resources.get("requests") or not resources.get("limits"):
            problems.append(f"{path}: {name} has no resource requests and limits")
        for env in container.get("env", []):
            if any(word in env["name"] for word in CREDENTIAL_WORDS) and "valueFrom" not in env:
                problems.append(f"{path}: {name} sets {env['name']} to a literal value; use a secretKeyRef")

    config_names = {c["metadata"]["name"] for c in by_kind["ConfigMap"]}
    claim_names = {c["metadata"]["name"] for c in by_kind["PersistentVolumeClaim"]}
    for volume in pod.get("volumes", []):
        if "configMap" in volume and volume["configMap"]["name"] not in config_names:
            problems.append(f"{path}: volume {volume['name']} names a ConfigMap that is not rendered ({volume['configMap']['name']})")
        if "persistentVolumeClaim" in volume and volume["persistentVolumeClaim"]["claimName"] not in claim_names:
            problems.append(f"{path}: volume {volume['name']} names a claim that is not rendered")
    return problems


if __name__ == "__main__":
    found = [problem for path in sys.argv[1:] for problem in problems_in(path)]
    for problem in found:
        print(f"::error::{problem}")
    if found:
        sys.exit(1)
    print("The CDC component renders as one hardened, host-network Debezium Server.")
