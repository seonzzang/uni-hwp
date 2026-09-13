"""CLI for the Uni-HWP RHWP engine update foundation."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

try:
    from .engine_update import DEFAULT_UPSTREAM_REPOSITORY, EngineUpdateError, UpdateManager, latest_stable_release
except ImportError:  # direct `python tools/engine-update/cli.py` invocation
    from engine_update import DEFAULT_UPSTREAM_REPOSITORY, EngineUpdateError, UpdateManager, latest_stable_release


def main() -> int:
    parser = argparse.ArgumentParser(prog="uni-hwp-engine-update")
    parser.add_argument("command", choices=("status", "check", "latest", "prepare", "prepare-latest", "update", "apply", "rollback"))
    parser.add_argument("--repo", default=".")
    parser.add_argument("--repository", default=DEFAULT_UPSTREAM_REPOSITORY)
    parser.add_argument("--source")
    parser.add_argument("--candidate")
    parser.add_argument("--metadata")
    parser.add_argument("--journal")
    args = parser.parse_args()
    manager = UpdateManager(args.repo)
    if args.command == "status":
        output = manager.status()
    elif args.command == "check":
        metadata = json.loads(Path(args.metadata).read_text(encoding="utf-8")) if args.metadata else None
        output = manager.check(metadata)
    elif args.command == "latest":
        output = latest_stable_release(args.repository or DEFAULT_UPSTREAM_REPOSITORY)
    elif args.command == "prepare":
        if not args.source or not args.metadata:
            parser.error("prepare requires --source and --metadata")
        metadata = json.loads(Path(args.metadata).read_text(encoding="utf-8"))
        output = {"candidate": str(manager.prepare(args.source, metadata))}
    elif args.command == "prepare-latest":
        output = {"candidate": str(manager.prepare_latest(args.repository or DEFAULT_UPSTREAM_REPOSITORY))}
    elif args.command == "update":
        output = manager.update(args.candidate, args.repository or DEFAULT_UPSTREAM_REPOSITORY)
    elif args.command == "apply":
        if not args.candidate:
            parser.error("apply requires --candidate")
        output = manager.apply(args.candidate)
    else:
        manager.rollback(args.journal)
        output = {"rolled_back": True}
    print(json.dumps(output, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except EngineUpdateError as exc:
        print(json.dumps({"error": str(exc)}, indent=2), file=sys.stderr)
        raise SystemExit(2) from exc
