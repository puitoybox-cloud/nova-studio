"""Disposable installed metadata; no license approval or production assets."""
import hashlib
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from scoped_closure import canonical, verify_distribution_metadata, verify_closure, verify_assembly
from test_demucs_closure import contract_fixture


class LicenseMaterialsTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.root=Path(self.temp.name);self.graph=contract_fixture(self.root)
        self.node=self.graph['nodes'][2]

    def bind(self, relative, raw):
        path=self.root/relative;path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(raw)
        self.node['files']=[f for f in self.node['files'] if f['path']!=relative]
        self.node['files'].append({'path':relative,'digest':hashlib.sha256(raw).hexdigest(),'byteLength':len(raw)})
        self.node['artifactDigest']=hashlib.sha256(canonical(sorted(self.node['files'],key=lambda f:f['path']))).hexdigest()

    def metadata(self, headers, version='2.4'):
        self.bind('package-1.dist-info/METADATA',
            ('Metadata-Version: '+version+'\nName: package\nVersion: 1\n'+headers+'\nFixture.\n').encode())

    def lookup(self, _):
        return SimpleNamespace(version='1',files=[f['path'] for f in self.node['files']],locate_file=lambda p:self.root/p)

    def test_modern_nested_license_notice_bytes_and_assembly_identity(self):
        self.metadata('License-Expression: MIT\nLicense-File: LICENSE\nLicense-File: vendor/NOTICE\n')
        self.bind('package-1.dist-info/licenses/LICENSE',b'disposable permission text')
        self.bind('package-1.dist-info/licenses/vendor/NOTICE',b'disposable attribution')
        observed=verify_distribution_metadata(self.root,self.node)['licenseMaterials']
        self.assertEqual(observed['layout'],'PEP639');self.assertEqual(len(observed['files']),2)
        self.assertFalse(observed['redistributionApproved']);self.assertFalse(observed['nativeAndWeightsScopeVerified'])
        report=verify_assembly(self.root,self.graph,self.lookup)
        self.assertTrue(report['complete'])
        material=report['noticeMaterialInventory'][0]
        self.assertEqual(material['artifactDigest'],self.node['artifactDigest'])
        self.assertEqual((material['id'],material['version']),('package','1'))
        self.assertEqual(material['files'],observed['files'])
        self.assertFalse(report['noticeRedistributionApproved'])

    def test_legacy_setuptools_header_is_explicitly_separate(self):
        self.metadata('License-File: LICENSE\n',version='2.1')
        self.bind('package-1.dist-info/LICENSE',b'fixture license')
        observed=verify_distribution_metadata(self.root,self.node)['licenseMaterials']
        self.assertEqual(observed['layout'],'LEGACY_METADATA_EXTENSION')
        self.assertEqual(observed['files'][0]['path'],'package-1.dist-info/LICENSE')

    def test_missing_material_blocks_real_closure_and_assembly(self):
        self.metadata('License-File: NOTICE\n')
        with self.assertRaisesRegex(ValueError,'missing-authenticated-license-file'):
            verify_distribution_metadata(self.root,self.node)
        self.assertFalse(verify_closure(self.root,self.graph,self.lookup)['complete'])
        self.assertFalse(verify_assembly(self.root,self.graph,self.lookup)['complete'])

    def test_disk_only_unlisted_license_is_not_authenticated(self):
        self.metadata('License-File: LICENSE\n')
        path=self.root/'package-1.dist-info/licenses/LICENSE';path.parent.mkdir();path.write_bytes(b'fixture')
        with self.assertRaisesRegex(ValueError,'missing-authenticated-license-file'):
            verify_distribution_metadata(self.root,self.node)

    def test_tamper_and_missing_bytes_rejected(self):
        self.metadata('License-File: LICENSE\n')
        relative='package-1.dist-info/licenses/LICENSE';self.bind(relative,b'fixture')
        (self.root/relative).write_bytes(b'changed')
        with self.assertRaises(ValueError):verify_distribution_metadata(self.root,self.node)
        (self.root/relative).unlink()
        with self.assertRaises(ValueError):verify_distribution_metadata(self.root,self.node)

    def test_unsafe_duplicate_and_nonstandard_version_declarations_rejected(self):
        for declared in ('../LICENSE','/LICENSE','vendor/../LICENSE','./LICENSE','vendor//LICENSE',
                'vendor\\LICENSE','https://example.invalid/LICENSE','C:LICENSE'):
            with self.subTest(declared=declared):
                self.metadata('License-File: '+declared+'\n')
                with self.assertRaisesRegex(ValueError,'unsafe-declared-license-path'):
                    verify_distribution_metadata(self.root,self.node)
        self.metadata('License-File: LICENSE\nLicense-File: LICENSE\n')
        with self.assertRaisesRegex(ValueError,'duplicate-or-overbudget'):
            verify_distribution_metadata(self.root,self.node)
        self.metadata('License-File: LICENSE\n',version='3.0')
        with self.assertRaisesRegex(ValueError,'unsupported-license-metadata-version'):
            verify_distribution_metadata(self.root,self.node)

    def test_no_header_is_unknown_not_no_obligations(self):
        self.metadata('License: MIT\n')
        observed=verify_distribution_metadata(self.root,self.node)['licenseMaterials']
        self.assertEqual(observed['status'],'NO_LICENSE_FILE_DECLARATION')
        self.assertFalse(observed['redistributionApproved'])
        self.assertFalse(observed['nativeAndWeightsScopeVerified'])

    def test_symlink_and_material_budget_rejected(self):
        self.metadata('License-File: LICENSE\n');relative='package-1.dist-info/licenses/LICENSE'
        self.bind(relative,b'fixture');path=self.root/relative
        path.unlink();path.symlink_to(self.root/'2.bin')
        with self.assertRaises(ValueError):verify_distribution_metadata(self.root,self.node)
        self.node['files'][-1]['byteLength']=1024*1024+1
        with self.assertRaisesRegex(ValueError,'license-material-budget'):
            verify_distribution_metadata(self.root,self.node)


if __name__=='__main__':unittest.main()
