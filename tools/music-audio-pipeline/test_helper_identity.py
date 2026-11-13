"""Offline identity fixtures: no ML dependency, installs or real Helper launch."""
import copy
import unittest
from pathlib import Path
import helper_identity as identity

ROOT = Path(__file__).parent

class HelperIdentityTests(unittest.TestCase):
    def health(self):
        return {"ok": True, "localOnly": True, "host": "127.0.0.1", "port": 8766,
                "version": 1, "pipelineRevision": 2, "sourceDigest": identity.digest(ROOT / "server.py"),
                "runtimeIdentity": identity.identity(ROOT)}

    def test_correct_identity_and_retry(self):
        self.assertTrue(identity.validate(self.health(), ROOT))
        bad = self.health()
        bad["sourceDigest"] = "0" * 64
        with self.assertRaises(ValueError):
            identity.validate(bad, ROOT)
        self.assertTrue(identity.validate(self.health(), ROOT))

    def test_wrong_revision_digest_protocol_runtime_and_artifacts(self):
        for key, value in [("pipelineRevision", 3), ("sourceDigest", "0" * 64), ("localOnly", False), ("host", "example.invalid"), ("port", 8767)]:
            with self.subTest(key=key):
                health = self.health()
                health[key] = value
                with self.assertRaises(ValueError):
                    identity.validate(health, ROOT)
        for key in ["protocolVersion", "runtimeVersion", "requirementsDigest", "identityModuleDigest"]:
            with self.subTest(key=key):
                health = self.health()
                health["runtimeIdentity"][key] = "wrong"
                with self.assertRaises(ValueError):
                    identity.validate(health, ROOT)

    def test_missing_identity_and_unavailable(self):
        health = self.health()
        del health["runtimeIdentity"]
        for value in [health, None, {}, {"ok": False}]:
            with self.assertRaises(ValueError):
                identity.validate(value, ROOT)

    def test_model_inventory_is_unconfigured_and_exact_expected_never_inferred(self):
        health = self.health()
        self.assertEqual(health["runtimeIdentity"]["modelInventory"]["status"], "UNCONFIGURED")
        with self.assertRaisesRegex(ValueError, "model-inventory-mismatch"):
            identity.validate(health, ROOT, expected_models=[{"identity": "synthetic-only"}])
        expected = [{"identity": "synthetic-only", "digest": "a" * 64, "byteLength": 3}]
        health["runtimeIdentity"]["modelInventory"] = {"status": "VERIFIED", "entries": copy.deepcopy(expected)}
        self.assertTrue(identity.validate(health, ROOT, expected_models=expected))
        health["runtimeIdentity"]["modelInventory"]["entries"][0]["digest"] = "b" * 64
        with self.assertRaises(ValueError):
            identity.validate(health, ROOT, expected_models=expected)
