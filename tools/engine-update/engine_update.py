"""Library primitives for controlled RHWP engine updates.

The updater deliberately knows only the engine boundary.  Product code and
project manifests remain outside its write scope.
"""

from __future__ import annotations

import hashlib
import hmac
import ast
import json
import os
import shutil
import subprocess
import tempfile
import urllib.request
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, Iterator, Mapping

if os.name == "nt":
    import msvcrt
else:
    import fcntl


ENGINE_PATHS = ("src", "pkg")
STATE_DIR = "state"
CANDIDATE_DIR = "candidates"
LOCK_FILE = "engine-update.lock"
CURRENT_FILE = "current.json"
METADATA_FILE = "metadata.json"
JOURNAL_FILE = "journal.json"
API_COMPATIBILITY_FILE = "api-compatibility.json"
PRODUCT_VERIFICATION_FILE = "product-verification.json"
VERIFICATION_REPORT_FILE = "verification-report.json"
ATTESTATION_KEY_ENV = "UNI_HWP_EXECUTOR_ATTESTATION_KEY"
RECOVERY_LOG_FILE = "recovery-journal.jsonl"
ABANDONED_LOCKS_FILE = "abandoned-locks.jsonl"
DEFAULT_UPSTREAM_REPOSITORY = "https://github.com/edwardkim/rhwp"


class EngineUpdateError(RuntimeError):
    """Base error for safe update failures."""


class DirtyTreeError(EngineUpdateError):
    """The repository has changes under the managed engine boundary."""


class LockContentionError(EngineUpdateError):
    """Another updater owns the update lock."""


def _canonical_json(value: object) -> bytes:
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n").encode("utf-8")


def executor_attestation(report: Mapping[str, object], key: str | bytes | None = None) -> str:
    """Create the executor MAC over the complete, unsigned report.

    The key is deliberately outside the candidate tree.  A missing key is an
    unusable deployment configuration, never an invitation to fall back to a
    file checksum or a candidate-provided signature.
    """
    secret = key if key is not None else os.environ.get(ATTESTATION_KEY_ENV)
    if isinstance(secret, str):
        secret = secret.encode("utf-8")
    if not isinstance(secret, bytes) or len(secret) < 32:
        raise EngineUpdateError(f"{ATTESTATION_KEY_ENV} is not configured")
    unsigned = dict(report)
    unsigned.pop("attestation", None)
    unsigned.pop("signature", None)
    return hmac.new(secret, _canonical_json(unsigned), hashlib.sha256).hexdigest()


def _validate_execution_identity(evidence: Mapping[str, object], target_hash: str, label: str) -> tuple[str, str]:
    """Require the verifier's per-run identity, not a candidate claim alone.

    The updater cannot make a JSON file cryptographically authentic without a
    product-owned signing key.  It therefore rejects legacy/ambiguous reports
    by default and only accepts a pair of mutually-correlated execution
    receipts.  The remaining spoofing limitation is documented in the README.
    """
    session = evidence.get("execution_session_id")
    nonce = evidence.get("execution_nonce")
    if not isinstance(session, str) or not session.strip():
        raise EngineUpdateError(f"{label} has no trusted execution session")
    if not isinstance(nonce, str) or len(nonce) != 64 or any(c not in "0123456789abcdef" for c in nonce.lower()):
        raise EngineUpdateError(f"{label} has no valid execution nonce")
    if evidence.get("source_sha256") != target_hash or evidence.get("target_sha256") != target_hash:
        raise EngineUpdateError(f"{label} source/target SHA is not this candidate")
    return session, nonce


def _validate_execution_details(evidence: Mapping[str, object], path_hashes: Mapping[str, str], label: str) -> None:
    api = evidence.get("api")
    execution = evidence.get("execution")
    if not isinstance(api, dict) or api.get("compatible") is not True:
        raise EngineUpdateError(f"{label} has no independently confirmed compatible API result")
    required_apis = api.get("required_apis")
    if not isinstance(required_apis, list) or not required_apis or not all(isinstance(item, str) and item for item in required_apis):
        raise EngineUpdateError(f"{label} has incomplete required API details")
    if api.get("missing") not in ([], None):
        raise EngineUpdateError(f"{label} reports missing required APIs")
    if not isinstance(execution, dict) or execution.get("compatible") is not True or execution.get("status") != "PASS":
        raise EngineUpdateError(f"{label} has no independently confirmed execution result")
    if execution.get("exit_code") != 0 or not isinstance(execution.get("invocation_id"), str) or not execution["invocation_id"].strip():
        raise EngineUpdateError(f"{label} has incomplete execution details")
    if execution.get("path_sha256") != dict(path_hashes):
        raise EngineUpdateError(f"{label} execution path hashes mismatch")


def _validate_attested_execution_match(report: Mapping[str, object], product: Mapping[str, object]) -> None:
    """Require the signed product receipt to be the execution being verified.

    The compatibility report is candidate data.  The product executor receipt
    is the trust anchor, so API requirements and invocation identity must agree
    exactly with that receipt rather than merely sharing a session nonce.
    """
    report_api = report.get("api")
    report_execution = report.get("execution")
    product_api = product.get("api")
    product_execution = product.get("execution")
    if not all(isinstance(value, dict) for value in (report_api, report_execution, product_api, product_execution)):
        raise EngineUpdateError("verification evidence has incomplete API or invocation details")
    if report.get("source_sha256") != product.get("source_sha256") or report.get("target_sha256") != product.get("target_sha256"):
        raise EngineUpdateError("verification evidence source SHA mismatch")
    if report_api.get("required_apis") != product_api.get("required_apis"):
        raise EngineUpdateError("verification required API list does not match trusted executor attestation")
    if report_execution.get("invocation_id") != product_execution.get("invocation_id"):
        raise EngineUpdateError("verification invocation does not match trusted executor attestation")


def _validate_compatibility_manifest(root: Path, target_hash: str, path_hashes: Mapping[str, str]) -> dict[str, object]:
    """Validate the compatibility manifest and its executed, hash-bound report."""
    manifest = root / API_COMPATIBILITY_FILE
    if not manifest.is_file():
        raise EngineUpdateError(f"candidate is missing required {API_COMPATIBILITY_FILE}")
    try:
        payload = json.loads(manifest.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        raise EngineUpdateError(f"candidate compatibility manifest is invalid: {exc}") from exc
    if not isinstance(payload, dict) or payload.get("schema_version") != 1:
        raise EngineUpdateError("candidate API compatibility manifest has invalid structure")
    if payload.get("compatible") is not True:
        raise EngineUpdateError("candidate API compatibility manifest is not compatible")
    manifest_hash = payload.get("target_sha256")
    if manifest_hash != target_hash:
        raise EngineUpdateError("candidate API compatibility manifest target hash mismatch")
    declared_paths = payload.get("path_sha256")
    if declared_paths != dict(path_hashes):
        raise EngineUpdateError("candidate API compatibility manifest path hashes mismatch")
    report_name = payload.get("verification_report")
    if not isinstance(report_name, str) or not report_name.strip() or Path(report_name).is_absolute() or ".." in Path(report_name).parts:
        raise EngineUpdateError("candidate API compatibility manifest has no safe verification report")
    report_path = root / report_name
    if not report_path.is_file():
        raise EngineUpdateError("candidate verification report is missing")
    try:
        report = json.loads(report_path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        raise EngineUpdateError(f"candidate verification report is invalid: {exc}") from exc
    if not isinstance(report, dict) or report.get("schema_version") != 1:
        raise EngineUpdateError("candidate verification report has invalid structure")
    if report.get("status") != "PASS" or report.get("executed") is not True or report.get("target_sha256") != target_hash:
        raise EngineUpdateError("candidate verification report was not executed successfully for this target")
    verifier_session, verifier_nonce = _validate_execution_identity(report, target_hash, "candidate verification report")
    _validate_execution_details(report, path_hashes, "candidate verification report")
    _validate_provenance(report, root, target_hash, report_name)
    for key in ("api", "execution"):
        evidence = payload.get(key)
        if not isinstance(evidence, dict) or evidence.get("compatible") is not True or evidence.get("report") != report_name:
            raise EngineUpdateError(f"candidate compatibility manifest has invalid {key} compatibility")
        if evidence.get("target_sha256") != target_hash:
            raise EngineUpdateError(f"candidate compatibility manifest has invalid {key} target hash")
        if evidence.get("source_sha256") != target_hash or evidence.get("execution_session_id") != verifier_session or evidence.get("execution_nonce") != verifier_nonce:
            raise EngineUpdateError(f"candidate compatibility manifest has unbound {key} execution evidence")
        report_evidence = report.get(key)
        if not isinstance(report_evidence, dict) or report_evidence.get("status") != "PASS" or report_evidence.get("compatible") is not True:
            raise EngineUpdateError(f"candidate verification report has no executed {key} result")
        if report_evidence.get("target_sha256") != target_hash:
            raise EngineUpdateError(f"candidate verification report has invalid {key} target hash")
    return payload | {"verification_report": report, "_verifier_identity": (verifier_session, verifier_nonce)}


def _validate_provenance(report: Mapping[str, object], root: Path, target_hash: str, report_name: str) -> None:
    """Bind evidence to the candidate where producers provide provenance."""
    # These fields are deliberately checked when present: old producers may not
    # know the optional provenance vocabulary, but a supplied value must never
    # be allowed to point at a different source or execution.
    source = report.get("source")
    if source is not None and source not in {str(root), root.name, "candidate"}:
        raise EngineUpdateError("candidate verification report source is not this candidate")
    session = report.get("execution_session_id")
    if session is not None and (not isinstance(session, str) or not session.strip()):
        raise EngineUpdateError("candidate verification report has an invalid execution session")
    if report.get("report_name") is not None and report.get("report_name") != report_name:
        raise EngineUpdateError("candidate verification report name mismatch")


def _validate_product_verification(root: Path, target_hash: str, path_hashes: Mapping[str, str]) -> dict[str, object]:
    """Validate the product executor's structured, hash-bound result.

    Candidate metadata and human-readable PASS strings are deliberately not
    evidence.  The executor result must contain every managed path hash and a
    self-checking signature over the structured result.
    """
    path = root / PRODUCT_VERIFICATION_FILE
    if not path.is_file():
        raise EngineUpdateError(f"candidate is missing required {PRODUCT_VERIFICATION_FILE}")
    try:
        report = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        raise EngineUpdateError(f"product verification result is invalid: {exc}") from exc
    if not isinstance(report, dict) or report.get("schema_version") != 1:
        raise EngineUpdateError("product verification result has invalid structure")
    if report.get("producer") != "Uni-HWP product executor" or report.get("executed") is not True:
        raise EngineUpdateError("product verification result was not produced by the product executor")
    if report.get("status") != "PASS" or report.get("target_sha256") != target_hash:
        raise EngineUpdateError("product verification result does not match this candidate")
    if report.get("path_sha256") != dict(path_hashes):
        raise EngineUpdateError("product verification result path hashes mismatch")
    _validate_execution_identity(report, target_hash, "product verification result")
    _validate_execution_details(report, path_hashes, "product verification result")
    _validate_provenance(report, root, target_hash, PRODUCT_VERIFICATION_FILE)
    attestation = report.get("attestation")
    if not isinstance(attestation, dict) or attestation.get("algorithm") != "HMAC-SHA256" or not isinstance(attestation.get("value"), str):
        raise EngineUpdateError("product verification result has no trusted executor attestation")
    try:
        expected = executor_attestation(report)
    except EngineUpdateError as exc:
        raise EngineUpdateError("product verification result cannot be verified: executor key is unavailable") from exc
    if not hmac.compare_digest(expected, attestation["value"]):
        raise EngineUpdateError("product verification result executor attestation mismatch")
    return report


def _decode_git_path(value: bytes) -> str:
    """Decode both -z paths and Git's quoted porcelain paths."""
    text = value.decode("utf-8", errors="surrogateescape")
    if len(text) >= 2 and text[0] == '"' and text[-1] == '"':
        try:
            decoded = ast.literal_eval(text)
            if isinstance(decoded, str):
                try:
                    return decoded.encode("latin-1").decode("utf-8")
                except UnicodeError:
                    return decoded
        except (SyntaxError, ValueError):
            pass
    return text


def _parse_porcelain_z(output: bytes) -> list[str]:
    """Return every path in porcelain v1 -z output, including rename pairs."""
    records = output.split(b"\0")
    paths: list[str] = []
    index = 0
    while index < len(records):
        record = records[index]
        index += 1
        if not record:
            continue
        if len(record) < 4:
            continue
        status = record[:2].decode("ascii", errors="replace")
        paths.append(_decode_git_path(record[3:]))
        if "R" in status or "C" in status:
            if index < len(records) and records[index]:
                paths.append(_decode_git_path(records[index]))
                index += 1
    return paths


def latest_stable_release(repository: str = DEFAULT_UPSTREAM_REPOSITORY) -> dict[str, str]:
    """Resolve the latest non-draft, non-prerelease GitHub release."""
    api_url = repository.rstrip("/")
    if api_url.endswith(".git"):
        api_url = api_url[:-4]
    api_url = api_url.replace("github.com/", "api.github.com/repos/", 1)
    url = f"{api_url}/releases/latest"
    request = urllib.request.Request(url, headers={"Accept": "application/vnd.github+json", "User-Agent": "Uni-HWP-engine-updater"})
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except Exception as exc:
        raise EngineUpdateError(f"unable to resolve latest upstream release: {exc}") from exc
    tag = payload.get("tag_name")
    commit = payload.get("target_commitish")
    if not isinstance(tag, str) or not tag.startswith("v"):
        raise EngineUpdateError("upstream latest release did not provide a version tag")
    if payload.get("draft") or payload.get("prerelease"):
        raise EngineUpdateError("upstream latest release is not stable")
    return {"repository": repository, "tag": tag, "target_commitish": str(commit or "")}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _atomic_write(path: Path, text: str) -> None:
    """Replace a small state file without exposing a partial JSON document."""
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.{uuid.uuid4().hex}.tmp")
    try:
        with temporary.open("w", encoding="utf-8", newline="\n") as stream:
            stream.write(text)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def tree_sha256(root: Path, paths: tuple[str, ...] = ENGINE_PATHS) -> str:
    """Return a deterministic digest of files below the managed paths."""
    digest = hashlib.sha256()
    for base in paths:
        directory = root / base
        if not directory.exists():
            continue
        for file in sorted(p for p in directory.rglob("*") if p.is_file()):
            relative = file.relative_to(root).as_posix().encode()
            digest.update(relative + b"\0" + _sha256(file).encode() + b"\n")
    return digest.hexdigest()


def validate_metadata(metadata: Mapping[str, object]) -> dict[str, object]:
    """Validate and normalize the immutable upstream/product provenance."""
    required = {
        "product_name",
        "source_project",
        "source_repository",
        "source_license",
        "upstream_tag",
        "upstream_commit",
        "source_sha256",
    }
    missing = sorted(required - metadata.keys())
    if missing:
        raise ValueError(f"metadata missing required fields: {', '.join(missing)}")
    if metadata["product_name"] != "Uni-HWP":
        raise ValueError("product_name must remain Uni-HWP")
    if metadata["source_project"] != "RHWP":
        raise ValueError("source_project must remain RHWP")
    if metadata["source_license"] != "MIT":
        raise ValueError("source_license must retain RHWP's MIT license")
    tag = metadata["upstream_tag"]
    commit = metadata["upstream_commit"]
    source_hash = metadata["source_sha256"]
    if not isinstance(tag, str) or not tag.startswith("v"):
        raise ValueError("upstream_tag must be a release tag beginning with v")
    if not isinstance(commit, str) or len(commit) != 40 or any(c not in "0123456789abcdef" for c in commit.lower()):
        raise ValueError("upstream_commit must be a 40-character hexadecimal SHA")
    if not isinstance(source_hash, str) or len(source_hash) != 64 or any(c not in "0123456789abcdef" for c in source_hash.lower()):
        raise ValueError("source_sha256 must be a 64-character hexadecimal digest")
    if not isinstance(metadata["source_repository"], str) or not metadata["source_repository"].startswith("https://"):
        raise ValueError("source_repository must be an HTTPS URL")
    return dict(metadata)


class _UpdateLock:
    _held_paths: set[str] = set()

    def __init__(self, path: Path, abandoned_path: Path | None = None):
        self.path = path
        self.abandoned_path = abandoned_path or path.with_name(ABANDONED_LOCKS_FILE)
        self._stream = None

    def _record_abandoned(self, record: object) -> None:
        self.abandoned_path.parent.mkdir(parents=True, exist_ok=True)
        with self.abandoned_path.open("a", encoding="utf-8") as stream:
            stream.write(json.dumps({"abandoned_at": _now(), "lock": record}, sort_keys=True) + "\n")

    @staticmethod
    def _owner_alive(record: object) -> bool:
        if not isinstance(record, dict) or not isinstance(record.get("pid"), int):
            return False
        if record["pid"] == os.getpid():
            return True
        try:
            os.kill(record["pid"], 0)
        except (OSError, ValueError):
            return False
        return True

    def __enter__(self) -> "_UpdateLock":
        self.path.parent.mkdir(parents=True, exist_ok=True)
        existed = self.path.exists()
        old_record = None
        if existed:
            try:
                old_record = json.loads(self.path.read_text(encoding="utf-8"))
            except (OSError, ValueError):
                pass
        if str(self.path) in self._held_paths:
            raise LockContentionError(f"engine update lock is held: {self.path}")
        try:
            self._stream = self.path.open("a+b")
            self._stream.seek(0)
            if os.name == "nt":
                self._stream.seek(0, 2)
                if self._stream.tell() == 0:
                    self._stream.write(b"\0")
                    self._stream.flush()
                self._stream.seek(0)
                msvcrt.locking(self._stream.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                fcntl.flock(self._stream.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except (OSError, PermissionError) as exc:
            if self._stream:
                self._stream.close()
                self._stream = None
            record = None
            try:
                record = json.loads(self.path.read_text(encoding="utf-8"))
            except (OSError, ValueError):
                pass
            if self._owner_alive(record):
                raise LockContentionError(f"engine update lock is held: {self.path}") from exc
            if record is not None:
                self._record_abandoned(record)
            # Retry once: a dead process releases the OS lock automatically.
            self._stream = self.path.open("a+b")
            try:
                if os.name == "nt":
                    self._stream.seek(0)
                    msvcrt.locking(self._stream.fileno(), msvcrt.LK_NBLCK, 1)
                else:
                    fcntl.flock(self._stream.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
            except OSError as retry_exc:
                self._stream.close()
                self._stream = None
                raise LockContentionError(f"engine update lock is held: {self.path}") from retry_exc
        self._stream.seek(0)
        self._stream.truncate()
        self._stream.write(json.dumps({"pid": os.getpid(), "created_at": _now()}).encode("utf-8"))
        self._stream.flush()
        os.fsync(self._stream.fileno())
        if existed and not self._owner_alive(old_record):
            self._record_abandoned(old_record)
        self._held_paths.add(str(self.path))
        return self

    def __exit__(self, *_: object) -> None:
        try:
            if self._stream:
                if os.name == "nt":
                    self._stream.seek(0)
                    msvcrt.locking(self._stream.fileno(), msvcrt.LK_UNLCK, 1)
                else:
                    fcntl.flock(self._stream.fileno(), fcntl.LOCK_UN)
                self._stream.close()
                self._stream = None
            self._held_paths.discard(str(self.path))
            self.path.unlink(missing_ok=True)
        except FileNotFoundError:
            pass


class UpdateManager:
    """Manage candidates and installed engine state for one repository."""

    def __init__(self, repo_root: str | Path, state_root: str | Path | None = None, managed_paths: tuple[str, ...] = ENGINE_PATHS):
        self.repo_root = Path(repo_root).resolve()
        self.state_root = Path(state_root).resolve() if state_root else self.repo_root / "tools" / "engine-update" / STATE_DIR
        self.managed_paths = managed_paths
        self.candidates_root = self.state_root / CANDIDATE_DIR
        self.lock_path = self.state_root / LOCK_FILE
        self.current_path = self.state_root / CURRENT_FILE

    def _git_dirty_paths(self) -> list[str]:
        result = subprocess.run(["git", "-C", str(self.repo_root), "status", "--porcelain=v1", "-z", "--untracked-files=all"], check=True, capture_output=True)
        paths = [path.replace("\\", "/") for path in _parse_porcelain_z(result.stdout)]
        return [path for path in paths if any(path == managed or path.startswith(managed + "/") for managed in self.managed_paths)]

    def _require_managed_paths(self, root: Path, label: str) -> None:
        missing = [relative for relative in self.managed_paths if not (root / relative).is_dir()]
        if missing:
            raise EngineUpdateError(f"{label} is missing managed paths: {', '.join(missing)}")

    def _require_non_empty_managed_paths(self, root: Path, label: str) -> None:
        self._require_managed_paths(root, label)
        empty = [relative for relative in self.managed_paths if not any(
            file.is_file() and file.stat().st_size > 0 for file in (root / relative).rglob("*")
        )]
        if empty:
            raise EngineUpdateError(f"{label} has empty managed paths: {', '.join(empty)}")

    def verify_candidate(self, candidate: str | Path, metadata: Mapping[str, object] | None = None) -> dict[str, object]:
        """Run the non-mutating candidate gates required before installation.

        The updater owns only the engine tree.  A producer may add an
        ``api-compatibility.json`` is a required, preserved candidate artifact.
        Its API and execution evidence must be explicit; metadata defaults never
        manufacture a verification result. No product files are changed here.
        """
        root = Path(candidate).resolve()
        normalized = validate_metadata(metadata or json.loads((root / METADATA_FILE).read_text(encoding="utf-8")))
        self._require_non_empty_managed_paths(root, "candidate")
        required = normalized.get("required_artifacts", list(self.managed_paths))
        if not isinstance(required, list) or not all(isinstance(item, str) for item in required):
            raise EngineUpdateError("candidate required_artifacts must be a list of paths")
        required = sorted(set(required) | set(self.managed_paths) | {
            API_COMPATIBILITY_FILE, PRODUCT_VERIFICATION_FILE, VERIFICATION_REPORT_FILE,
        })
        missing = [item for item in required if not (root / item).exists()]
        if missing:
            raise EngineUpdateError("candidate is missing required artifacts: " + ", ".join(missing))
        actual_hashes = self._path_hashes(root)
        actual_tree_hash = tree_sha256(root, self.managed_paths)
        if actual_tree_hash != normalized["source_sha256"]:
            raise EngineUpdateError("candidate contents do not match independently calculated source_sha256")
        manifest = _validate_compatibility_manifest(root, actual_tree_hash, actual_hashes)
        product_result = _validate_product_verification(root, actual_tree_hash, actual_hashes)
        compatibility_report = manifest["verification_report"]
        report_session = compatibility_report.get("execution_session_id") if isinstance(compatibility_report, dict) else None
        product_session = product_result.get("execution_session_id")
        report_nonce = compatibility_report.get("execution_nonce") if isinstance(compatibility_report, dict) else None
        product_nonce = product_result.get("execution_nonce")
        if report_session != product_session or report_nonce != product_nonce:
            raise EngineUpdateError("API and product verification execution session/nonce do not match")
        report_source = compatibility_report.get("source") if isinstance(compatibility_report, dict) else None
        product_source = product_result.get("source")
        if report_source is not None and product_source is not None and report_source != product_source:
            raise EngineUpdateError("API and product verification sources do not match")
        _validate_attested_execution_match(compatibility_report, product_result)
        return {
            "required_artifacts": required,
            "api_compatibility": "passed",
            "execution_verification": "passed",
            "path_sha256": actual_hashes,
            "compatibility_manifest": manifest,
            "product_verification": product_result,
        }

    def _path_hashes(self, root: Path) -> dict[str, str]:
        self._require_managed_paths(root, "engine tree")
        return {relative: tree_sha256(root, (relative,)) for relative in self.managed_paths}

    def _append_recovery_event(self, journal_path: Path, state: str, error: str | None = None) -> None:
        """Persist retry intent before/after recovery; records are append-only."""
        recovery_path = journal_path.with_name(RECOVERY_LOG_FILE)
        event: dict[str, object] = {"at": _now(), "state": state, "journal": str(journal_path)}
        if error:
            event["error"] = error
        recovery_path.parent.mkdir(parents=True, exist_ok=True)
        with recovery_path.open("a", encoding="utf-8", newline="\n") as stream:
            stream.write(json.dumps(event, ensure_ascii=False, sort_keys=True) + "\n")
            stream.flush()
            os.fsync(stream.fileno())

    def _repository_identity(self) -> dict[str, str]:
        top = subprocess.run(["git", "-C", str(self.repo_root), "rev-parse", "--show-toplevel"], check=True, capture_output=True, text=True).stdout.strip()
        head = subprocess.run(["git", "-C", str(self.repo_root), "rev-parse", "HEAD"], check=True, capture_output=True, text=True).stdout.strip()
        return {"repo_root": str(self.repo_root), "git_root": str(Path(top).resolve()), "head": head}

    def assert_clean_engine_tree(self) -> None:
        dirty = self._git_dirty_paths()
        if dirty:
            raise DirtyTreeError("managed engine paths have uncommitted changes: " + ", ".join(dirty))

    def status(self) -> dict[str, object]:
        current = json.loads(self.current_path.read_text(encoding="utf-8")) if self.current_path.exists() else None
        candidates = []
        if self.candidates_root.exists():
            for directory in sorted(p for p in self.candidates_root.iterdir() if p.is_dir()):
                metadata = directory / METADATA_FILE
                if metadata.exists():
                    candidates.append(json.loads(metadata.read_text(encoding="utf-8")))
        return {"product_name": "Uni-HWP", "managed_paths": list(self.managed_paths), "dirty_engine_paths": self._git_dirty_paths(), "current": current, "candidates": candidates, "lock_held": self.lock_path.exists()}

    def check(self, metadata: Mapping[str, object] | None = None) -> dict[str, object]:
        if metadata is not None:
            validate_metadata(metadata)
        result = self.status()
        result["metadata_valid"] = metadata is None or True
        result["ready"] = not result["dirty_engine_paths"] and not result["lock_held"]
        return result

    def prepare(self, source_root: str | Path, metadata: Mapping[str, object]) -> Path:
        normalized = validate_metadata(metadata)
        source = Path(source_root).resolve()
        if not source.is_dir():
            raise EngineUpdateError(f"candidate source directory does not exist: {source}")
        self._require_non_empty_managed_paths(source, "candidate source")
        expected = normalized["source_sha256"]
        actual = tree_sha256(source, self.managed_paths)
        if expected != actual:
            raise EngineUpdateError(f"candidate source hash mismatch: expected {expected}, got {actual}")
        candidate_id = f"{normalized['upstream_tag']}-{uuid.uuid4().hex[:12]}"
        destination = self.candidates_root / candidate_id
        self.candidates_root.mkdir(parents=True, exist_ok=True)
        temporary = Path(tempfile.mkdtemp(prefix=".prepare-", dir=self.candidates_root))
        try:
            for relative in self.managed_paths:
                origin = source / relative
                if origin.exists():
                    shutil.copytree(origin, temporary / relative)
            compatibility_manifest = source / API_COMPATIBILITY_FILE
            if compatibility_manifest.is_file():
                shutil.copy2(compatibility_manifest, temporary / API_COMPATIBILITY_FILE)
                manifest = json.loads(compatibility_manifest.read_text(encoding="utf-8"))
                report_name = manifest.get("verification_report") if isinstance(manifest, dict) else None
                if isinstance(report_name, str):
                    report = source / report_name
                    if report.is_file():
                        report_target = temporary / report_name
                        report_target.parent.mkdir(parents=True, exist_ok=True)
                        shutil.copy2(report, report_target)
            product_result = source / PRODUCT_VERIFICATION_FILE
            if product_result.is_file():
                shutil.copy2(product_result, temporary / PRODUCT_VERIFICATION_FILE)
            _atomic_write(temporary / METADATA_FILE, json.dumps(normalized | {"prepared_at": _now(), "candidate_id": candidate_id}, indent=2, sort_keys=True) + "\n")
            temporary.rename(destination)
        except Exception:
            shutil.rmtree(temporary, ignore_errors=True)
            raise
        return destination

    def prepare_latest(self, repository: str = DEFAULT_UPSTREAM_REPOSITORY) -> Path:
        """Fetch and stage the latest stable upstream release."""
        release = latest_stable_release(repository)
        self.state_root.mkdir(parents=True, exist_ok=True)
        source_stage = Path(tempfile.mkdtemp(prefix=".upstream-", dir=self.state_root))
        try:
            clone_url = repository if repository.endswith(".git") else f"{repository}.git"
            subprocess.run(["git", "clone", "--quiet", "--depth", "1", "--branch", release["tag"], clone_url, str(source_stage)], check=True, capture_output=True, text=True)
            commit = subprocess.run(["git", "-C", str(source_stage), "rev-parse", "HEAD"], check=True, capture_output=True, text=True).stdout.strip()
            metadata = {
                "product_name": "Uni-HWP",
                "source_project": "RHWP",
                "source_repository": repository,
                "source_license": "MIT",
                "upstream_tag": release["tag"],
                "upstream_commit": commit,
                "source_sha256": tree_sha256(source_stage, self.managed_paths),
            }
            return self.prepare(source_stage, metadata)
        except subprocess.CalledProcessError as exc:
            detail = (exc.stderr or exc.stdout or str(exc)).strip()
            raise EngineUpdateError(f"unable to fetch upstream release: {detail}") from exc
        finally:
            shutil.rmtree(source_stage, ignore_errors=True)

    def apply(self, candidate: str | Path, fail_after: int | None = None, replace: Callable[[Path, Path], None] | None = None) -> dict[str, object]:
        candidate_path = Path(candidate).resolve()
        metadata_path = candidate_path / METADATA_FILE
        if not metadata_path.exists():
            raise EngineUpdateError("candidate has no metadata.json")
        metadata = validate_metadata(json.loads(metadata_path.read_text(encoding="utf-8")))
        verification = self.verify_candidate(candidate_path, metadata)
        if tree_sha256(candidate_path, self.managed_paths) != metadata["source_sha256"]:
            raise EngineUpdateError("candidate contents no longer match pinned source_sha256")
        replace = replace or self._replace_path
        with _UpdateLock(self.lock_path):
            self.state_root.mkdir(parents=True, exist_ok=True)
            self.assert_clean_engine_tree()
            backup = Path(tempfile.mkdtemp(prefix=".rollback-", dir=self.state_root))
            before_hashes = self._path_hashes(self.repo_root)
            candidate_hashes = self._path_hashes(candidate_path)
            journal = {
                "state": "prepared",
                "created_at": _now(),
                "candidate": str(candidate_path),
                "metadata": metadata,
                "backup": str(backup),
                "paths": list(self.managed_paths),
                "previous_current": self.current_path.read_text(encoding="utf-8") if self.current_path.exists() else None,
                "repository": self._repository_identity(),
                "before_hashes": before_hashes,
                "after_hashes": candidate_hashes,
                "processed_paths": [],
                "verification": verification,
            }
            journal_path = backup / JOURNAL_FILE
            backup_complete = False
            try:
                # Complete the backup before making the journal recoverable.
                # If backup creation fails, the live engine must remain untouched.
                for relative in self.managed_paths:
                    target = self.repo_root / relative
                    saved = backup / relative
                    shutil.copytree(target, saved)
                # Keep a second complete snapshot.  The primary backup is
                # immutable and must survive every recovery attempt; this
                # copy is allowed to be consumed by a last-resort direct
                # rename when staging itself is failing.
                immutable_snapshot = backup / ".immutable-snapshot"
                for relative in self.managed_paths:
                    shutil.copytree(backup / relative, immutable_snapshot / relative)
                backup_complete = True
                _atomic_write(journal_path, json.dumps(journal, indent=2, sort_keys=True) + "\n")
                for index, relative in enumerate(self.managed_paths):
                    journal["processed_paths"].append(relative)
                    _atomic_write(journal_path, json.dumps(journal, indent=2, sort_keys=True) + "\n")
                    source = candidate_path / relative
                    target = self.repo_root / relative
                    if source.exists():
                        replace(source, target)
                    elif target.exists():
                        shutil.rmtree(target)
                    if fail_after is not None and index + 1 >= fail_after:
                        raise EngineUpdateError("injected apply failure")
                # The installed tree is not committed until the current
                # pointer is durable.  A pointer-write failure must therefore
                # leave a prepared journal for automatic recovery.
                journal["commit_pending"] = True
                _atomic_write(journal_path, json.dumps(journal, indent=2, sort_keys=True) + "\n")
                self.current_path.parent.mkdir(parents=True, exist_ok=True)
                _atomic_write(self.current_path, json.dumps(metadata, indent=2, sort_keys=True) + "\n")
                journal["state"] = "applied"
                journal.pop("commit_pending", None)
                _atomic_write(journal_path, json.dumps(journal, indent=2, sort_keys=True) + "\n")
                return metadata
            except Exception:
                if not backup_complete:
                    # No live path was touched; discard the incomplete backup
                    # so it cannot later be mistaken for a recovery point.
                    shutil.rmtree(backup, ignore_errors=True)
                    raise
                # Keep the complete restore point and its journal if either
                # the switch or journal persistence fails.  A failed cleanup
                # must never turn a recoverable transaction into data loss.
                try:
                    self._restore(journal)
                    self._restore_current(journal)
                    journal["state"] = "rolled_back"
                    _atomic_write(journal_path, json.dumps(journal, indent=2, sort_keys=True) + "\n")
                except Exception as recovery_error:
                    journal["state"] = "rollback_pending"
                    try:
                        _atomic_write(journal_path, json.dumps(journal, indent=2, sort_keys=True) + "\n")
                    except Exception:
                        pass
                    raise recovery_error
                raise

    def update(self, candidate: str | Path | None = None, repository: str = DEFAULT_UPSTREAM_REPOSITORY) -> dict[str, object]:
        """Prepare and apply an engine candidate, or report a stable no-op.

        Candidate preparation is isolated from installation.  A candidate that
        has the same immutable upstream identity as the installed engine is
        never copied over the live tree.
        """
        candidate_path = Path(candidate).resolve() if candidate else self.prepare_latest(repository)
        metadata_path = candidate_path / METADATA_FILE
        if not metadata_path.exists():
            raise EngineUpdateError("candidate has no metadata.json")
        metadata = validate_metadata(json.loads(metadata_path.read_text(encoding="utf-8")))
        current = json.loads(self.current_path.read_text(encoding="utf-8")) if self.current_path.exists() else None
        if isinstance(current, dict) and all(current.get(key) == metadata.get(key) for key in ("upstream_tag", "upstream_commit", "source_sha256")):
            return {"changed": False, "reason": "same-engine", "metadata": metadata}
        applied = self.apply(candidate_path)
        return {"changed": True, "metadata": applied}

    def rollback(self, journal: str | Path | None = None) -> None:
        journal_path = Path(journal).resolve() if journal else self._latest_journal()
        if not journal_path or not journal_path.exists():
            raise EngineUpdateError("no rollback journal found")
        record = json.loads(journal_path.read_text(encoding="utf-8"))
        with _UpdateLock(self.lock_path):
            self._validate_rollback(record)
            # Make retry intent durable before touching the live tree.  A
            # failed recovery must remain explicitly pending, never appear as
            # applied and never lose the complete restore point.
            self._append_recovery_event(journal_path, "rollback_started")
            try:
                self._restore(record)
                self._restore_current(record)
            except Exception as exc:
                record = dict(record)
                record["state"] = "rollback_pending"
                record["last_error"] = str(exc)
                self._append_recovery_event(journal_path, "rollback_pending", str(exc))
                _atomic_write(journal_path, json.dumps(record, indent=2, sort_keys=True) + "\n")
                raise
            record = dict(record)
            record["state"] = "rolled_back"
            self._append_recovery_event(journal_path, "rolled_back")
            _atomic_write(journal_path, json.dumps(record, indent=2, sort_keys=True) + "\n")

    def _latest_journal(self) -> Path | None:
        journals = list(self.state_root.glob(".rollback-*/journal.json"))
        return max(journals, key=lambda path: path.stat().st_mtime) if journals else None

    def _restore(self, journal: Mapping[str, object]) -> None:
        backup = Path(str(journal["backup"]))
        paths = [str(relative) for relative in journal.get("paths", self.managed_paths)]
        # Build a complete restore tree first. No live path is removed or
        # replaced until every managed path has been copied successfully.
        staged = Path(tempfile.mkdtemp(prefix=".rollback-stage-", dir=self.state_root))
        # This directory is intentionally persistent while a transaction is
        # incomplete.  It is the second copy of the live tree if switching or
        # restoring one of the managed roots fails.
        quarantine = backup / ".live-quarantine"
        snapshot = backup / ".live-snapshot"
        quarantine.mkdir(parents=True, exist_ok=True)
        cleanup_quarantine = False
        try:
            for relative in paths:
                saved = backup / relative
                if not saved.is_dir():
                    raise EngineUpdateError(f"rollback backup is missing: {relative}")
                shutil.copytree(saved, staged / relative)
            moved: list[str] = []
            try:
                for relative in paths:
                    target = self.repo_root / relative
                    if target.exists():
                        saved_live = quarantine / relative
                        saved_live.parent.mkdir(parents=True, exist_ok=True)
                        if saved_live.exists():
                            shutil.rmtree(saved_live)
                        target.rename(saved_live)
                    moved.append(relative)
                # Keep an untouched complete copy.  The quarantine may be
                # consumed by a fallback restore, so it cannot be the only
                # recovery source when rebuilding the backup also fails.
                if not all((snapshot / relative).is_dir() for relative in paths):
                    shutil.rmtree(snapshot, ignore_errors=True)
                    shutil.copytree(quarantine, snapshot)
                for relative in paths:
                    self._replace_path(staged / relative, self.repo_root / relative)
            except Exception:
                # A failed per-path switch must never be compensated by a
                # per-path backup restore: that can leave src/pkg mixed. The
                # quarantine is the one complete live tree, so restore it as
                # one transaction using raw renames (independent of the
                # injectable/product switch hook). This is retry-safe even
                # when the failing switch is the second managed path.
                # The quarantine is a complete snapshot of the live tree and
                # is available even when copying either the rollback package
                # or the optional second snapshot fails.  Restore it as one
                # complete set; never restore src/pkg independently.
                fallback = quarantine if all((quarantine / relative).is_dir() for relative in paths) else backup / ".immutable-snapshot"
                self._restore_complete_backup(backup, paths, fallback_root=fallback)
                raise
            cleanup_quarantine = True
        finally:
            shutil.rmtree(staged, ignore_errors=True)
            if cleanup_quarantine:
                shutil.rmtree(quarantine, ignore_errors=True)
                shutil.rmtree(snapshot, ignore_errors=True)

    def _restore_complete_quarantine(self, quarantine: Path, paths: list[str]) -> None:
        """Restore a complete tree without invoking path switches.

        Kept as a small compatibility wrapper for callers/tests that inspect
        the old helper name; quarantine is never a desired restore source.
        """
        self._restore_complete_tree(quarantine, paths)

    def _restore_complete_backup(self, backup: Path, paths: list[str], fallback_root: Path | None = None) -> None:
        """Restore the immutable pre-update tree after a partial switch."""
        staged = Path(tempfile.mkdtemp(prefix=".rollback-recovery-", dir=self.state_root))
        try:
            try:
                for relative in paths:
                    saved = backup / relative
                    if not saved.is_dir():
                        raise EngineUpdateError(f"rollback backup is incomplete: {relative}")
                    shutil.copytree(saved, staged / relative)
            except Exception:
                # The complete quarantine was captured before the live switch.
                # If rebuilding a second copy from the rollback package fails,
                # consume that snapshot instead of leaving a missing package.
                if fallback_root is None or not all((fallback_root / relative).is_dir() for relative in paths):
                    raise
                self._restore_complete_tree(fallback_root, paths)
                raise
            self._restore_complete_tree(staged, paths, fallback_root=fallback_root)
        finally:
            shutil.rmtree(staged, ignore_errors=True)

    def _restore_complete_tree(self, source_root: Path, paths: list[str], fallback_root: Path | None = None) -> None:
        """Install an already-complete tree using only direct renames."""
        if any(not (source_root / relative).is_dir() for relative in paths):
            raise EngineUpdateError("complete restore tree is incomplete")
        try:
            for relative in paths:
                target = self.repo_root / relative
                if target.exists():
                    shutil.rmtree(target)
            for relative in paths:
                os.replace(source_root / relative, self.repo_root / relative)
        except Exception:
            # A failure after the first rename must not leave a missing or
            # mixed live tree.  The caller's quarantine is a complete,
            # internally consistent tree; use it as a one-shot fallback.
            if fallback_root is not None and all((fallback_root / relative).is_dir() for relative in paths):
                for relative in paths:
                    target = self.repo_root / relative
                    if target.exists():
                        shutil.rmtree(target)
                for relative in paths:
                    os.replace(fallback_root / relative, self.repo_root / relative)
            raise

    def _validate_rollback(self, journal: Mapping[str, object]) -> None:
        if journal.get("state") not in {"prepared", "applied", "rollback_pending", "unknown"}:
            raise EngineUpdateError("rollback journal is not recoverable")
        if journal.get("repository") != self._repository_identity():
            raise EngineUpdateError("rollback journal belongs to a different repository")
        backup = Path(str(journal.get("backup", ""))).resolve()
        if not backup.is_dir() or backup.parent != self.state_root:
            raise EngineUpdateError("rollback backup is outside the updater state root")
        paths = journal.get("paths")
        before = journal.get("before_hashes")
        after = journal.get("after_hashes")
        if not isinstance(paths, list) or paths != list(self.managed_paths):
            raise EngineUpdateError("rollback journal has incomplete managed paths")
        if not isinstance(before, dict) or not isinstance(after, dict):
            raise EngineUpdateError("rollback journal has no installed-state hashes")
        processed = journal.get("processed_paths", [])
        if not isinstance(processed, list) or not set(processed).issubset(self.managed_paths):
            raise EngineUpdateError("rollback journal has invalid processed paths")
        for relative in self.managed_paths:
            saved = backup / relative
            if not saved.is_dir() or tree_sha256(backup, (relative,)) != before.get(relative):
                raise EngineUpdateError(f"rollback backup integrity check failed: {relative}")
            target = self.repo_root / relative
            current_hash = tree_sha256(self.repo_root, (relative,)) if target.is_dir() else None
            # A process may have been interrupted between the two atomic
            # directory renames.  A missing name is recoverable only for a
            # prepared journal that recorded that path as in-flight.
            # A directory name can be absent after either half of an atomic
            # rename.  It is a recoverable transaction state, not evidence
            # of a newer edit: the verified immutable backup is authoritative.
            missing_is_recoverable = journal.get("state") in {"prepared", "applied", "rollback_pending", "unknown"}
            if current_hash not in {before.get(relative), after.get(relative)} and not (current_hash is None and missing_is_recoverable):
                raise EngineUpdateError(f"refusing rollback over newer edits: {relative}")

    def recover_interrupted(self) -> list[str]:
        """Recover journals whose durable commit cannot be established."""
        recovered: list[str] = []
        journal_paths = sorted(self.state_root.glob(".rollback-*/journal.json"))
        for journal_path in journal_paths:
            try:
                record = json.loads(journal_path.read_text(encoding="utf-8"))
            except (OSError, ValueError):
                # Atomic journal replacement should normally make this
                # impossible.  Leave an unreadable record for the next
                # attempt rather than touching a tree without a restore map.
                continue
            state = record.get("state")
            if state == "applied" and self._applied_is_durable(record):
                continue
            if state not in {"prepared", "applied", "rollback_pending", "unknown"}:
                continue
            with _UpdateLock(self.lock_path):
                self._validate_rollback(record)
                # A journal write may have failed after the installed tree and
                # current pointer were already durable.  Complete that commit
                # instead of rolling a valid installation back.
                if state == "prepared" and record.get("commit_pending") is True and self._applied_is_durable(record):
                    committed = dict(record)
                    committed["state"] = "applied"
                    _atomic_write(journal_path, json.dumps(committed, indent=2, sort_keys=True) + "\n")
                    recovered.append(str(journal_path))
                    continue
                try:
                    self._restore(record)
                    self._restore_current(record)
                    record = dict(record)
                    record["state"] = "rolled_back"
                    _atomic_write(journal_path, json.dumps(record, indent=2, sort_keys=True) + "\n")
                    recovered.append(str(journal_path))
                except Exception as exc:
                    # Recovery is retryable and must be visible as pending.
                    # Do not claim rolled_back when the live tree is unknown.
                    pending = dict(record)
                    pending["state"] = "rollback_pending"
                    pending["last_error"] = str(exc)
                    try:
                        _atomic_write(journal_path, json.dumps(pending, indent=2, sort_keys=True) + "\n")
                    except Exception:
                        pass
                    raise
        return recovered

    def _applied_is_durable(self, journal: Mapping[str, object]) -> bool:
        """Return true only when both installed paths and current agree."""
        after = journal.get("after_hashes")
        metadata = journal.get("metadata")
        if not isinstance(after, dict) or not isinstance(metadata, dict):
            return False
        if any(tree_sha256(self.repo_root, (relative,)) != after.get(relative) for relative in self.managed_paths):
            return False
        if not self.current_path.is_file():
            return False
        try:
            current = json.loads(self.current_path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return False
        return isinstance(current, dict) and current.get("source_sha256") == metadata.get("source_sha256")

    def _restore_current(self, journal: Mapping[str, object]) -> None:
        previous = journal.get("previous_current")
        if previous is None:
            try:
                self.current_path.unlink()
            except FileNotFoundError:
                pass
        else:
            self.current_path.parent.mkdir(parents=True, exist_ok=True)
            _atomic_write(self.current_path, str(previous))

    @staticmethod
    def _replace_path(source: Path, target: Path) -> None:
        """Stage a complete tree, then switch the directory name atomically."""
        target.parent.mkdir(parents=True, exist_ok=True)
        staged = Path(tempfile.mkdtemp(prefix=f".{target.name}-stage-", dir=target.parent))
        old = target.parent / f".{target.name}-old-{uuid.uuid4().hex}"
        switched = False
        try:
            staged.rmdir()
            shutil.copytree(source, staged)
            if target.exists():
                os.replace(target, old)
            os.replace(staged, target)
            switched = True
            # Cleanup is deliberately best-effort: the live name has already
            # been atomically installed, and a retry can remove the old tree.
            if old.exists():
                try:
                    shutil.rmtree(old)
                except OSError:
                    pass
        except Exception:
            if staged.exists():
                shutil.rmtree(staged, ignore_errors=True)
            if not switched and not target.exists() and old.exists():
                os.replace(old, target)
            raise
