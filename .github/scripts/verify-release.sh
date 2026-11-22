#!/usr/bin/env bash
set -euo pipefail

if [[ "$#" -ne 1 ]]; then
  echo "usage: verify-release.sh <tag>" >&2
  exit 2
fi

TAG="$1"
CORE='(0|[1-9][0-9]*)'
IDENT='(0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*)'
SEMVER="^v${CORE}\\.${CORE}\\.${CORE}(-${IDENT}(\\.${IDENT})*)?(\\+[0-9A-Za-z-]+(\\.[0-9A-Za-z-]+)*)?$"

if [[ ! "$TAG" =~ $SEMVER ]]; then
  echo "release tag is not strict v-prefixed SemVer: $TAG" >&2
  exit 1
fi
if ! git show-ref --verify --quiet "refs/tags/$TAG"; then
  echo "release tag does not exist: $TAG" >&2
  exit 1
fi

VERSION="$(
  cargo metadata --locked --no-deps --format-version 1 |
    python3 -c '
import json
import sys

metadata = json.load(sys.stdin)
versions = [
    package["version"]
    for package in metadata["packages"]
    if package["name"] == "tauri-plugin-window-decorations"
]
if len(versions) != 1:
    raise SystemExit("expected exactly one tauri-plugin-window-decorations package")
print(versions[0])
'
)"
if [[ "$TAG" != "v$VERSION" ]]; then
  echo "release tag does not match Cargo package version: tag=$TAG version=$VERSION" >&2
  exit 1
fi
