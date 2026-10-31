import json
from pathlib import Path
import tempfile
import unittest
from build_intel_app import files_manifest
from package_integrity import verify


class Integrity(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name) / 'Contents'
        (self.root / 'Resources').mkdir(parents=True)
        (self.root / 'engine').write_bytes(b'real recorded bytes')
        self.manifest = self.root / 'Resources/package-candidate.json'
        self.manifest.write_text(json.dumps({'format':'NOVA_INTEL_PACKAGE_CANDIDATE','version':1,
                                             'files':files_manifest(self.root)}))

    def test_relocation_and_exact_inventory(self):
        self.assertEqual(verify(self.root)['version'], 1)
        moved = self.root.with_name('relocated Contents'); self.root.rename(moved)
        self.assertEqual(verify(moved)['version'], 1)

    def test_corruption_and_missing_bytes(self):
        (self.root / 'engine').write_bytes(b'fake recorded bytes')
        with self.assertRaises(ValueError): verify(self.root)
        (self.root / 'engine').unlink()
        with self.assertRaises(FileNotFoundError): verify(self.root)

    def test_extra_injected_module_is_rejected(self):
        (self.root / 'unlisted.py').write_text('pass')
        with self.assertRaises(ValueError): verify(self.root)

    def test_permissions_and_symlink_substitution_reject(self):
        (self.root / 'engine').chmod(0o755)
        with self.assertRaises(ValueError): verify(self.root)
        (self.root / 'engine').unlink(); (self.root / 'engine').symlink_to('/etc/passwd')
        with self.assertRaises(ValueError): verify(self.root)


if __name__ == '__main__': unittest.main()
