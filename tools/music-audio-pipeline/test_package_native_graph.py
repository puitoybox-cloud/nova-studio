"""Synthetic package graph regression only; no production or runtime approval."""
import hashlib
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from scoped_closure import canonical
from test_package_macho import image, route_command
from test_native_routing import fat
import package_native_graph as graph_module

MAIN = 'Contents/MacOS/Wrapper'
LIB = 'Contents/Frameworks/a.dylib'


def native(loads=(),rpaths=(),install=None,cpu=0x1000007,kind=6,loader=None):
    commands = [route_command(command,name,24) for command,name in loads]
    commands += [route_command(0x8000001c,name) for name in rpaths]
    if install: commands.append(route_command(0xd,install,24))
    if loader: commands.append(route_command(0xe,loader))
    return image(commands,cpu=cpu,kind=kind)


class PackageNativeGraphTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(); self.addCleanup(self.temp.cleanup)
        self.root=Path(self.temp.name).resolve(); self.nodes=[]
        self.add(MAIN,native(kind=2),'EXECUTABLE')
        self.add(LIB,native(install='@rpath/a.dylib'))

    def add(self,name,raw,kind='NATIVE_EXTENSION'):
        path=self.root/name; path.parent.mkdir(parents=True,exist_ok=True); path.write_bytes(raw)
        if kind=='EXECUTABLE': path.chmod(0o755)
        files=[{'path':name,'digest':hashlib.sha256(raw).hexdigest(),'byteLength':len(raw)}]
        self.nodes.append({'id':'node-'+str(len(self.nodes)),'kind':kind,'version':'TEST_ONLY',
            'requires':[],'files':files,'artifactDigest':hashlib.sha256(canonical(files)).hexdigest(),
            'evidence':'OBSERVED_METADATA_ONLY','licenseStatus':'REVIEW_REQUIRED'})

    def replace(self,name,raw):
        node=next(n for n in self.nodes if n['files'][0]['path']==name)
        (self.root/name).write_bytes(raw); b=node['files'][0]
        b.update(digest=hashlib.sha256(raw).hexdigest(),byteLength=len(raw))
        node['artifactDigest']=hashlib.sha256(canonical(node['files'])).hexdigest()

    def inspect(self,arch='x86_64',main=MAIN):
        g={'version':1,'roots':[n['id'] for n in self.nodes],'nodes':self.nodes}
        return graph_module.inspect_native_graph(self.root,g,arch,main)

    def bound_route(self,route,rpaths=()):
        self.replace(MAIN,native([(0xc,route)],rpaths,kind=2))
        self.replace(LIB,native(install=route))
        r=self.inspect(); e=r['edges'][0]
        self.assertEqual(e['classification'],'PACKAGE_INTERNAL')
        self.assertEqual(e['resolvedPackagePath'],LIB)
        self.assertEqual(e['targetAssetIdentity']['digest'],self.nodes[1]['files'][0]['digest'])
        self.assertTrue(r['packageInternalNativeClosureComplete'])
        for key in ('actualLoaded','mappedBytesVerified','runtimeSelectionVerified','publicationEligible','approvedAnchor'):
            self.assertFalse(r[key])
        self.assertEqual(e['bindingEvidence'],'OBSERVED_METADATA_ONLY')
        return r

    def test_loader_path_success(self):
        self.bound_route('@loader_path/../Frameworks/a.dylib')

    def test_ordered_rpath_success(self):
        r=self.bound_route('@rpath/a.dylib',('@loader_path/../Missing','@loader_path/../Frameworks'))
        self.assertEqual([p['order'] for p in r['rpaths']],[0,1])
        self.assertEqual(len(r['edges'][0]['expandedCandidatePaths']),2)

    def test_executable_path_from_nested_image_uses_main_not_loader(self):
        b='Contents/Resources/child/b.dylib'
        self.add(b,native([(0xc,'@executable_path/../Frameworks/a.dylib')],install='@loader_path/../Resources/child/b.dylib'))
        self.replace(MAIN,native([(0xc,'@loader_path/../Resources/child/b.dylib')],kind=2))
        self.replace(LIB,native(install='@executable_path/../Frameworks/a.dylib'))
        r=self.inspect(); self.assertTrue(r['transitiveClosureComplete'])
        e=next(e for e in r['edges'] if e['parent']==b)
        self.assertEqual(e['resolvedPackagePath'],LIB)
        self.assertEqual(r['transitiveAdjacency'][MAIN],[b])
        order=r['signingOrderCandidate']['nativeLeafFirst']
        self.assertLess(order.index(LIB),order.index(b)); self.assertLess(order.index(b),order.index(MAIN))

    def test_absolute_package_equivalent(self):
        self.bound_route(str(self.root/LIB))

    def test_root_escape_and_executable_escape_block(self):
        for value in ('@loader_path/../../../foreign.dylib','@executable_path/../../../foreign.dylib',str(self.root)+'/../foreign.dylib'):
            with self.subTest(value=value):
                self.replace(MAIN,native([(0xc,value)],kind=2))
                r=self.inspect(); self.assertEqual(r['edges'][0]['classification'],'BLOCKED_EXTERNAL')
                self.assertFalse(r['packageInternalNativeClosureComplete'])

    def test_ambiguous_rpath_blocks_even_identical_bytes(self):
        self.add('Contents/Other/a.dylib',native(install='@rpath/a.dylib'))
        self.replace(MAIN,native([(0xc,'@rpath/a.dylib')],('@loader_path/../Frameworks','@loader_path/../Other'),kind=2))
        r=self.inspect(); self.assertEqual(r['edges'][0]['reason'],'ambiguous-rpath')
        self.assertFalse(r['architectureClosureComplete'])

    def test_missing_target_and_bare_name_block(self):
        for value in ('@loader_path/missing.dylib','@rpath/missing.dylib','a.dylib'):
            self.replace(MAIN,native([(0xc,value)],kind=2))
            r=self.inspect(); self.assertEqual(r['unresolvedEdgeCount'],1)
            self.assertEqual(r['edges'][0]['classification'],'BLOCKED_EXTERNAL')

    def test_foreign_absolute_paths_block(self):
        for prefix in ('/opt/homebrew','/usr/local','/Users/someone','/tmp','/private/tmp','/build/DerivedData','/unknown'):
            self.replace(MAIN,native([(0xc,prefix+'/a.dylib')],kind=2))
            e=self.inspect()['edges'][0]; self.assertEqual(e['reason'],'foreign-absolute-path')

    def test_apple_candidates_require_policy_not_host_image(self):
        self.replace(MAIN,native([(0xc,'/usr/lib/libSystem.B.dylib'),(0xc,'/System/Library/Frameworks/AppKit.framework/Versions/C/AppKit')],kind=2,loader='/usr/lib/dyld'))
        r=self.inspect(); self.assertEqual(r['edgeCounts']['APPLE_SYSTEM_CANDIDATE_POLICY_REQUIRED'],3)
        self.assertTrue(r['packageInternalNativeClosureComplete']); self.assertFalse(r['externalSystemPolicyComplete'])
        self.assertTrue(all(not e['policyApproved'] and not e['runtimeProof'] for e in r['edges']))
        self.assertEqual(r['privateCPythonNativeClosureStatus'],'MISSING')

    def test_noncanonical_apple_route_not_candidate(self):
        self.replace(MAIN,native([(0xc,'/usr/lib/../../tmp/foreign')],kind=2))
        self.assertEqual(self.inspect()['edges'][0]['classification'],'BLOCKED_EXTERNAL')

    def test_wrong_architecture_and_universal_selected_slice(self):
        self.replace(MAIN,native([(0xc,'@rpath/a.dylib')],('@loader_path/../Frameworks',),kind=2))
        self.replace(LIB,native(install='@rpath/a.dylib',cpu=0x100000c))
        r=self.inspect(); self.assertFalse(r['architectureClosureComplete']); self.assertTrue(r['diagnostics'])
        self.replace(LIB,fat([(0x1000007,native(install='@rpath/a.dylib')),(0x100000c,native(install='@rpath/a.dylib',cpu=0x100000c))]))
        self.assertTrue(self.inspect()['architectureClosureComplete'])
        self.replace(MAIN,native([(0xc,'@rpath/a.dylib')],('@loader_path/../Frameworks',),kind=2,cpu=0x100000c))
        self.assertTrue(self.inspect('arm64')['architectureClosureComplete'])

    def test_install_name_mismatch_and_missing_id_block(self):
        self.replace(MAIN,native([(0xc,'@rpath/a.dylib')],('@loader_path/../Frameworks',),kind=2))
        for install in ('/foreign/wrong.dylib',None):
            self.replace(LIB,native(install=install))
            e=self.inspect()['edges'][0]; self.assertEqual(e['classification'],'BLOCKED_EXTERNAL')
            self.assertIn(e['reason'],('install-name-mismatch','missing-target-install-name'))

    def test_transitive_missing_nested_dependency_blocks_root(self):
        self.replace(LIB,native([(0xc,'@loader_path/missing.dylib')],install='@loader_path/../Frameworks/a.dylib'))
        self.replace(MAIN,native([(0xc,'@loader_path/../Frameworks/a.dylib')],kind=2))
        r=self.inspect(); self.assertFalse(r['transitiveClosureComplete'])
        self.assertEqual(r['edgeCounts']['PACKAGE_INTERNAL'],1)
        self.assertEqual(r['edgeCounts']['BLOCKED_EXTERNAL'],1)

    def test_symlink_escape_rejected(self):
        path=self.root/LIB; path.unlink(); path.symlink_to('/tmp/no-native-adoption')
        with self.assertRaisesRegex(ValueError,'symlink'): self.inspect()

    def test_changed_bytes_during_inspection_rejected(self):
        original=graph_module.package_image_routes
        def change(path,architecture):
            r=original(path,architecture)
            if Path(path)==self.root/LIB: (self.root/MAIN).write_bytes(b'changed')
            return r
        with patch.object(graph_module,'package_image_routes',side_effect=change),self.assertRaises(ValueError): self.inspect()

    def test_case_ambiguity_and_unbound_target_block(self):
        self.add('Contents/Frameworks/A.dylib',native(install='@rpath/a.dylib'))
        self.replace(MAIN,native([(0xc,'@rpath/a.dylib')],('@loader_path/../Frameworks',),kind=2))
        r=self.inspect(); self.assertFalse(r['packageInternalNativeClosureComplete']); self.assertTrue(r['diagnostics'])
        extra=self.root/'outside'; extra.write_bytes(b'not bound')
        with self.assertRaisesRegex(ValueError,'unbound'): self.inspect()

    def test_unsafe_rpath_is_not_ignored(self):
        for value in ('/opt/homebrew/lib','@loader_path/../../../foreign','/usr/lib'):
            self.replace(MAIN,native([(0xc,'@rpath/a.dylib')],('@loader_path/../Frameworks',value),kind=2))
            r=self.inspect(); self.assertFalse(r['packageInternalNativeClosureComplete'])
            self.assertTrue(any(e['rawCommand']=='LC_RPATH' for e in r['edges']))

    def test_script_interpreters_unapproved_and_env_not_searched(self):
        for interpreter in ('/bin/bash','/bin/sh','/usr/bin/env python3','/opt/homebrew/bin/bash'):
            name='Contents/Resources/Helper'
            if (self.root/name).exists(): self.replace(name,('#!'+interpreter+'\nexit 2\n').encode())
            else: self.add(name,('#!'+interpreter+'\nexit 2\n').encode(),'EXECUTABLE')
            r=self.inspect(); self.assertFalse(r['externalSystemPolicyComplete'])
            self.assertEqual(r['helperInterpreters'][0]['interpreter'],interpreter.split()[0])
            self.assertFalse(r['publicationEligible'])

    def test_missing_main_identity_blocks_executable_route(self):
        self.replace(LIB,native([(0xc,'@executable_path/../Frameworks/a.dylib')],install='@rpath/a.dylib'))
        r=self.inspect(main='missing'); self.assertFalse(r['packageInternalNativeClosureComplete'])
        self.assertEqual(r['edges'][0]['reason'],'unique-main-executable-unavailable')

    def test_typed_weak_reexport_upward_and_extension_inventory(self):
        commands=(0xc,0x80000018,0x8000001f,0x80000023)
        self.replace(MAIN,native([(c,'@rpath/a.dylib') for c in commands],('@loader_path/../Frameworks',),kind=2))
        self.add('Contents/Resources/python/lib-dynload/private.so',native([(0xc,'/usr/lib/libSystem.B.dylib')],kind=8))
        r=self.inspect(); self.assertEqual(r['edgeCounts']['PACKAGE_INTERNAL'],4)
        self.assertEqual(len({e['rawCommand'] for e in r['edges']}),4)
        self.assertEqual(len(r['images']),3)
        self.assertTrue(r['transitiveClosureComplete']); self.assertFalse(r['externalSystemPolicyComplete'])
        self.assertFalse(r['licenseMaterialComplete']); self.assertTrue(r['licenseMaterialInventory'])

    def test_cycles_preserved_without_inventing_signing_order(self):
        self.replace(LIB,native([(0xc,'@rpath/a.dylib')],('@loader_path',),install='@rpath/a.dylib'))
        r=self.inspect(); self.assertTrue(r['transitiveClosureComplete'])
        self.assertEqual(r['signingOrderCandidate']['status'],'BLOCKED_CYCLE_REVIEW_REQUIRED')
        self.assertIn(LIB,r['signingOrderCandidate']['unresolvedCycleOrDependents'])

    def test_changed_size_and_digest_not_accepted_as_existing_file(self):
        (self.root/LIB).write_bytes(b'not original')
        r=self.inspect(); self.assertFalse(r['packageFilesComplete']); self.assertTrue(r['diagnostics'])

    def test_corrupt_installed_extension_cannot_hide_in_distribution(self):
        self.add('Contents/Resources/site-packages/private.so',b'bad native bytes','PYTHON_DISTRIBUTION')
        r=self.inspect(); self.assertFalse(r['packageInternalNativeClosureComplete'])
        self.assertTrue(any(d['parent'].endswith('private.so') for d in r['diagnostics']))

    def test_missing_executable_permission_blocks_graph(self):
        (self.root/MAIN).chmod(0o644)
        r=self.inspect(); self.assertFalse(r['packageInternalNativeClosureComplete'])
        self.assertTrue(any(d['reason']=='executable-permission-missing' for d in r['diagnostics']))

    def test_install_rpath_equivalent_and_missing_target_diagnostic(self):
        self.replace(MAIN,native([(0xc,'@loader_path/../Frameworks/a.dylib')],('@loader_path/../Frameworks',),kind=2))
        r=self.inspect(); self.assertTrue(r['packageInternalNativeClosureComplete'])
        self.replace(MAIN,native([(0xc,'@loader_path/missing.dylib')],kind=2))
        e=self.inspect()['edges'][0]; self.assertEqual(e['status'],'MISSING')

    def test_private_python_image_connects_same_native_graph_without_approval(self):
        name='Contents/Resources/python/bin/python3'
        self.add(name,native([(0xc,'/usr/lib/libSystem.B.dylib')],kind=2,loader='/usr/lib/dyld'),'PYTHON_RUNTIME')
        self.nodes[-1]['id']='python-runtime'
        r=self.inspect(); self.assertEqual(r['privateCPythonNativeClosureStatus'],'UNVERIFIED')
        self.assertEqual(r['edgeCounts']['APPLE_SYSTEM_CANDIDATE_POLICY_REQUIRED'],2)
        self.assertFalse(r['actualLoaded']); self.assertFalse(r['publicationEligible'])

    def test_extension_without_suffix_requires_native_bytes(self):
        self.add('Contents/Resources/native-module', b'ordinary text', 'NATIVE_EXTENSION')
        r = self.inspect()
        self.assertFalse(r['packageFilesComplete'])
        self.assertFalse(r['packageInternalNativeClosureComplete'])
        self.assertTrue(any(d['reason'] == 'native-format-required' for d in r['diagnostics']))

    def test_extension_script_cannot_replace_native_bytes(self):
        self.add('Contents/Resources/native-module', b'#!/bin/bash\nexit 0\n', 'NATIVE_EXTENSION')
        r = self.inspect()
        self.assertFalse(r['packageFilesComplete'])
        self.assertFalse(r['architectureClosureComplete'])
        self.assertEqual(r['helperInterpreters'], [])
        self.assertTrue(any(d['reason'] == 'native-format-required' for d in r['diagnostics']))

    def test_shared_library_script_cannot_become_helper(self):
        self.add('Contents/Resources/site-packages/fake.so', b'#!/bin/sh\nexit 0\n', 'PYTHON_DISTRIBUTION')
        r = self.inspect()
        self.assertFalse(r['transitiveClosureComplete'])
        self.assertEqual(r['helperInterpreters'], [])
        self.assertTrue(any(d['reason'] == 'native-format-required' for d in r['diagnostics']))

    def test_empty_native_asset_does_not_complete_package(self):
        self.nodes.append({'id': 'missing-native', 'kind': 'NATIVE_EXTENSION', 'version': 'TEST_ONLY',
            'requires': [], 'files': [], 'artifactDigest': hashlib.sha256(canonical([])).hexdigest(),
            'evidence': 'MISSING', 'licenseStatus': 'REVIEW_REQUIRED'})
        r = self.inspect()
        self.assertFalse(r['packageFilesComplete'])
        self.assertFalse(r['packageInternalNativeClosureComplete'])
        self.assertTrue(any(d['status'] == 'MISSING' and d['assetId'] == 'missing-native'
                            for d in r['diagnostics']))
