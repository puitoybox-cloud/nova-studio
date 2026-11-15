import hashlib
import importlib.metadata
import tempfile
import unittest
from pathlib import Path
from dependency_identity import observe_packages, verify_local_asset

class DependencyIdentityTests(unittest.TestCase):
    def test_actual_metadata_missing_and_no_inferred_digest(self):
        def version(name):
            if name == 'demucs':
                raise importlib.metadata.PackageNotFoundError(name)
            return 'fixture'
        result = observe_packages(version)
        self.assertEqual(result['status'], 'UNVERIFIED')
        self.assertEqual(result['entries'][1]['status'], 'MISSING')
        self.assertNotIn('digest', result['entries'][0])

    def test_local_bytes_budget_missing_wrong_digest_and_retry(self):
        with tempfile.TemporaryDirectory() as root:
            Path(root, 'model').write_bytes(b'abc')
            expected = dict(id='fixture', revision='1', byteLength=3, digest=hashlib.sha256(b'abc').hexdigest())
            self.assertEqual(verify_local_asset(root, 'model', expected, 3), expected)
            for path, value, budget in [('missing', expected, 3), ('model', dict(expected, digest='0'*64), 3), ('model', expected, 2), ('../model', expected, 3)]:
                with self.assertRaises(ValueError):
                    verify_local_asset(root, path, value, budget)
            self.assertEqual(verify_local_asset(root, 'model', expected, 3), expected)

    def test_exact_installed_versions_and_native_identity(self):
        from dependency_identity import validate_dependencies
        expected = [dict(id='fixture-native', version='1', digest='a'*64)]
        self.assertTrue(validate_dependencies(expected, expected))
        for actual in [[], [dict(expected[0], version='2')], [dict(expected[0], digest='b'*64)], expected*2]:
            with self.assertRaises(ValueError):
                validate_dependencies(expected, actual)
