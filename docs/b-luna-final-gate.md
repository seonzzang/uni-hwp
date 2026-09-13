# B Luna final gate

`tools/finalize_b_luna_gate.py` consumes the completed baseline run and writes
`final-corpus-manifest.json` and `final-summary.json` beside it. The original
`summary.json`, `report.tsv`, and per-file evidence are retained as the raw
run. No timeout is promoted to PASS.

Example for the 2026-09-13 run:

```powershell
python tools/finalize_b_luna_gate.py `
  --baseline-dir output/release-gate-20260913/hwp5-baseline-380-fixed `
  --run-extended --extended-timeout-sec 180 --password
```

The manifest has separate `hwp5-gate`, `hwp3-gate`, `hwpx-gate`, and
`password-required` buckets. Password fixtures are invoked in a separate
process with the known fixture password on stdin; the password is never
written to evidence. Extended-timeout evidence records each process status,
elapsed time, stdout/stderr byte counts, and the original roundtrip result.

Interpretation is intentionally split into:

- `product_regression`: failures in the HWP5 gate itself;
- `fixture_scope`: HWP3/HWPX and password-required work that belongs to a
  different gate or needs explicit fixture credentials;
- `environment`: process timeouts and native installer/GUI evidence.

The final summary keeps `release_pass: false` until the required gates and the
native installer smoke are independently verified. A successful extended run
does not erase the fact that the baseline process exceeded its original
timeout.
