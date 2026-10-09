"""Disposable app/Mach-O fixtures, not production assets or signing approval."""
import copy
import hashlib
import plistlib
import struct
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import unsigned_app as app
from scoped_closure import canonical
from test_native_routing import macho, fat


def executable_macho(**kwargs):
    raw = bytearray(macho(**kwargs)); struct.pack_into('<I',raw,12,2)
    return bytes(raw)


class UnsignedAppTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.nodes = []
        self.add('plist','CONFIG','Contents/Info.plist',plistlib.dumps({'CFBundlePackageType':'APPL','CFBundleExecutable':'Music Studio'}))
        self.add('wrapper','EXECUTABLE','Contents/MacOS/Music Studio',executable_macho(names=('@loader_path/../Frameworks/private.dylib',)))
        self.add('library','NATIVE_EXTENSION','Contents/Frameworks/private.dylib',macho(names=()))
        self.add('helper','EXECUTABLE','Contents/Resources/pipeline/Helper',b'#!/bin/bash\nexit 2\n')
        self.nodes[0]['requires'] = ['wrapper','library','helper']
        self.graph = {'version':1,'roots':['plist'],'nodes':self.nodes}

    def add(self,identity,kind,name,raw):
        path = self.root/name; path.parent.mkdir(parents=True,exist_ok=True); path.write_bytes(raw)
        if kind == 'EXECUTABLE': path.chmod(0o755)
        files = [{'path':name,'digest':hashlib.sha256(raw).hexdigest(),'byteLength':len(raw)}]
        self.nodes.append({'id':identity,'kind':kind,'version':'TEST_ONLY','requires':[],
             'files':files,'artifactDigest':hashlib.sha256(canonical(files)).hexdigest(),
             'evidence':'VERIFIED_ARTIFACT','licenseStatus':'APPROVED'})

    def replace(self,index,raw):
        node = self.nodes[index]; binding = node['files'][0]
        (self.root/binding['path']).write_bytes(raw)
        binding.update(digest=hashlib.sha256(raw).hexdigest(),byteLength=len(raw))
        node['artifactDigest'] = hashlib.sha256(canonical(node['files'])).hexdigest()

    def test_exact_layout_edges_and_inside_out_signing_candidates(self):
        report = app.layout(self.root,self.graph,'x86_64')
        self.assertTrue(report['layoutComplete']); self.assertTrue(report['nativeDiskRoutesComplete'])
        self.assertFalse(report['publicationEligible']); self.assertEqual(report['runtimeAcceptance'],'UNVERIFIED')
        self.assertEqual(len(report['nestedMachO']),2)
        self.assertEqual(report['nativeDiskEdges'][0]['child'],'Contents/Frameworks/private.dylib')
        self.assertEqual(report['scriptExecutables'],['Contents/Resources/pipeline/Helper'])
        self.assertEqual(report['signingOrderCandidate'][-1],'.')

    def test_missing_wrapper_and_plist_report_concrete_paths(self):
        graph = copy.deepcopy(self.graph)
        graph['nodes'][1]['files'] = []; graph['nodes'][1]['artifactDigest'] = hashlib.sha256(canonical([])).hexdigest()
        report = app.layout(self.root,graph,'x86_64')
        self.assertFalse(report['layoutComplete']); self.assertEqual(report['missing'][0]['path'],'Contents/MacOS/Music Studio')
        graph['nodes'][0]['files'] = []; graph['nodes'][0]['artifactDigest'] = hashlib.sha256(canonical([])).hexdigest()
        self.assertEqual(app.layout(self.root,graph,'x86_64')['missing'][0]['path'],'Contents/Info.plist')

    def test_external_system_rpath_and_executable_relative_never_approved(self):
        for names,rpaths in [(('/usr/lib/libSystem.B.dylib',),()),(('/opt/homebrew/lib/libforeign.dylib',),()),
                (('@executable_path/../Frameworks/private.dylib',),()),
                (('@rpath/private.dylib',),('/foreign',)),(('@loader_path/missing.dylib',),())]:
            with self.subTest(names=names):
                self.replace(1,executable_macho(names=names,rpaths=rpaths))
                report = app.layout(self.root,self.graph,'x86_64')
                self.assertFalse(report['nativeDiskRoutesComplete']); self.assertTrue(report['externalPaths'])
                self.assertEqual(report['status'],'PARTIAL')

    def test_unsafe_plist_names_and_wrong_bundle_type_fail(self):
        for executable in ['../foreign','/absolute','.', '','a\\b']:
            self.replace(0,plistlib.dumps({'CFBundlePackageType':'APPL','CFBundleExecutable':executable}))
            with self.assertRaises(ValueError): app.layout(self.root,self.graph,'x86_64')
        self.replace(0,plistlib.dumps({'CFBundlePackageType':'FMWK','CFBundleExecutable':'Music Studio'}))
        with self.assertRaises(ValueError): app.layout(self.root,self.graph,'x86_64')

    def test_tamper_extra_file_symlink_and_missing_execute_permission_fail(self):
        path = self.root/'Contents/MacOS/Music Studio'; raw = path.read_bytes()
        path.write_bytes(b'tampered')
        with self.assertRaises(ValueError): app.layout(self.root,self.graph,'x86_64')
        path.write_bytes(raw); path.chmod(0o644)
        with self.assertRaisesRegex(ValueError,'permission'): app.layout(self.root,self.graph,'x86_64')
        path.chmod(0o755); extra = self.root/'extra'; extra.write_bytes(b'ambient')
        with self.assertRaisesRegex(ValueError,'unbound-app-file'): app.layout(self.root,self.graph,'x86_64')
        extra.unlink(); extra.symlink_to(path)
        with self.assertRaisesRegex(ValueError,'symlink'): app.layout(self.root,self.graph,'x86_64')

    def test_selected_fat_slice_and_wrong_architecture(self):
        self.replace(1,fat([(0x1000007,executable_macho(names=())),(0x100000c,executable_macho(cpu=0x100000c,names=()))]))
        self.replace(2,fat([(0x1000007,macho(names=())),(0x100000c,macho(cpu=0x100000c,names=()))]))
        for architecture in ('x86_64','arm64'):
            self.assertTrue(app.layout(self.root,self.graph,architecture)['nativeDiskRoutesComplete'])
        self.replace(2,macho(names=()))
        with self.assertRaises(ValueError): app.layout(self.root,self.graph,'arm64')

    def test_generation_missing_stops_before_layout_and_no_output(self):
        generation = {'complete':False,'missing':[{'id':'python-runtime','status':'MISSING'}]}
        destination = self.root/'NeverCreated.app'
        with patch.object(app,'inspect_generation',return_value=(generation,None)), \
             patch.object(app,'layout',side_effect=AssertionError('must not call')), \
             patch.object(app,'assemble_generation',side_effect=AssertionError('must not assemble')):
            report = app.assemble(self.root,'manifest','anchor','build','x86_64',destination)
        self.assertFalse(report['unsignedDiskComplete']); self.assertFalse(destination.exists())

    def test_disk_candidate_never_promotes_whole_production_complete(self):
        with patch.object(app,'inspect_generation',return_value=({'complete':True},self.graph)):
            report = app.inspect(self.root,'manifest','anchor','build','x86_64')
        self.assertTrue(report['unsignedDiskComplete']); self.assertFalse(report['complete'])
        self.assertFalse(report['publicationEligible']); self.assertEqual(report['runtimeAcceptance'],'UNVERIFIED')

    def test_dylib_cannot_substitute_for_wrapper_executable(self):
        self.replace(1,macho(names=()))
        with self.assertRaisesRegex(ValueError,'MH_EXECUTE'):
            app.layout(self.root,self.graph,'x86_64')

    def test_failed_destination_layout_is_removed(self):
        destination = self.root/'CreatedByAssembler.app'
        def staged(*args):
            destination.mkdir()
            return {'staged':True}
        accepted = {'unsignedDiskComplete':True,'complete':False}
        refused = {'unsignedDiskComplete':False,'complete':False,'status':'INCOMPLETE'}
        with patch.object(app,'inspect',side_effect=[accepted,refused]), \
             patch.object(app,'assemble_generation',side_effect=staged):
            result = app.assemble(self.root,'manifest','anchor','build','x86_64',destination)
        self.assertFalse(result['staged']); self.assertFalse(destination.exists())

    def test_pre_signed_native_bytes_rejected_without_stripping(self):
        raw = bytearray(executable_macho(names=()))
        struct.pack_into('<II',raw,16,1,16)
        raw.extend(struct.pack('<IIII',0x1d,16,0,0))
        self.replace(1,bytes(raw))
        before = (self.root/'Contents/MacOS/Music Studio').read_bytes()
        with self.assertRaisesRegex(ValueError,'pre-signed'):
            app.layout(self.root,self.graph,'x86_64')
        self.assertEqual((self.root/'Contents/MacOS/Music Studio').read_bytes(),before)

    def test_dynamic_linker_is_recorded_without_granting_system_policy(self):
        from test_package_macho import image, route_command
        self.replace(1,image([route_command(0xe,'/usr/lib/dyld')]))
        report = app.layout(self.root,self.graph,'x86_64')
        self.assertTrue(report['layoutComplete'])
        self.assertFalse(report['nativeDiskRoutesComplete'])
        self.assertFalse(report['publicationEligible'])
        self.assertEqual(report['dynamicLinkers'][0]['path'],'/usr/lib/dyld')
        self.assertEqual(report['externalPaths'][0]['kind'],'APPLE_SYSTEM_LOADER_CANDIDATE_POLICY_REQUIRED')
        self.assertEqual(report['status'],'PARTIAL')

    def test_foreign_dynamic_loader_never_completes_disk_candidate(self):
        from test_package_macho import image, route_command
        for loader in ('/opt/homebrew/lib/dyld','@loader_path/private-dyld','dyld'):
            with self.subTest(loader=loader):
                self.replace(1,image([route_command(0xe,loader)]))
                with patch.object(app,'inspect_generation',return_value=({'complete':True},self.graph)):
                    report = app.inspect(self.root,'manifest','anchor','build','x86_64')
                self.assertFalse(report['unsignedDiskComplete'])
                self.assertFalse(report['complete'])
                self.assertEqual(report['appLayout']['externalPaths'][0]['kind'],'EXTERNAL_DYNAMIC_LINKER_POLICY_REQUIRED')

    def test_dyld_environment_still_rejected_at_package_boundary(self):
        from test_package_macho import image, route_command
        self.replace(1,image([route_command(0x27,'DYLD_LIBRARY_PATH=/foreign')]))
        with self.assertRaisesRegex(ValueError,'environment-forbidden'):
            app.layout(self.root,self.graph,'x86_64')
