"""Finalize the B Luna document gate without changing the source corpus.

This consumes an already completed baseline run, writes a classified manifest,
and keeps product failures separate from fixture-scope and environment gaps.
It deliberately never turns a timeout or an unsupported format into PASS.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import sys
import time
from pathlib import Path
from typing import Any


TIMEOUT_SAMPLES = {
    "hwp3-sample10-hwp5.hwp",
    "hwp3-sample10.hwp",
    "issue_2063_huge_cellbreak_table.hwp",
    "task2070/1130000-201900011_D0150004-1-002_2017년기준 시장구조조사.hwp",
}
PASSWORD_SAMPLES = {
    "HWP3-password-123456.hwp",
    "hwp3-sample16-hwp5-2024-password-123456.hwp",
}


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8-sig"))


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def magic_format(path: Path) -> str:
    head = path.read_bytes()[:8]
    if head.startswith(b"PK\x03\x04"):
        return "hwpx"
    if head.startswith(b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"):
        return "hwp-ole"
    return "unknown"


def classify(sample: str, evidence: Path, root: Path) -> tuple[str, str, str]:
    path = root / "samples" / sample
    result = read_json(evidence / "result.json")
    bench = result.get("bench", {})
    if isinstance(bench, list):
        bench = bench[-1] if bench and isinstance(bench[-1], dict) else {}
    roundtrip = result.get("roundtrip", {})
    if isinstance(roundtrip, list):
        roundtrip = roundtrip[-1] if roundtrip and isinstance(roundtrip[-1], dict) else {}
    out = "\n".join(
        [
            str(roundtrip.get("Stdout", "")),
            str(roundtrip.get("Stderr", "")),
            str(bench.get("Stdout", "")),
            str(bench.get("Stderr", "")),
        ]
    )
    if "비밀번호가 필요한 암호 문서" in out or "password" in sample.lower():
        return "password-required", "password-required", "password is required before parse/roundtrip can be judged"
    if "실체 HWP3" in out or magic_format(path) == "hwp-ole" and sample.lower().startswith(("hwp3-", "issue_265", "issue1892_", "issue1950_")):
        return "hwp3", "hwp3-gate", "HWP3 is outside the HWP5 roundtrip gate"
    if "실체 HWPX" in out or magic_format(path) == "hwpx":
        return "hwpx", "hwpx-gate", "HWPX requires the HWPX roundtrip gate"
    if magic_format(path) == "hwp-ole":
        return "hwp5", "hwp5-gate", "HWP5 baseline gate"
    return "unknown", "format-gate", "magic format could not be established"


def run_stdin(exe: Path, args: list[str], password: bytes, timeout: int) -> dict[str, Any]:
    started = time.monotonic()
    try:
        p = subprocess.run(
            [str(exe), *args], input=password + b"\n", capture_output=True,
            timeout=timeout, cwd=exe.parent.parent,
        )
        return {"status": "PASS" if p.returncode == 0 else "FAIL", "exit_code": p.returncode,
                "elapsed_ms": round((time.monotonic() - started) * 1000),
                "stdout": p.stdout.decode("utf-8", "replace"), "stderr": p.stderr.decode("utf-8", "replace")}
    except subprocess.TimeoutExpired as e:
        return {"status": "UNVERIFIED_TIMEOUT", "exit_code": 124,
                "elapsed_ms": round((time.monotonic() - started) * 1000),
                "stdout": (e.stdout or b"").decode("utf-8", "replace") if isinstance(e.stdout, bytes) else (e.stdout or ""),
                "stderr": (e.stderr or b"").decode("utf-8", "replace") if isinstance(e.stderr, bytes) else (e.stderr or "")}


def run_extended(root: Path, out: Path, exe: Path, timeout: int) -> list[dict[str, Any]]:
    report = list(csv_rows(out / "report.tsv"))
    rows = [r for r in report if r["sample"] in TIMEOUT_SAMPLES]
    ext = out / "extended-timeout"
    ext.mkdir(exist_ok=True)
    result_rows = []
    for row in rows:
        sample = row["sample"]
        dest = ext / hashlib.sha256(sample.encode()).hexdigest()[:12]
        dest.mkdir(exist_ok=True)
        source = root / "samples" / sample
        commands = {
            "bench": ["bench", str(source), "-n", "1", "--tsv", str(dest / "bench.tsv")],
            "roundtrip": ["hwp5-roundtrip", str(source), "-o", str(dest)],
        }
        entry = {"sample": sample, "timeout_sec": timeout, "evidence_dir": str(dest.relative_to(root)).replace("\\", "/"), "commands": {}}
        for name, cmd in commands.items():
            started = time.monotonic()
            try:
                p = subprocess.run([str(exe), *cmd], capture_output=True, timeout=timeout, cwd=root)
                status = "PASS" if p.returncode == 0 else "FAIL"
                stdout, stderr = p.stdout.decode("utf-8", "replace"), p.stderr.decode("utf-8", "replace")
                if "FORMAT_SKIP" in stdout:
                    status = "FORMAT_UNVERIFIED"
            except subprocess.TimeoutExpired as e:
                status, stdout, stderr = "UNVERIFIED_TIMEOUT", "", "process exceeded extended timeout"
            (dest / f"{name}.stdout").write_text(stdout, encoding="utf-8")
            (dest / f"{name}.stderr").write_text(stderr, encoding="utf-8")
            entry["commands"][name] = {"status": status, "exit_code": 0 if status in {"PASS", "FORMAT_UNVERIFIED"} else 124 if status == "UNVERIFIED_TIMEOUT" else 1, "elapsed_ms": round((time.monotonic() - started) * 1000), "stdout_bytes": len(stdout.encode()), "stderr_bytes": len(stderr.encode())}
        entry["interpretation"] = "format-scope exclusion" if "hwp3-" in sample or sample == "issue_2063_huge_cellbreak_table.hwp" else "environment/performance unverified until extended run completes"
        (dest / "result.json").write_text(json.dumps(entry, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        result_rows.append(entry)
    return result_rows


def csv_rows(path: Path):
    import csv
    with path.open(encoding="utf-8-sig", newline="") as f:
        yield from csv.DictReader(f, delimiter="\t")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    ap.add_argument("--baseline-dir", type=Path, required=True)
    ap.add_argument("--extended-timeout-sec", type=int, default=180)
    ap.add_argument("--run-extended", action="store_true")
    ap.add_argument("--password", action="store_true", help="run only the known 123456 fixture checks; the value is never logged")
    args = ap.parse_args()
    root = args.root.resolve()
    out = (root / args.baseline_dir).resolve() if not args.baseline_dir.is_absolute() else args.baseline_dir.resolve()
    report_path = out / "report.tsv"
    exe = root / "target" / "debug" / "rhwp.exe"
    if not report_path.exists() or not exe.exists():
        raise SystemExit(f"missing baseline report or executable: {report_path} / {exe}")

    entries = []
    for row in csv_rows(report_path):
        evidence = root / row["evidence_dir"]
        fmt, gate, note = classify(row["sample"], evidence, root)
        entries.append({"sample": row["sample"], "bytes": int(row["bytes"]), "sha256": sha256(root / "samples" / row["sample"]),
                        "format": fmt, "gate": gate, "note": note, "baseline": row})
    manifest = {"schema": 1, "source": "existing baseline report; source files unchanged", "baseline_dir": str(out.relative_to(root)).replace("\\", "/"),
                "total": len(entries), "gates": {k: [e["sample"] for e in entries if e["gate"] == k] for k in ["hwp5-gate", "hwp3-gate", "hwpx-gate", "password-required", "format-gate"]}, "entries": entries}
    (out / "final-corpus-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    extended = run_extended(root, out, exe, args.extended_timeout_sec) if args.run_extended else []
    password_results = []
    if args.password:
        pw = b"123456"
        for sample in sorted(PASSWORD_SAMPLES):
            source = root / "samples" / sample
            if not source.exists():
                continue
            result = run_stdin(exe, ["info", str(source), "--password-stdin"], pw, 60)
            result.pop("stdout", None); result.pop("stderr", None)
            result["sample"] = sample; result["condition"] = "known fixture password supplied through stdin; secret omitted"
            password_results.append(result)
        (out / "password-gate.json").write_text(json.dumps(password_results, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    baseline_failures = [e for e in entries if e["baseline"]["bench_status"] == "FAIL" and e["format"] == "hwp5"]
    hwp5 = [e for e in entries if e["gate"] == "hwp5-gate"]
    hwp5_pass = [e for e in hwp5 if e["baseline"]["bench_status"] == "PASS" and e["baseline"]["roundtrip_status"] == "PASS"]
    unresolved_timeout = [e for e in entries if e["sample"] in TIMEOUT_SAMPLES and not any(x["sample"] == e["sample"] and all(c["status"] != "UNVERIFIED_TIMEOUT" for c in x["commands"].values()) for x in extended)]
    summary = {"schema": 1, "status": "FAIL" if baseline_failures or unresolved_timeout or not password_results or any(r["status"] != "PASS" for r in password_results) else "PASS",
               "release_pass": False, "release_pass_reason": "final gate contains explicit fixture/environment gates and is not a release approval",
               "product_regression": {"status": "FAIL" if baseline_failures else "PASS", "hwp5_pass": len(hwp5_pass), "hwp5_total": len(hwp5), "failures": [e["sample"] for e in baseline_failures]},
               "fixture_scope": {"status": "UNVERIFIED" if not password_results or any(r["status"] != "PASS" for r in password_results) else "PASS", "hwp3": len(manifest["gates"]["hwp3-gate"]), "hwpx": len(manifest["gates"]["hwpx-gate"]), "password_required": len(manifest["gates"]["password-required"]), "password_results": password_results},
               "environment": {"status": "UNVERIFIED" if unresolved_timeout else "RECORDED", "timeout_samples": [e["sample"] for e in unresolved_timeout], "extended_timeout_sec": args.extended_timeout_sec, "policy": "timeout is never PASS; preserve process diagnostics and rerun with explicit extended timeout"},
               "evidence": {"manifest": "final-corpus-manifest.json", "extended": "extended-timeout/", "password": "password-gate.json" if args.password else None}}
    (out / "final-summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": summary["status"], "hwp5": f"{len(hwp5_pass)}/{len(hwp5)}", "extended": len(extended), "password": len(password_results), "output": str(out)}, ensure_ascii=False))
    return 1 if summary["status"] == "FAIL" else 0


if __name__ == "__main__":
    raise SystemExit(main())
