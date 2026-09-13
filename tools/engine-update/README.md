# Uni-HWP engine update foundation

This directory contains the reusable, library/CLI-oriented foundation for
updating the embedded RHWP engine while keeping Uni-HWP product code outside
the update boundary. The managed paths are `src/` and `pkg/`; project
manifests and app code are intentionally not touched. For the current
WASM/Tauri runtime, an upstream release is installed with `install_paths:
["pkg"]`: the generated runtime is replaced atomically while the Uni-HWP
Rust source tree remains on its product-controlled revision. `pkg/` is
generated output: `prepare-latest` creates it with `wasm-pack` inside the
isolated candidate after cloning the tagged upstream source.

Each candidate requires immutable provenance metadata:

- `product_name`: `Uni-HWP`
- `source_project`: `RHWP`
- `source_repository`: HTTPS RHWP repository URL
- `source_license`: `MIT`
- `upstream_tag`: release tag such as `v0.8.5`
- `upstream_commit`: full 40-character commit SHA
- `source_sha256`: deterministic SHA-256 of managed candidate contents

Example commands:

```powershell
python tools/engine-update/cli.py status
python tools/engine-update/cli.py latest
python tools/engine-update/cli.py check --metadata metadata.json
python tools/engine-update/cli.py prepare --source C:\path\to\rhwp --metadata metadata.json
python tools/engine-update/cli.py prepare-latest
python tools/engine-update/cli.py update
python tools/engine-update/cli.py update --candidate tools\engine-update\state\candidates\v0.8.5-...
python tools/engine-update/cli.py apply --candidate tools\engine-update\state\candidates\v0.8.5-...
python tools/engine-update/cli.py rollback
```

`latest` resolves the latest stable release from the official RHWP upstream.
`prepare-latest` clones that tagged release into an isolated staging area,
pins its commit and managed-tree hash, and creates an immutable candidate.
The candidate also records `engine_version` and the policy-derived
`product_version` (`RHWP v0.8.6` -> `Uni-HWP 8.6.0`). The About dialog reads
the installed pointer after restart, so the displayed product and engine
versions move together automatically.
`update` applies a candidate (or prepares the latest stable release first) and
returns a no-op when its pinned tag, commit, and managed-tree hash already
match the installed engine.
`apply` takes an exclusive lock, refuses dirty paths selected by the candidate,
records a rollback journal, and restores the previous engine if any
installation step fails. Before installation it also checks required artifacts, an optional API
compatibility manifest, and the managed-tree execution smoke gate. Candidate
and journal state remains under this directory; unrelated user changes remain
outside the managed `src/` and `pkg/` boundary.

Verification receipts are fail-closed. The API verifier and product executor
must report the same `source_sha256`, `execution_session_id`, 64-hex
`execution_nonce`, required API list, and successful execution details; a
missing result, rewritten `executed`/`PASS`, empty `pkg`, or mismatched receipt
is rejected. `product-verification.json` must additionally contain an
`attestation` with algorithm `HMAC-SHA256`. Its value is generated over the
unsigned report by the product executor and verified with the
`UNI_HWP_EXECUTOR_ATTESTATION_KEY` secret, which must be at least 32 bytes and
must not be stored in the candidate. A plain JSON receipt, a local checksum,
or a missing key is never accepted as executor authenticity.

Apply and rollback persist a complete pre-update snapshot and journal before
switching managed paths. A failed switch is restored from that complete
snapshot, and `prepared`/`rollback_pending` journals are retryable through
`rollback` or `recover_interrupted`; no per-path backup is accepted as a
release state. Recovery intent and outcome are also appended to
`recovery-journal.jsonl`; a recovery exception records `rollback_pending`
before it is returned, so a failed combination cannot be recorded as
`applied` or silently lose `pkg`.
