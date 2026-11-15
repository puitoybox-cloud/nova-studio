"""Real file assembly guards; fixtures never establish Mac execution acceptance."""
import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from build_intel_app import files_manifest, check_models, runtime_notices


class Assembly(unittest.TestCase):
    def test_manifest_hashes_actual_bytes_and_executable_mode(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); (root / 'binary').write_bytes(b'actual'); (root / 'binary').chmod(0o755)
            row = files_manifest(root)[0]
            self.assertEqual(row['sha256'], hashlib.sha256(b'actual').hexdigest())
            self.assertEqual(row['byteLength'], 6); self.assertTrue(row['executable'])
            (root / 'binary').write_bytes(b'changed')
            self.assertNotEqual(row['sha256'], files_manifest(root)[0]['sha256'])

    def test_symlink_escape_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); (root / 'escape').symlink_to('/etc/passwd')
            with self.assertRaises(ValueError): files_manifest(root)

    def test_model_placeholder_cannot_pass(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); (root / 'weights').mkdir(); (root / 'weights/model_base.onnx').write_bytes(b'fixture')
            with self.assertRaises(ValueError): check_models(root)

    def test_license_missing_unknown_and_target_mismatch_fail(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); source = root / 'source'; source.mkdir()
            m = {'target_triple':'x86_64-apple-darwin','python_version':'3.12.15',
                 'license_path':'licenses/LICENSE.txt','licenses':['Python-2.0'],
                 'build_info':{'extensions':{}}}
            (source / 'PYTHON.json').write_text(json.dumps(m))
            with self.assertRaises(FileNotFoundError): runtime_notices(source, root / 'notice1')
            m['licenses'] = ['UNKNOWN']; (source / 'PYTHON.json').write_text(json.dumps(m))
            with self.assertRaises(ValueError): runtime_notices(source, root / 'notice2')
            m['target_triple'] = 'aarch64-apple-darwin'; (source / 'PYTHON.json').write_text(json.dumps(m))
            with self.assertRaises(ValueError): runtime_notices(source, root / 'notice3')


if __name__ == '__main__': unittest.main()
