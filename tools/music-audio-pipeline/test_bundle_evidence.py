import importlib.metadata
import tempfile
import unittest
from email.message import Message
from pathlib import Path
from unittest.mock import patch
import bundle_evidence as evidence


class BundleEvidenceTests(unittest.TestCase):
    def test_actual_bytes_and_symlinks(self):
        with tempfile.TemporaryDirectory() as root:
            path = Path(root, 'model.th'); path.write_bytes(b'fixture-model-not-approved')
            Path(root, 'alias').symlink_to(path)
            entries = evidence.package_files(root)
            self.assertEqual(entries[0]['status'], 'UNVERIFIED')
            self.assertEqual(entries[1]['kind'], 'MODEL_CANDIDATE')
            self.assertEqual(entries[1]['productionReachability'], 'UNVERIFIED')
            self.assertEqual(entries[1]['byteLength'], path.stat().st_size)

    def test_symlink_root_rejected(self):
        with tempfile.TemporaryDirectory() as root:
            path = Path(root, 'link'); path.symlink_to(root)
            with self.assertRaises(ValueError): evidence.package_files(path)

    def test_missing_distribution_never_claims_license(self):
        def lookup(name): raise importlib.metadata.PackageNotFoundError(name)
        self.assertEqual(evidence.distributions(['absent'], lookup)[0]['license'], 'LICENSE_UNCONFIRMED')

    def test_metadata_and_notice_are_evidence_not_approval(self):
        with tempfile.TemporaryDirectory() as root:
            Path(root, 'LICENSE').write_text('fixture notice')
            metadata = Message(); metadata['License-Expression'] = 'fixture-expression'
            class Dist:
                version = 'fixture'; files = [Path('LICENSE')]; requires = ['child; python_version < "0"']
                def locate_file(self, name): return Path(root, name)
            dist = Dist(); dist.metadata = metadata
            entry = evidence.distributions(['fixture'], lambda _: dist)[0]
            self.assertEqual(entry['license'], 'LOCAL_EVIDENCE_PRESENT')
            self.assertFalse(entry['redistributionApproved'])
            self.assertEqual(entry['dependencyMarkerEvaluation'], 'NOT_EVALUATED')
            self.assertEqual(entry['licenseFiles'][0]['byteLength'], 14)

    def test_unknown_binary_architecture_is_not_promoted(self):
        with tempfile.TemporaryDirectory() as root:
            Path(root, 'native').write_bytes(b'\x7fELF' + b'fixture')
            item = evidence.package_files(root)[0]
            self.assertEqual(item['kind'], 'NATIVE_CANDIDATE')
            self.assertEqual(item['architecture'], 'UNKNOWN')

    def test_report_cannot_grant_eligibility(self):
        with patch.object(evidence, 'distributions', return_value=[]):
            report = evidence.report()
        self.assertFalse(report['publicationEligible'])
        self.assertFalse(report['approvedAnchor'])
        self.assertFalse(report['modelsLoaded'])
        self.assertEqual(report['scope'], 'TEST_ONLY')


if __name__ == '__main__': unittest.main()
