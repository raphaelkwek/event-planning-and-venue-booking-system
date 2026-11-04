"""ADR-0016: staging and production must differ only in credentials and hostnames.

Credentials never appear in a render (they are in the GitHub environments), so this checks
the other half: once the four names that are allowed to differ are put back to a common
placeholder, the rendered k3s-staging and k3s-production overlays must be identical. Any
other difference (a replica count, an image, a setting, a resource that one has and the
other has not) fails.

    python3 deploy/ci/check-parity.py rendered-k3s-staging.yaml rendered-k3s-production.yaml
"""

import difflib
import sys

import yaml

# What may differ, per environment: the namespace, the placeholder API host the deploy
# state replaces, the TLS Secret name and the Traefik middleware reference (it names the
# namespace).
ALLOWED = {
    "staging": [
        ("connectsphere-staging-strip-service-prefix@kubernetescrd", "ENV-strip-service-prefix@kubernetescrd"),
        ("connectsphere-staging-api-tls", "ENV-api-tls"),
        ("api.staging.connectsphere.invalid", "API_HOST"),
        ("connectsphere-staging", "ENV"),
    ],
    "production": [
        ("connectsphere-production-strip-service-prefix@kubernetescrd", "ENV-strip-service-prefix@kubernetescrd"),
        ("connectsphere-production-api-tls", "ENV-api-tls"),
        ("api.production.connectsphere.invalid", "API_HOST"),
        ("connectsphere-production", "ENV"),
    ],
}


def normalised(path: str, environment: str) -> list[str]:
    text = open(path, encoding="utf-8").read()
    for actual, placeholder in ALLOWED[environment]:
        text = text.replace(actual, placeholder)
    docs = [d for d in yaml.safe_load_all(text) if d]
    docs.sort(key=lambda d: (d.get("kind", ""), d.get("metadata", {}).get("name", "")))
    return yaml.safe_dump_all(docs, sort_keys=True).splitlines()


def main() -> int:
    staging, production = sys.argv[1], sys.argv[2]
    a = normalised(staging, "staging")
    b = normalised(production, "production")
    if a == b:
        print(f"ok: {staging} and {production} differ only in the namespace, the API host, the TLS Secret name and the middleware reference")
        return 0
    print("::error::the k3s overlays differ in more than the namespace, the host and the Secret names:")
    for line in difflib.unified_diff(a, b, "staging (normalised)", "production (normalised)", lineterm="", n=2):
        print(line)
    return 1


if __name__ == "__main__":
    sys.exit(main())
