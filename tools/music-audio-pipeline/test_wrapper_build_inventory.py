"""Disposable build observations; never actual asset or license approval."""
import hashlib
import plistlib
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import wrapper_build_inventory as inventory
from test_unsigned_app import executable_macho
from scoped_closure import validate_graph, verify_assembly


class WrapperBuildInventoryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root/'Contents/MacOS').mkdir(parents=True)
        (self.root/'Contents/Info.plist').write_bytes(plistlib.dumps({'CFBundleExecutable':'Music Studio','CFBundlePackageType':'APPL'}))
        self.executable = self.root/'Contents/MacOS/Music Studio'
        self.executable.write_bytes(executable_macho(names=('/usr/lib/libSystem.B.dylib',)))
        self.executable.chmod(0o755)

    def observe(self): return inventory.observe(self.root,'a'*40,'x86_64')

    def test_actual_file_identity_existing_graph_and_no_approval(self):
        before = {p.relative_to(self.root).as_posix():p.read_bytes() for p in self.root.rglob('*') if p.is_file()}
        report = self.observe(); nodes = validate_graph(report['observedGraph'])
        self.assertFalse(report['complete']); self.assertFalse(report['approvedAnchor']); self.assertFalse(report['publicationEligible'])
        self.assertEqual(report['status'],'INCOMPLETE'); self.assertTrue(report['missingApprovedAssets'])
        for node in nodes.values():
            self.assertEqual(node['evidence'],'OBSERVED_METADATA_ONLY'); self.assertEqual(node['licenseStatus'],'REVIEW_REQUIRED')
            self.assertEqual(node['requires'],[])
            for f in node['files']:
                raw = before[f['path']]
                self.assertEqual(f['digest'],hashlib.sha256(raw).hexdigest()); self.assertEqual(f['byteLength'],len(raw))
        self.assertFalse(verify_assembly(self.root,report['observedGraph'])['complete'])
        self.assertEqual(report['nativeImages'][0]['commands'],['/usr/lib/libSystem.B.dylib'])
        self.assertFalse(report['nativeImages'][0]['actualLoaded'])
        self.assertEqual(before,{p.relative_to(self.root).as_posix():p.read_bytes() for p in self.root.rglob('*') if p.is_file()})

    def test_missing_plist_executable_or_unsafe_name_fail(self):
        self.executable.unlink()
        with self.assertRaisesRegex(ValueError,'missing-wrapper-executable'): self.observe()
        (self.root/'Contents/Info.plist').write_bytes(plistlib.dumps({'CFBundleExecutable':'../foreign','CFBundlePackageType':'APPL'}))
        with self.assertRaises(ValueError): self.observe()
        (self.root/'Contents/Info.plist').unlink()
        with self.assertRaisesRegex(ValueError,'missing-wrapper-info'): self.observe()

    def test_symlink_and_non_native_wrapper_never_export_graph(self):
        alias = self.root/'alias'; alias.symlink_to(self.executable)
        with self.assertRaisesRegex(ValueError,'symlink'): self.observe()
        alias.unlink(); self.executable.write_bytes(b'#!/bin/bash\n')
        with self.assertRaisesRegex(ValueError,'not-macho'): self.observe()

    def test_wrong_architecture_and_missing_execute_permission_fail(self):
        with self.assertRaises(ValueError): inventory.observe(self.root,'a'*40,'arm64')
        self.executable.chmod(0o644)
        with self.assertRaisesRegex(ValueError,'mode-missing'): self.observe()
        with self.assertRaises(ValueError): inventory.observe(self.root,'guess','x86_64')

    def test_zero_byte_resource_is_reported_without_dropping_file(self):
        (self.root/'empty').write_bytes(b'')
        report = self.observe()
        self.assertIsNone(report['observedGraph']); self.assertTrue(report['graphConversionIssues'])
        self.assertEqual(next(f for f in report['files'] if f['path']=='empty')['byteLength'],0)

    def test_file_and_tree_budgets_fail_closed(self):
        with patch.object(inventory,'MAX_FILES',1),self.assertRaisesRegex(ValueError,'file-budget'): self.observe()
        with patch.object(inventory,'MAX_TOTAL',1),self.assertRaisesRegex(ValueError,'byte-budget'): self.observe()

    def test_directory_mutation_detected_before_export(self):
        original = inventory.native_image_routes
        def insert(*args):
            (self.root/'late-file').write_text('unexpected')
            return original(*args)
        with patch.object(inventory,'native_image_routes',side_effect=insert),self.assertRaisesRegex(ValueError,'changed-wrapper-tree'): self.observe()

    def test_missing_approved_assets_never_filled_by_observed_wrapper(self):
        report = self.observe()
        self.assertEqual({x['status'] for x in report['missingApprovedAssets']},{'MISSING'})
        self.assertIn('native-wrapper',{x['id'] for x in report['missingApprovedAssets']})
        self.assertEqual(report['modelLicense']['basicPitch'],'LICENSE_UNCONFIRMED')
        self.assertEqual(report['modelLicense']['demucs'],'EXTERNAL_LICENSE_VERIFICATION_REQUIRED')
        self.assertFalse(report['redistributionApproved']); self.assertFalse(report['signingPerformed'])

    def test_signed_build_observed_without_stripping_or_approval(self):
        import struct
        raw = bytearray(executable_macho(names=()))
        struct.pack_into('<II',raw,16,1,16)
        raw.extend(struct.pack('<IIII',0x1d,16,0,0))
        self.executable.write_bytes(raw)
        report = self.observe()
        self.assertEqual(report['nativeImages'][0]['signing'],'SIGNATURE_PRESENT_UNVERIFIED')
        self.assertEqual(self.executable.read_bytes(),bytes(raw))
        self.assertFalse(report['complete']); self.assertFalse(report['approvedAnchor'])

    def test_array_plist_and_dylib_wrapper_fail_closed(self):
        from test_native_routing import macho
        self.executable.write_bytes(macho(names=()))
        with self.assertRaisesRegex(ValueError,'MH_EXECUTE'): self.observe()
        (self.root/'Contents/Info.plist').write_bytes(plistlib.dumps([]))
        with self.assertRaisesRegex(ValueError,'info-plist'): self.observe()

    def test_unhandled_executable_loader_is_observed_as_unsupported_not_accepted(self):
        import struct
        raw = bytearray(executable_macho(names=()))
        text = b'/usr/lib/dyld\x00'; length = (12+len(text)+7)//8*8
        command = struct.pack('<III',0xe,length,12)+text+b'\x00'*(length-12-len(text))
        struct.pack_into('<II',raw,16,1,len(command)); raw.extend(command)
        self.executable.write_bytes(raw)
        report = self.observe()
        image = report['nativeImages'][0]
        self.assertEqual(image['routingStatus'],'UNSUPPORTED')
        self.assertIsNone(image['commands']); self.assertEqual(image['architecture'],'UNVERIFIED')
        self.assertFalse(report['complete']); self.assertFalse(report['publicationEligible'])
        self.assertIsNotNone(report['observedGraph'])
        self.assertFalse(verify_assembly(self.root,report['observedGraph'])['complete'])
