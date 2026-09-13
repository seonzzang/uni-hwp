from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parent))
import engine_update as updater_module  # noqa: E402
from engine_update import (  # noqa: E402
    DirtyTreeError,
    LockContentionError,
    UpdateManager,
    _UpdateLock,
    tree_sha256,
    validate_metadata,
    _parse_porcelain_z,
    executor_attestation,
    product_version_for_engine_tag,
)

os.environ.setdefault("UNI_HWP_EXECUTOR_ATTESTATION_KEY", "test-only-key-which-is-at-least-32-bytes-long")


def git(cwd: Path, *args: str) -> None:
    subprocess.run(["git", "-C", str(cwd), *args], check=True, capture_output=True, text=True)


def repo(tmp_path: Path) -> tuple[Path, Path]:
    root = tmp_path / "repo"
    source = tmp_path / "source"
    root.mkdir()
    source.mkdir()
    for base, text in ((root, "old"), (source, "new")):
        (base / "src").mkdir()
        (base / "pkg").mkdir()
        (base / "src" / "engine.rs").write_text(text, encoding="utf-8")
        (base / "pkg" / "rhwp.js").write_text(text, encoding="utf-8")
    target_hash = tree_sha256(source)
    path_hashes = {name: tree_sha256(source, (name,)) for name in ("src", "pkg")}
    (source / "verification-report.json").write_text(json.dumps({
        "schema_version": 1, "status": "PASS", "executed": True,
        "source_sha256": target_hash, "target_sha256": target_hash,
        "execution_session_id": "test-session-1", "execution_nonce": "a" * 64,
        "api": {"status": "PASS", "compatible": True, "required_apis": ["HwpDocument"], "missing": [], "source_sha256": target_hash, "target_sha256": target_hash, "execution_session_id": "test-session-1", "execution_nonce": "a" * 64},
        "execution": {"status": "PASS", "compatible": True, "invocation_id": "exec-1", "exit_code": 0, "path_sha256": path_hashes, "source_sha256": target_hash, "target_sha256": target_hash, "execution_session_id": "test-session-1", "execution_nonce": "a" * 64},
    }), encoding="utf-8")
    (source / "api-compatibility.json").write_text(json.dumps({
        "schema_version": 1, "compatible": True, "target_sha256": target_hash,
        "source_sha256": target_hash, "execution_session_id": "test-session-1", "execution_nonce": "a" * 64,
        "path_sha256": path_hashes,
        "verification_report": "verification-report.json",
         "api": {"compatible": True, "report": "verification-report.json", "source_sha256": target_hash, "target_sha256": target_hash, "execution_session_id": "test-session-1", "execution_nonce": "a" * 64},
         "execution": {"compatible": True, "report": "verification-report.json", "source_sha256": target_hash, "target_sha256": target_hash, "execution_session_id": "test-session-1", "execution_nonce": "a" * 64},
    }), encoding="utf-8")
    product = {
        "schema_version": 1, "producer": "Uni-HWP product executor", "executed": True,
        "status": "PASS", "target_sha256": target_hash, "path_sha256": path_hashes,
         "source_sha256": target_hash, "execution_session_id": "test-session-1", "execution_nonce": "a" * 64,
         "api": {"compatible": True, "required_apis": ["HwpDocument"], "missing": []},
         "execution": {"compatible": True, "status": "PASS", "invocation_id": "exec-1", "exit_code": 0, "path_sha256": path_hashes},
    }
    product["attestation"] = {
        "algorithm": "HMAC-SHA256",
        "value": executor_attestation(product),
    }
    (source / "product-verification.json").write_text(json.dumps(product), encoding="utf-8")
    git(root, "init", "-q")
    git(root, "config", "user.email", "test@example.invalid")
    git(root, "config", "user.name", "Test")
    git(root, "add", "src", "pkg")
    git(root, "commit", "-qm", "baseline")
    return root, source


def metadata(source: Path) -> dict[str, object]:
    return {
        "product_name": "Uni-HWP",
        "source_project": "RHWP",
        "source_repository": "https://github.com/edwardkim/rhwp",
        "source_license": "MIT",
        "attribution": "RHWP contributors",
        "upstream_tag": "v0.8.5",
        "upstream_commit": "a" * 40,
        "source_sha256": tree_sha256(source),
        "api_compatibility": True,
        "execution_verification": True,
    }


class EngineUpdateTests(unittest.TestCase):
    def test_product_version_follows_rhwp_release_tag(self) -> None:
        self.assertEqual(product_version_for_engine_tag("v0.8.6"), "8.6.0")

        with self.assertRaises(updater_module.EngineUpdateError):
            product_version_for_engine_tag("main")

    def test_prepare_preserves_compatibility_manifest_and_requires_evidence(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root, source = repo(Path(directory))
            manager = UpdateManager(root, Path(directory) / "state")
            candidate = manager.prepare(source, metadata(source))
            self.assertTrue((candidate / "api-compatibility.json").is_file())
            self.assertEqual(manager.verify_candidate(candidate, metadata(source))["api_compatibility"], "passed")
            (candidate / "api-compatibility.json").write_text(json.dumps({"compatible": True}), encoding="utf-8")
            with self.assertRaisesRegex(Exception, "invalid structure"):
                manager.verify_candidate(candidate, metadata(source))

    def test_candidate_rejects_never_executed_or_wrong_target_report(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root, source = repo(Path(directory))
            manager = UpdateManager(root, Path(directory) / "state")
            candidate = manager.prepare(source, metadata(source))
            report = candidate / "verification-report.json"
            payload = json.loads(report.read_text(encoding="utf-8"))
            payload["status"] = "NEVER EXECUTED"
            report.write_text(json.dumps(payload), encoding="utf-8")
            with self.assertRaisesRegex(Exception, "not executed successfully"):
                manager.verify_candidate(candidate, metadata(source))

    def test_candidate_ignores_metadata_pass_flags_and_requires_independent_signed_path_result(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root, source = repo(Path(directory))
            manager = UpdateManager(root, Path(directory) / "state")
            candidate = manager.prepare(source, metadata(source) | {"api_compatibility": False, "execution_verification": False})
            self.assertEqual(manager.verify_candidate(candidate, metadata(source) | {"api_compatibility": False, "execution_verification": False})["execution_verification"], "passed")
            report = json.loads((candidate / "product-verification.json").read_text(encoding="utf-8"))
            report["path_sha256"]["pkg"] = "0" * 64
            (candidate / "product-verification.json").write_text(json.dumps(report), encoding="utf-8")
            with self.assertRaisesRegex(Exception, "path hashes mismatch"):
                manager.verify_candidate(candidate, metadata(source))

    def test_candidate_rejects_product_executor_signature_tampering(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root, source = repo(Path(directory))
            manager = UpdateManager(root, Path(directory) / "state")
            candidate = manager.prepare(source, metadata(source))
            report = json.loads((candidate / "product-verification.json").read_text(encoding="utf-8"))
            report["execution"]["compatible"] = False
            (candidate / "product-verification.json").write_text(json.dumps(report), encoding="utf-8")
            with self.assertRaisesRegex(Exception, "(attestation mismatch|no independently confirmed execution result)"):
                manager.verify_candidate(candidate, metadata(source))

    def test_candidate_rejects_checksum_only_executor_claim_even_when_hash_matches(self) -> None:
        """C forgery #1: a file checksum is not executor authenticity."""
        with tempfile.TemporaryDirectory() as directory:
            root, source = repo(Path(directory))
            manager = UpdateManager(root, Path(directory) / "state")
            candidate = manager.prepare(source, metadata(source))
            report_path = candidate / "product-verification.json"
            report = json.loads(report_path.read_text(encoding="utf-8"))
            unsigned = dict(report)
            unsigned.pop("attestation", None)
            report["attestation"] = {
                "algorithm": "SHA256",
                "value": __import__("hashlib").sha256(
                    updater_module._canonical_json(unsigned)
                ).hexdigest(),
            }
            report_path.write_text(json.dumps(report), encoding="utf-8")
            with self.assertRaisesRegex(Exception, "trusted executor attestation|attestation mismatch"):
                manager.verify_candidate(candidate, metadata(source))

    def test_candidate_rejects_unbound_verifier_and_executor_nonce(self) -> None:
        """C forgery #2: independently edited receipts must not be joined."""
        with tempfile.TemporaryDirectory() as directory:
            root, source = repo(Path(directory))
            manager = UpdateManager(root, Path(directory) / "state")
            candidate = manager.prepare(source, metadata(source))
            report = json.loads((candidate / "verification-report.json").read_text(encoding="utf-8"))
            report["execution_nonce"] = "b" * 64
            (candidate / "verification-report.json").write_text(json.dumps(report), encoding="utf-8")
            with self.assertRaisesRegex(Exception, "unbound .*execution evidence"):
                manager.verify_candidate(candidate, metadata(source))

    def test_candidate_rejects_report_api_or_invocation_rewrite(self) -> None:
        """C reproduction: candidate metadata cannot rewrite executor facts."""
        with tempfile.TemporaryDirectory() as directory:
            root, source = repo(Path(directory))
            manager = UpdateManager(root, Path(directory) / "state")
            candidate = manager.prepare(source, metadata(source))
            report_path = candidate / "verification-report.json"
            report = json.loads(report_path.read_text(encoding="utf-8"))
            report["api"]["required_apis"] = ["ForgedApi"]
            report["execution"]["invocation_id"] = "forged-invocation"
            report_path.write_text(json.dumps(report), encoding="utf-8")
            with self.assertRaisesRegex(Exception, "(required API list|invocation).*attestation"):
                manager.verify_candidate(candidate, metadata(source))

    def test_candidate_rejects_deleted_executor_result(self) -> None:
        """C forgery #3: deleting the product result is never a PASS fallback."""
        with tempfile.TemporaryDirectory() as directory:
            root, source = repo(Path(directory))
            manager = UpdateManager(root, Path(directory) / "state")
            candidate = manager.prepare(source, metadata(source))
            (candidate / "product-verification.json").unlink()
            with self.assertRaisesRegex(Exception, "missing required artifacts: product-verification.json"):
                manager.verify_candidate(candidate, metadata(source))

    def test_candidate_rejects_empty_pkg_even_with_pass_reports(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root, source = repo(Path(directory))
            shutil.rmtree(source / "pkg")
            (source / "pkg").mkdir()
            # Rebind the independently calculated evidence to the empty tree;
            # a signed PASS must still not make a contentless package valid.
            target_hash = tree_sha256(source)
            path_hashes = {name: tree_sha256(source, (name,)) for name in ("src", "pkg")}
            for name in ("api-compatibility.json", "product-verification.json"):
                payload = json.loads((source / name).read_text(encoding="utf-8"))
                payload["target_sha256"] = target_hash
                payload["path_sha256"] = path_hashes
                payload["source_sha256"] = target_hash
                if isinstance(payload.get("execution"), dict):
                    payload["execution"]["path_sha256"] = path_hashes
                if name == "product-verification.json":
                    payload["attestation"]["value"] = executor_attestation(payload)
                (source / name).write_text(json.dumps(payload), encoding="utf-8")
            report = json.loads((source / "verification-report.json").read_text(encoding="utf-8"))
            report["target_sha256"] = target_hash
            (source / "verification-report.json").write_text(json.dumps(report), encoding="utf-8")
            manager = UpdateManager(root, Path(directory) / "state")
            with self.assertRaisesRegex(Exception, "empty managed paths: pkg"):
                manager.prepare(source, metadata(source) | {"source_sha256": target_hash})

    def test_porcelain_z_parses_quoted_paths_and_both_rename_endpoints(self) -> None:
        output = b'R  "src/old\\303\\251.rs"\0src/new name.rs\0?? src/untracked.rs\0'
        self.assertEqual(
            _parse_porcelain_z(output),
            ["src/oldé.rs", "src/new name.rs", "src/untracked.rs"],
        )

    def test_prepare_rejects_incomplete_managed_tree_before_creating_candidate(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root, source = repo(Path(directory))
            (source / "pkg").rename(source / "missing-pkg")
            manager = UpdateManager(root, Path(directory) / "state")
            with self.assertRaisesRegex(Exception, "missing managed paths: pkg"):
                manager.prepare(source, metadata(source))
            self.assertFalse((Path(directory) / "state").exists())

    def test_metadata_validation_pins_tag_commit_hash_and_provenance(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            _, source = repo(Path(directory))
            valid = metadata(source)
            self.assertEqual(validate_metadata(valid)["product_name"], "Uni-HWP")
            for field, value in (("upstream_commit", "not-a-sha"), ("source_sha256", "bad"), ("upstream_tag", "main")):
                invalid = dict(valid)
                invalid[field] = value
                with self.assertRaises(ValueError):
                    validate_metadata(invalid)

    def test_apply_refuses_tracked_and_untracked_changes_in_managed_paths(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root, source = repo(Path(directory))
            manager = UpdateManager(root, Path(directory) / "state")
            candidate = manager.prepare(source, metadata(source))
            (root / "src" / "engine.rs").write_text("local", encoding="utf-8")
            with self.assertRaises(DirtyTreeError):
                manager.apply(candidate)
            git(root, "restore", "src/engine.rs")
            (root / "pkg" / "untracked.js").write_text("local", encoding="utf-8")
            with self.assertRaises(DirtyTreeError):
                manager.apply(candidate)

    def test_lock_contention_is_serialized(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root, _ = repo(Path(directory))
            manager = UpdateManager(root, Path(directory) / "state")
            with _UpdateLock(manager.lock_path):
                with self.assertRaises(LockContentionError):
                    with _UpdateLock(manager.lock_path):
                        pass
            self.assertFalse(manager.lock_path.exists())

    def test_lock_contention_is_non_destructive_across_processes(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root, _ = repo(Path(directory))
            manager = UpdateManager(root, Path(directory) / "state")
            code = (
                "import sys,time; sys.path.insert(0, sys.argv[2]); "
                "from engine_update import _UpdateLock; "
                "lock=_UpdateLock(__import__('pathlib').Path(sys.argv[1])); lock.__enter__(); "
                "print('locked', flush=True); time.sleep(30)"
            )
            child = subprocess.Popen(
                [sys.executable, "-c", code, str(manager.lock_path), str(Path(__file__).parent)],
                stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
            )
            try:
                self.assertEqual(child.stdout.readline().strip(), "locked")
                with self.assertRaises(LockContentionError):
                    with _UpdateLock(manager.lock_path):
                        pass
                self.assertTrue(manager.lock_path.exists())
            finally:
                child.terminate()
                child.wait(timeout=5)
                child.stdout.close()
                child.stderr.close()

    def test_failed_apply_restores_engine_and_writes_rollback_journal(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root, source = repo(Path(directory))
            manager = UpdateManager(root, Path(directory) / "state")
            candidate = manager.prepare(source, metadata(source))
            with self.assertRaisesRegex(Exception, "injected apply failure"):
                manager.apply(candidate, fail_after=1)
            self.assertEqual((root / "src" / "engine.rs").read_text(encoding="utf-8"), "old")
            self.assertEqual((root / "pkg" / "rhwp.js").read_text(encoding="utf-8"), "old")
            journal = manager._latest_journal()
            self.assertIsNotNone(journal)
            self.assertEqual(json.loads(journal.read_text(encoding="utf-8"))["state"], "rolled_back")

            manager.apply(candidate)
            self.assertEqual((root / "src" / "engine.rs").read_text(encoding="utf-8"), "new")
            self.assertEqual((root / "pkg" / "rhwp.js").read_text(encoding="utf-8"), "new")
            manager.rollback()
            self.assertEqual((root / "src" / "engine.rs").read_text(encoding="utf-8"), "old")
            self.assertIsNone(manager.status()["current"])

    def test_update_skips_candidate_with_same_immutable_identity(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root, source = repo(Path(directory))
            state = Path(directory) / "state"
            manager = UpdateManager(root, state)
            candidate = manager.prepare(source, metadata(source))
            manager.apply(candidate)
            result = manager.update(candidate)
            self.assertEqual(result["changed"], False)
            self.assertEqual(result["reason"], "same-engine")

    def test_apply_creates_missing_state_root_before_rollback_backup(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root, source = repo(Path(directory))
            state = Path(directory) / "new-state"
            manager = UpdateManager(root, state)
            candidate = manager.prepare(source, metadata(source))
            # The candidate creation creates state; remove only the state
            # directory to exercise direct apply's initialization contract.
            external_candidate = Path(directory) / "candidate"
            shutil.copytree(candidate, external_candidate)
            shutil.rmtree(state)
            manager.apply(external_candidate)
            self.assertEqual((root / "src" / "engine.rs").read_text(encoding="utf-8"), "new")

    def test_backup_failure_does_not_touch_live_engine_or_leave_recovery_point(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root, source = repo(Path(directory))
            manager = UpdateManager(root, Path(directory) / "state")
            candidate = manager.prepare(source, metadata(source))

            original_copytree = updater_module.shutil.copytree

            def fail_backup(source_path: Path, target_path: Path, *args: object, **kwargs: object) -> None:
                if str(target_path).startswith(str(manager.state_root)):
                    raise OSError("injected backup failure")
                original_copytree(source_path, target_path, *args, **kwargs)

            with patch.object(updater_module.shutil, "copytree", side_effect=fail_backup):
                with self.assertRaisesRegex(OSError, "backup failure"):
                    manager.apply(candidate)

            self.assertEqual((root / "src" / "engine.rs").read_text(encoding="utf-8"), "old")
            self.assertEqual((root / "pkg" / "rhwp.js").read_text(encoding="utf-8"), "old")
            self.assertIsNone(manager._latest_journal())

    def test_rollback_rejects_tampered_backup_and_preserves_installed_tree(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root, source = repo(Path(directory))
            manager = UpdateManager(root, Path(directory) / "state")
            candidate = manager.prepare(source, metadata(source))
            manager.apply(candidate)
            journal = manager._latest_journal()
            self.assertIsNotNone(journal)
            backup = Path(json.loads(journal.read_text(encoding="utf-8"))["backup"])
            (backup / "src" / "engine.rs").write_text("tampered", encoding="utf-8")
            with self.assertRaisesRegex(Exception, "backup integrity"):
                manager.rollback(journal)
            self.assertEqual((root / "src" / "engine.rs").read_text(encoding="utf-8"), "new")

    def test_rollback_pkg_copy_failure_keeps_live_pkg_and_allows_retry(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root, source = repo(Path(directory))
            manager = UpdateManager(root, Path(directory) / "state")
            candidate = manager.prepare(source, metadata(source))
            manager.apply(candidate)
            journal = manager._latest_journal()
            original_copytree = updater_module.shutil.copytree
            failed = False

            def fail_pkg_once(source_path: Path, target_path: Path, *args: object, **kwargs: object) -> None:
                nonlocal failed
                if not failed and source_path.name == "pkg":
                    failed = True
                    raise OSError("injected pkg rollback copy failure")
                original_copytree(source_path, target_path, *args, **kwargs)

            with patch.object(updater_module.shutil, "copytree", side_effect=fail_pkg_once):
                with self.assertRaisesRegex(OSError, "pkg rollback copy failure"):
                    manager.rollback(journal)
            self.assertEqual((root / "src" / "engine.rs").read_text(encoding="utf-8"), "new")
            self.assertEqual((root / "pkg" / "rhwp.js").read_text(encoding="utf-8"), "new")
            self.assertEqual(json.loads(journal.read_text(encoding="utf-8"))["state"], "rollback_pending")
            self.assertTrue(journal.with_name("recovery-journal.jsonl").is_file())
            manager.rollback(journal)
            self.assertEqual((root / "pkg" / "rhwp.js").read_text(encoding="utf-8"), "old")

    def test_compound_rollback_switch_failure_never_leaves_src_pkg_mixed(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root, source = repo(Path(directory))
            manager = UpdateManager(root, Path(directory) / "state")
            candidate = manager.prepare(source, metadata(source))
            manager.apply(candidate)
            journal = manager._latest_journal()
            original = updater_module.UpdateManager._replace_path
            # Fail specifically on the package install after src has switched.
            def fail_pkg_install(source_path: Path, target_path: Path) -> None:
                if source_path.name == "pkg" and "rollback-stage" in str(source_path):
                    raise OSError("injected compound rollback switch failure")
                original(source_path, target_path)

            with patch.object(updater_module.UpdateManager, "_replace_path", side_effect=fail_pkg_install):
                with self.assertRaisesRegex(Exception, "compound rollback switch failure"):
                    manager.rollback(journal)
            src_value = (root / "src" / "engine.rs").read_text(encoding="utf-8")
            pkg_value = (root / "pkg" / "rhwp.js").read_text(encoding="utf-8")
            self.assertEqual(src_value, pkg_value)
            self.assertIn(src_value, {"old", "new"})
            self.assertTrue((root / "src").is_dir())
            self.assertTrue((root / "pkg").is_dir())
            manager.rollback(journal)
            self.assertEqual((root / "src" / "engine.rs").read_text(encoding="utf-8"), "old")
            self.assertEqual((root / "pkg" / "rhwp.js").read_text(encoding="utf-8"), "old")

    def test_rollback_switch_and_journal_failure_preserve_restore_point_for_retry(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root, source = repo(Path(directory))
            manager = UpdateManager(root, Path(directory) / "state")
            candidate = manager.prepare(source, metadata(source))
            original = updater_module.UpdateManager._replace_path

            def fail_pkg(source_path: Path, target_path: Path) -> None:
                if target_path.name == "pkg":
                    raise OSError("injected package switch failure")
                original(source_path, target_path)

            with patch.object(updater_module.UpdateManager, "_replace_path", side_effect=fail_pkg):
                with self.assertRaisesRegex(Exception, "package switch failure"):
                    manager.apply(candidate)
            journal = manager._latest_journal()
            self.assertIsNotNone(journal)
            record = json.loads(journal.read_text(encoding="utf-8"))
            self.assertIn(record["state"], {"rollback_pending", "rolled_back"})
            self.assertTrue(Path(record["backup"]).is_dir())
            self.assertEqual((root / "src" / "engine.rs").read_text(encoding="utf-8"), "old")
            self.assertEqual((root / "pkg" / "rhwp.js").read_text(encoding="utf-8"), "old")
            manager.rollback(journal)
            self.assertEqual((root / "src" / "engine.rs").read_text(encoding="utf-8"), "old")
            self.assertEqual((root / "pkg" / "rhwp.js").read_text(encoding="utf-8"), "old")

    def test_rollback_switch_and_recovery_pkg_copy_failure_restores_complete_snapshot(self) -> None:
        """C reproduction: switch failure plus recovery copy failure cannot lose pkg."""
        with tempfile.TemporaryDirectory() as directory:
            root, source = repo(Path(directory))
            manager = UpdateManager(root, Path(directory) / "state")
            candidate = manager.prepare(source, metadata(source))
            manager.apply(candidate)
            journal = manager._latest_journal()
            original_replace = updater_module.UpdateManager._replace_path
            original_copytree = updater_module.shutil.copytree
            failed_switch = False
            failed_copy = False

            def fail_switch(source_path: Path, target_path: Path) -> None:
                nonlocal failed_switch
                if not failed_switch and target_path.name == "pkg" and "rollback-stage" in str(source_path):
                    failed_switch = True
                    raise OSError("injected rollback pkg switch failure")
                original_replace(source_path, target_path)

            def fail_recovery_copy(source_path: Path, target_path: Path, *args: object, **kwargs: object) -> None:
                nonlocal failed_copy
                if not failed_copy and source_path.name == "pkg" and "rollback-recovery" in str(target_path):
                    failed_copy = True
                    raise OSError("injected recovery pkg copy failure")
                original_copytree(source_path, target_path, *args, **kwargs)

            with patch.object(updater_module.UpdateManager, "_replace_path", side_effect=fail_switch), \
                 patch.object(updater_module.shutil, "copytree", side_effect=fail_recovery_copy):
                with self.assertRaisesRegex(Exception, "recovery pkg copy failure"):
                    manager.rollback(journal)
            self.assertTrue((root / "src").is_dir())
            self.assertTrue((root / "pkg").is_dir())
            src_value = (root / "src" / "engine.rs").read_text(encoding="utf-8")
            pkg_value = (root / "pkg" / "rhwp.js").read_text(encoding="utf-8")
            self.assertEqual(src_value, pkg_value)
            self.assertIn(src_value, {"old", "new"})
            self.assertEqual(json.loads(journal.read_text(encoding="utf-8"))["state"], "rollback_pending")
            manager.rollback(journal)
            self.assertEqual((root / "pkg" / "rhwp.js").read_text(encoding="utf-8"), "old")

    def test_rollback_refuses_newer_edits_and_wrong_repository(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root, source = repo(Path(directory))
            manager = UpdateManager(root, Path(directory) / "state")
            candidate = manager.prepare(source, metadata(source))
            manager.apply(candidate)
            journal = manager._latest_journal()
            self.assertIsNotNone(journal)
            (root / "src" / "engine.rs").write_text("newer", encoding="utf-8")
            with self.assertRaisesRegex(Exception, "newer edits"):
                manager.rollback(journal)
            self.assertEqual((root / "src" / "engine.rs").read_text(encoding="utf-8"), "newer")
            record = json.loads(journal.read_text(encoding="utf-8"))
            record["repository"]["repo_root"] = str(Path(directory) / "other")
            journal.write_text(json.dumps(record), encoding="utf-8")
            with self.assertRaisesRegex(Exception, "different repository"):
                manager.rollback(journal)

    def test_current_write_failure_remains_recoverable_and_recover_interrupted_finishes(self) -> None:
        """A failed state write remains a recoverable journal target."""
        with tempfile.TemporaryDirectory() as directory:
            root, source = repo(Path(directory))
            manager = UpdateManager(root, Path(directory) / "state")
            candidate = manager.prepare(source, metadata(source))
            original_atomic_write = updater_module._atomic_write
            original_restore = manager._restore
            failed_current = False
            failed_restore = False

            def fail_current_once(path: Path, text: str) -> None:
                nonlocal failed_current
                if not failed_current and path == manager.current_path:
                    failed_current = True
                    raise OSError("injected current journal write failure")
                original_atomic_write(path, text)

            def leave_recovery_target(journal: dict[str, object]) -> None:
                nonlocal failed_restore
                if not failed_restore:
                    failed_restore = True
                    raise OSError("simulated interrupted rollback")
                original_restore(journal)

            with patch.object(updater_module, "_atomic_write", side_effect=fail_current_once), \
                 patch.object(manager, "_restore", side_effect=leave_recovery_target):
                with self.assertRaisesRegex(Exception, "simulated interrupted rollback"):
                    manager.apply(candidate)
            journal = manager._latest_journal()
            self.assertIsNotNone(journal)
            self.assertEqual(json.loads(journal.read_text(encoding="utf-8"))["state"], "rollback_pending")
            recovered = manager.recover_interrupted()
            self.assertEqual(recovered, [str(journal)])
            self.assertEqual((root / "src" / "engine.rs").read_text(encoding="utf-8"), "old")
            self.assertEqual((root / "pkg" / "rhwp.js").read_text(encoding="utf-8"), "old")

    def test_unknown_pending_with_missing_managed_path_recovers_from_verified_snapshot(self) -> None:
        """C composite failure: missing names are snapshot recovery targets."""
        with tempfile.TemporaryDirectory() as directory:
            root, source = repo(Path(directory))
            manager = UpdateManager(root, Path(directory) / "state")
            candidate = manager.prepare(source, metadata(source))
            manager.apply(candidate)
            journal = manager._latest_journal()
            self.assertIsNotNone(journal)
            record = json.loads(journal.read_text(encoding="utf-8"))
            record["state"] = "unknown"
            journal.write_text(json.dumps(record), encoding="utf-8")
            shutil.rmtree(root / "pkg")

            self.assertEqual(manager.recover_interrupted(), [str(journal)])
            self.assertEqual((root / "src" / "engine.rs").read_text(encoding="utf-8"), "old")
            self.assertEqual((root / "pkg" / "rhwp.js").read_text(encoding="utf-8"), "old")
            self.assertEqual(json.loads(journal.read_text(encoding="utf-8"))["state"], "rolled_back")

    def test_abandoned_lock_is_recorded_and_interrupted_journal_can_recover(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root, source = repo(Path(directory))
            state = Path(directory) / "state"
            manager = UpdateManager(root, state)
            candidate = manager.prepare(source, metadata(source))
            manager.apply(candidate)
            journal = manager._latest_journal()
            record = json.loads(journal.read_text(encoding="utf-8"))
            record["state"] = "prepared"
            journal.write_text(json.dumps(record), encoding="utf-8")
            (state / "engine-update.lock").write_text(json.dumps({"pid": 2_147_483_647, "created_at": "old"}), encoding="utf-8")
            recovered = manager.recover_interrupted()
            self.assertEqual(recovered, [str(journal)])
            self.assertEqual((root / "src" / "engine.rs").read_text(encoding="utf-8"), "old")
            self.assertTrue((state / "abandoned-locks.jsonl").exists())


if __name__ == "__main__":
    unittest.main()
