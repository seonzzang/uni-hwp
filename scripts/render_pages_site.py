#!/usr/bin/env python3
from pathlib import Path
import os
import sys


def main() -> int:
    if len(sys.argv) != 4:
        raise SystemExit("usage: render_pages_site.py INPUT OUTPUT RELEASE_VERSION")
    input_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2])
    release_version = sys.argv[3]
    deploy_time = Path(output_path.parent / "deploy_time.txt").read_text(encoding="utf-8")
    release_history_rows = Path(output_path.parent / "release_history_rows.html").read_text(encoding="utf-8")
    source = input_path.read_text(encoding="utf-8")
    source = source.replace("__RELEASE_VERSION__", release_version)
    source = source.replace("__DEPLOYED_AT__", deploy_time)
    source = source.replace("__RELEASE_HISTORY_ROWS__", release_history_rows)
    output_path.write_text(source, encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
