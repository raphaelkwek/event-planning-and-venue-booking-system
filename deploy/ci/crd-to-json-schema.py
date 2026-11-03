#!/usr/bin/env python3
"""Turns CustomResourceDefinition files into the JSON schemas kubeconform reads (EN-20).

The Datree CRDs catalog has no Chaos Mesh, so CI downloads the pinned CRDs and converts them here, the way
kubeconform's own openapi2jsonschema.py does: one <kind>_<version>.json per served version, in strict mode
(a field the CRD does not define is an error), with Kubernetes' int-or-string and unknown-field markers
translated to JSON Schema.

usage: crd-to-json-schema.py <out-dir> <crd.yaml>...
"""
import json
import pathlib
import sys

import yaml


def strict(node):
    """The schema with objects closed to unknown fields, unless the CRD says to keep them."""
    if isinstance(node, list):
        return [strict(item) for item in node]
    if not isinstance(node, dict):
        return node
    out = {key: strict(value) for key, value in node.items() if not key.startswith("x-kubernetes-")}
    if node.get("x-kubernetes-int-or-string"):
        out.pop("type", None)
        out["oneOf"] = [{"type": "integer"}, {"type": "string"}]
    if "properties" in out and "additionalProperties" not in out and not node.get("x-kubernetes-preserve-unknown-fields"):
        out["additionalProperties"] = False
    return out


def main(out_dir, files):
    out = pathlib.Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    written = []
    for file in files:
        for doc in yaml.safe_load_all(pathlib.Path(file).read_text(encoding="utf-8")):
            if not doc or doc.get("kind") != "CustomResourceDefinition":
                continue
            kind = doc["spec"]["names"]["kind"].lower()
            for version in doc["spec"]["versions"]:
                if not version.get("served", True):
                    continue
                schema = strict(version["schema"]["openAPIV3Schema"])
                target = out / f"{kind}_{version['name']}.json"
                target.write_text(json.dumps(schema, indent=1), encoding="utf-8")
                written.append(target.name)
    if not written:
        sys.exit("no CustomResourceDefinition found")
    print("wrote", ", ".join(sorted(written)))


if __name__ == "__main__":
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2:])
