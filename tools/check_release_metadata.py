#!/usr/bin/env python3
"""Validate the Uni-HWP release identity used by CI and publishing."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
METADATA_PATH = ROOT / "release" / "uni-hwp-release.json"
HISTORY_PATH = ROOT / "release" / "version-history.json"
ENGINE_PATHS = ("assets", "bindings", "npm", "samples", "src", "template", "tests", "ttfs", "typescript")
SEMVER = re.compile(r"^\d+\.\d+\.\d+$")


def engine_tree_hash() -> str:
    listing = subprocess.run(
        ["git", "ls-tree", "-r", "HEAD", "--", *ENGINE_PATHS],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
    ).stdout.encode()
    digest = subprocess.run(
        ["git", "hash-object", "--stdin"],
        cwd=ROOT,
        check=True,
        input=listing,
        capture_output=True,
    ).stdout.decode().strip()
    return f"git-tree-sha1:{digest}"


def load_json(path: Path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise SystemExit(f"invalid {path.relative_to(ROOT)}: {error}") from error


def validate(check_tree: bool = False) -> str:
    metadata = load_json(METADATA_PATH)
    history = load_json(HISTORY_PATH).get("releases")
    if not isinstance(history, list) or not history:
        raise SystemExit("release/version-history.json must contain releases")

    for key in ("productVersion", "shellVersion", "engineVersion", "engineTag", "releaseTag", "engineCommit", "engineSourceHash"):
        if not metadata.get(key):
            raise SystemExit(f"missing release metadata: {key}")
    if not SEMVER.fullmatch(metadata["productVersion"]):
        raise SystemExit("productVersion must be SemVer")
    if not SEMVER.fullmatch(metadata["shellVersion"]):
        raise SystemExit("shellVersion must be SemVer")
    if not SEMVER.fullmatch(metadata["engineVersion"]):
        raise SystemExit("engineVersion must be SemVer")
    if metadata["engineTag"] != f"v{metadata['engineVersion']}":
        raise SystemExit("engineTag must match engineVersion")
    if metadata["releaseTag"] != f"v{metadata['productVersion']}":
        raise SystemExit("external releaseTag must match productVersion")
    if metadata["releaseTag"].lstrip("v") == metadata["shellVersion"]:
        raise SystemExit("external releaseTag must not be the shell/API version")
    if metadata.get("compatibilityStatus") != "compatible":
        raise SystemExit("release candidate is not compatible")

    current = next((item for item in history if item.get("releaseTag") == metadata["releaseTag"]), None)
    if current is None:
        raise SystemExit("current release is missing from version history")
    for key in ("productVersion", "shellVersion", "engineVersion", "engineTag"):
        if current.get(key) != metadata[key]:
            raise SystemExit(f"version history mismatch: {key}")
    release_tags = [item.get("releaseTag") for item in history]
    if len(release_tags) != len(set(release_tags)):
        raise SystemExit("duplicate releaseTag in version history")
    if check_tree and metadata["engineSourceHash"] != engine_tree_hash():
        raise SystemExit("engineSourceHash does not match the checked-out engine tree")
    return "release metadata: valid"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check-engine-tree", action="store_true")
    args = parser.parse_args()
    print(validate(args.check_engine_tree))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
