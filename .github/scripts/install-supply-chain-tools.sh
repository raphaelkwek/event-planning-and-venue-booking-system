#!/usr/bin/env bash
# EN-21. Installs Trivy and/or syft on a CI runner from their GitHub releases and checks each
# download against a SHA-256 that is pinned here, the way ci.yml installs gitleaks. They are
# binaries, not actions, on purpose: Trivy's own action was compromised in March 2026, and a
# pinned hash on a pinned version leaves nothing to resolve at run time.
#
#   .github/scripts/install-supply-chain-tools.sh trivy syft
#
# To move to a newer release, change the version and take the hash from the release's
# checksums file (trivy_<v>_checksums.txt, syft_<v>_checksums.txt), then read the release notes.
set -euo pipefail

TRIVY_VERSION=0.76.1
TRIVY_SHA256=c7cbe3137fb8a48a17574bede3dd6beb16742d1e9772929940fc90082c39d9c0
SYFT_VERSION=1.55.0
SYFT_SHA256=bb65249542db5fedeeb4d3f9b018b75e7264dbfbbb10486f044581a92f90490d

bin_dir="${HOME}/.local/bin"
mkdir -p "${bin_dir}"
work="$(mktemp -d)"
trap 'rm -rf "${work}"' EXIT

fetch() { # <url> <sha256> <file> <binary>
  curl -sSfL --retry 3 -o "${work}/$3" "$1"
  echo "$2  ${work}/$3" | sha256sum --check --status || { echo "::error::checksum of $3 does not match the pinned value"; exit 1; }
  tar -xzf "${work}/$3" -C "${bin_dir}" "$4"
}

for tool in "$@"; do
  case "${tool}" in
    trivy)
      fetch "https://github.com/aquasecurity/trivy/releases/download/v${TRIVY_VERSION}/trivy_${TRIVY_VERSION}_Linux-64bit.tar.gz" \
        "${TRIVY_SHA256}" trivy.tar.gz trivy
      ;;
    syft)
      fetch "https://github.com/anchore/syft/releases/download/v${SYFT_VERSION}/syft_${SYFT_VERSION}_linux_amd64.tar.gz" \
        "${SYFT_SHA256}" syft.tar.gz syft
      ;;
    *) echo "::error::unknown tool ${tool}"; exit 1 ;;
  esac
done

# Later steps of the job find them here.
if [ -n "${GITHUB_PATH:-}" ]; then echo "${bin_dir}" >> "${GITHUB_PATH}"; fi
PATH="${bin_dir}:${PATH}"
for tool in "$@"; do "${tool}" version | head -3; done
