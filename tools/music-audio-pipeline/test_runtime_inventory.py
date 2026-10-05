"""Offline synthetic loader/importer/executable fixtures; never real model PASS."""
import copy
import hashlib
import json
import os
import platform
import tempfile
import types
import unittest
from pathlib import Path
from runtime_inventory import RuntimeInventory, bootstrap, legacy_snapshot

class RuntimeTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.root.joinpath('model').write_bytes(b'model')
        self.root.joinpath('module.py').write_bytes(b'package')
        self.root.joinpath('python').write_bytes(b'native')
        self.root.joinpath('python').chmod(0o700)
        def entry(identity, path, **fields):
            data=self.root.joinpath(path).read_bytes()
            return {'id':identity,'digest':hashlib.sha256(data).hexdigest(),**fields}
        self.manifest={'models':[entry('m','model',revision='r1',byteLength=5)],
            'dependencies':[entry('numpy','module.py',version='1')],
            'assets':[entry('python-runtime','python',revision='1',byteLength=6)]}
        self.bindings={'version':1,'models':[{'id':'m','path':'model','runtimeIdentifier':'basic-pitch','companions':[]}],
            'dependencies':[{'id':'numpy','module':'numpy','path':'module.py','native':[]}],
            'native':[{'id':'python-runtime','path':'python','architecture':platform.machine(),'version':'1'}], 'assets':[]}
        self.runtime=RuntimeInventory(self.root,self.manifest,self.bindings)

    def test_successful_load_retains_exact_object_and_logical_identity(self):
        obj=object(); self.assertIs(self.runtime.load_model('m',lambda p:obj),obj)
        value=self.runtime.snapshot()['models'][0]
        self.assertEqual(value['identity'],self.manifest['models'][0])
        self.assertEqual(value['source'],'model')
        self.assertNotIn(str(self.root),json.dumps(self.runtime.snapshot()))
        self.assertEqual(self.runtime.snapshot()['status'],'PARTIAL')

    def test_exists_but_failed_load_is_never_loaded_including_retry(self):
        self.runtime.load_model('m',lambda p:object())
        def fail(p):raise RuntimeError('personal path must not be reported')
        with self.assertRaisesRegex(ValueError,'model-load-or-identity-failed'):self.runtime.load_model('m',fail)
        self.assertEqual(self.runtime.snapshot()['models'],[])
        self.runtime.load_model('m',lambda p:object())
        self.assertEqual(len(self.runtime.snapshot()['models']),1)

    def test_wrong_digest_missing_unexpected_and_budget(self):
        with self.assertRaises(ValueError):self.runtime.load_model('other',lambda p:object())
        self.root.joinpath('model').write_bytes(b'wrong')
        with self.assertRaises(ValueError):self.runtime.load_model('m',lambda p:object())
        self.root.joinpath('model').unlink()
        with self.assertRaises(ValueError):self.runtime.load_model('m',lambda p:object())
        self.assertEqual(self.runtime.snapshot()['models'],[])

    def test_changed_during_load_and_stale_after_load_clear_evidence(self):
        def change(p):p.write_bytes(b'other');return object()
        with self.assertRaises(ValueError):self.runtime.load_model('m',change)
        self.root.joinpath('model').write_bytes(b'model')
        self.runtime.load_model('m',lambda p:object())
        self.root.joinpath('model').write_bytes(b'model')
        self.assertEqual(self.runtime.snapshot()['status'],'BLOCKED')
        self.assertEqual(self.runtime.loaded,{})

    def test_dependency_real_file_scope_version_location_native(self):
        b=self.bindings['dependencies'][0]
        module=types.SimpleNamespace(__file__=str(self.root/'module.py'))
        self.runtime.observe_dependency(b,lambda _:module,lambda _:'1')
        self.assertEqual(self.runtime.snapshot()['dependencies'][0]['status'],'VERIFIED_ENTRY_FILE')
        for importer,version in [(lambda _:module,lambda _:'2'),(lambda _:types.SimpleNamespace(__file__=str(self.root/'model')),lambda _:'1')]:
            with self.assertRaises(ValueError):self.runtime.observe_dependency(b,importer,version)
        b=copy.deepcopy(b);b['native']=[{'id':'python-runtime','path':'model'}]
        with self.assertRaises(ValueError):self.runtime.observe_dependency(b,lambda _:module,lambda _:'1')

    def test_executable_exact_path_architecture_and_no_path_guessing(self):
        self.runtime.resolve_executable('python-runtime',self.root/'python')
        with self.assertRaises(ValueError):self.runtime.resolve_executable('python-runtime',self.root/'module.py')
        with self.assertRaises(ValueError):self.runtime.resolve_executable('ffmpeg',self.root/'python')
        self.runtime.bindings['native'][0]['architecture']='wrong'
        with self.assertRaises(ValueError):self.runtime.resolve_executable('python-runtime',self.root/'python')

    def test_no_complete_claim_or_processing_on_metadata_partial_missing(self):
        with self.assertRaisesRegex(ValueError,'strict-runtime-inventory-incomplete'):self.runtime.require_processing()
        self.assertEqual(legacy_snapshot()['status'],'UNVERIFIED')
        self.assertIn('models:m',self.runtime.snapshot()['missing'])

    def test_unsafe_path_symlink_ancestor_and_wrong_expected_inventory(self):
        for path in ['../model','/model']:
            self.runtime.bindings['models'][0]['path']=path
            with self.assertRaises(ValueError):self.runtime.load_model('m',lambda p:object())
        self.root.joinpath('linked').symlink_to(self.root,target_is_directory=True)
        self.runtime.bindings['models'][0]['path']='linked/model'
        with self.assertRaises(ValueError):self.runtime.load_model('m',lambda p:object())
        wrong=copy.deepcopy(self.bindings);wrong['models']=[]
        with self.assertRaises(ValueError):RuntimeInventory(self.root,self.manifest,wrong)

    def test_authenticated_config_anchor_and_stale_manifest(self):
        from test_distribution_binding import DistributionBindingTests
        m,_=DistributionBindingTests().fixture()
        raw=json.dumps(self.bindings,separators=(',',':')).encode()
        self.root.joinpath('runtime-config.json').write_bytes(raw)
        m['models']=self.manifest['models'];m['dependencies']=self.manifest['dependencies']
        m['assets']=self.manifest['assets']+[{'id':'runtime-config','revision':'1','digest':hashlib.sha256(raw).hexdigest(),'byteLength':len(raw)}]
        data=json.dumps(m,sort_keys=True,separators=(',',':')).encode()
        self.root.joinpath('manifest.json').write_bytes(data);anchor=hashlib.sha256(data).hexdigest()
        result=bootstrap(self.root/'manifest.json',anchor,m['buildRevision'],self.root)
        self.assertEqual(result.snapshot()['status'],'PARTIAL')
        for digest,build in [(None,m['buildRevision']),(anchor,'stale')]:
            with self.assertRaises(ValueError):bootstrap(self.root/'manifest.json',digest,build,self.root)
        self.root.joinpath('runtime-config.json').write_bytes(b'{}')
        with self.assertRaises(ValueError):bootstrap(self.root/'manifest.json',anchor,m['buildRevision'],self.root)

    def test_offline_static_inventory_detects_local_remote_registry_and_subprocess(self):
        import importlib.util
        source=Path(__file__).resolve().parents[2]/'scripts'/'music-offline-asset-inventory.py'
        spec=importlib.util.spec_from_file_location('offline_inventory_fixture',source)
        scanner=importlib.util.module_from_spec(spec);spec.loader.exec_module(scanner)
        self.root.joinpath('app.js').write_text('fetch("https://cdn.example.invalid/a.js");')
        self.root.joinpath('helper.py').write_text('subprocess.run(command)\n# pip install sample\nget_model()')
        result=scanner.inspect(self.root,['app.js','helper.py'])
        self.assertEqual(result['liveRequests'],0)
        self.assertEqual(len(result['assets']),2)
        self.assertIn('PACKAGE_REGISTRY_INSTALL',{e['kind'] for e in result['externalReferences']})
        self.assertIn('NATIVE_OR_SUBPROCESS_REQUIREMENT',{e['kind'] for e in result['externalReferences']})
        self.assertEqual(result['externalReferences'][0]['host'],'cdn.example.invalid')
        self.assertTrue(all(e['distributionStatus']=='UNVERIFIED' for e in result['assets']))

    def test_missing_companion_inventory_and_model_budget_fail_closed(self):
        wrong=copy.deepcopy(self.bindings);wrong['native']=[]
        with self.assertRaisesRegex(ValueError,'missing-or-unexpected-local-asset'):
            RuntimeInventory(self.root,self.manifest,wrong)
        small=RuntimeInventory(self.root,self.manifest,self.bindings,max_bytes=4)
        with self.assertRaises(ValueError):small.load_model('m',lambda p:object())
        self.assertEqual(small.snapshot()['models'],[])

    def test_strict_guard_blocks_socket_and_subprocess_before_execution(self):
        import subprocess
        import sys
        code="""
from runtime_inventory import install_offline_guard
import socket, subprocess, sys
install_offline_guard()
blocked=0
for call in (lambda: socket.socket().connect(('127.0.0.1', 1)), lambda: subprocess.run([sys.executable, '-c', 'pass'])):
    try: call()
    except PermissionError: blocked+=1
assert blocked==2
"""
        subprocess.run([sys.executable,'-c',code],cwd=Path(__file__).parent,check=True,capture_output=True,timeout=5)
