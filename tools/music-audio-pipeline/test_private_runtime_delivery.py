"""Disposable startup/metadata tests; never approved runtime/model acceptance."""
import copy
import hashlib
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
import scoped_closure as closure
from test_demucs_closure import contract_fixture


class PrivateRuntimeDeliveryTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.root=Path(self.temp.name).resolve();self.graph=contract_fixture(self.root)
        self.node=self.graph['nodes'][1];self.node.update(id='python-runtime',version='3.11.0')
        for node in self.graph['nodes']:
            node['requires']=['python-runtime' if v=='python_runtime' else v for v in node['requires']]
        self.graph['roots']=['python-runtime' if v=='python_runtime' else v for v in self.graph['roots']]
        self.node['files']=[]
        for name in ['runtime/bin/python','runtime/lib/python3.11/os.py','runtime/lib/python3.11/encodings/__init__.py','runtime/lib/python3.11/encodings/utf_8.py','runtime/lib/python3.11/lib-dynload/fixture.so']:
            self.add_file(name,b'fixture')
        self.refresh()
        self.worker=self.root/'server.py';self.worker.write_bytes(b'raise RuntimeError("worker-must-not-run")')
        raw=self.worker.read_bytes()
        self.expected={'digest':hashlib.sha256(raw).hexdigest(),'byteLength':len(raw)}
        self.runtime=SimpleNamespace(root=self.root,bindings={'native':[{'id':'python-runtime','version':'3.11.0','path':'runtime/bin/python'}]},
            resolve_executable=lambda identity,path:str(path),expected=lambda kind,identity:self.expected,stamps={},recheck=lambda:None)

    def add_file(self,name,raw):
        path=self.root/name;path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(raw)
        self.node['files'].append({'path':name,'digest':hashlib.sha256(raw).hexdigest(),'byteLength':len(raw)})

    def refresh(self):
        self.node['artifactDigest']=hashlib.sha256(closure.canonical(sorted(self.node['files'],key=lambda f:f['path']))).hexdigest()

    def test_layout_binds_stdlib_package_roots_and_actual_executable(self):
        layout=closure.private_python_layout(self.runtime,self.graph)
        self.assertEqual(layout['executable'],str(self.root/'runtime/bin/python'))
        self.assertEqual(layout['paths'],[str(self.root/'runtime/lib/python3.11'),str(self.root/'runtime/lib/python3.11/lib-dynload'),str(self.root)])
        self.assertNotIn(str(Path(sys.executable).parent),layout['paths'])

    def test_missing_ambiguous_stdlib_and_bootstrap_fail_closed(self):
        for mode in ['missing','ambiguous','encoding']:
            with self.subTest(mode=mode):
                old=copy.deepcopy(self.node['files'])
                if mode=='missing':self.node['files']=[f for f in old if not f['path'].endswith('/os.py')]
                elif mode=='ambiguous':self.add_file('other/os.py',b'fixture')
                else:self.node['files']=[f for f in old if not f['path'].endswith('/utf_8.py')]
                self.refresh()
                with self.assertRaises(ValueError):closure.private_python_layout(self.runtime,self.graph)
                self.node['files']=old;self.refresh()

    def test_stale_runtime_and_missing_executable_not_available(self):
        (self.root/'runtime/lib/python3.11/os.py').write_bytes(b'changed')
        with self.assertRaises(ValueError):closure.private_python_layout(self.runtime,self.graph)
        (self.root/'runtime/lib/python3.11/os.py').write_bytes(b'fixture')
        (self.root/'runtime/bin/python').unlink()
        with self.assertRaises((ValueError,OSError)):closure.private_python_layout(self.runtime,self.graph)

    def test_wrong_runtime_version_and_graph_binding_rejected(self):
        for field,value in [('version','3.12.0'),('path','unapproved/python')]:
            with self.subTest(field=field):
                old=self.runtime.bindings['native'][0][field];self.runtime.bindings['native'][0][field]=value
                with self.assertRaises(ValueError):closure.private_python_layout(self.runtime,self.graph)
                self.runtime.bindings['native'][0][field]=old

    def test_metadata_lookup_is_exact_and_never_uses_ambient_distribution(self):
        with patch('importlib.metadata.distribution',side_effect=AssertionError('ambient')):
            lookup=closure.private_distribution_lookup(self.root,self.graph)
            installed=lookup('PACKAGE');self.assertEqual(installed.version,'1')
            self.assertEqual(Path(installed.locate_file('2.bin')),self.root/'2.bin')
            with self.assertRaises(closure.importlib.metadata.PackageNotFoundError):lookup('undeclared')
            self.assertTrue(closure.verify_assembly(self.root,self.graph,lookup)['complete'])

    def test_actual_record_mutation_blocks_layout(self):
        (self.root/'package-1.dist-info/RECORD').write_bytes(b'tampered')
        with self.assertRaises(ValueError):closure.private_python_layout(self.runtime,self.graph)

    def test_command_is_isolated_no_site_and_has_no_ambient_paths(self):
        command=closure.private_python_command(self.runtime,self.graph,self.worker,['bound'])
        self.assertEqual(command[:5],[str(self.root/'runtime/bin/python'),'-I','-S','-B','-c'])
        self.assertIn('sys.path[:] = ',command[5]);self.assertIn('sys.argv = ',command[5])
        self.assertIn('encodings',repr(self.node));self.assertNotIn('site.main',command[5])
        for name in ['unapproved.py','server.py']:
            path=self.root/name;path.write_bytes(b'tampered')
            with self.assertRaises(ValueError):closure.private_python_command(self.runtime,self.graph,path)

    def test_actual_isolated_popen_rejects_foreign_interpreter_before_worker(self):
        command=closure.private_python_command(self.runtime,self.graph,self.worker)
        result=subprocess.run([sys.executable]+command[1:],capture_output=True,timeout=5)
        self.assertNotEqual(result.returncode,0)
        self.assertIn(b'private-python-identity',result.stderr)
        self.assertNotIn(b'worker-must-not-run',result.stderr)

    def test_independent_helper_preflight_rejects_ambient_site(self):
        with self.assertRaisesRegex(ValueError,'wrong-private-runtime-startup'):
            closure.private_runtime_preflight(self.runtime,self.graph,self.root)

    def test_independent_preflight_preserves_license_gate(self):
        layout=closure.private_python_layout(self.runtime,self.graph)
        fake=SimpleNamespace(version='3.11.0 fixture',executable=layout['executable'],_stdlib_dir=layout['stdlib'],
            flags=SimpleNamespace(isolated=1,no_site=1),path=[str(self.root)]+layout['paths'])
        runtime=copy.copy(self.runtime);runtime.manifest={'models':[],'dependencies':[],'assets':[]};runtime.bindings=dict(runtime.bindings,models=[],dependencies=[],assets=[])
        with patch.dict(sys.modules,{'sys':fake}):
            self.assertTrue(callable(closure.private_runtime_preflight(runtime,self.graph,self.root)))
            self.assertEqual(runtime.private_python['stdlibArtifactDigest'],self.node['artifactDigest'])
            self.assertEqual(runtime.private_python['installedRecordInventory'][0]['fileCount'],3)
            self.assertFalse(runtime.private_python['productionReady'])
            self.graph['nodes'][4]['licenseStatus']='REVIEW_REQUIRED'
            with self.assertRaisesRegex(ValueError,'unapproved-private-runtime-assembly'):
                closure.private_runtime_preflight(runtime,self.graph,self.root)


    def test_startup_body_uses_source_instead_of_timestamp_matched_foreign_pyc(self):
        # Deliberately spoof identity only in this disposable TEST_ONLY subprocess
        # to exercise the startup body. This is not private runtime acceptance.
        import py_compile, os
        module=self.root/'shadow_module.py';module.write_text("VALUE='foreign'\n")
        py_compile.compile(str(module),doraise=True)
        before=module.stat();module.write_text("VALUE='source!'\n")
        os.utime(module,ns=(before.st_atime_ns,before.st_mtime_ns))
        self.worker.write_bytes(b"import shadow_module\nassert shadow_module.VALUE=='source!'\nassert __file__==sys.argv[0]\nassert sys.modules['__main__'].__dict__ is globals()\nassert sys.flags.isolated and sys.flags.no_site\nprint('SOURCE_ONLY_STARTUP_BODY')\n")
        raw=self.worker.read_bytes();self.expected.update(digest=hashlib.sha256(raw).hexdigest(),byteLength=len(raw))
        command=closure.private_python_command(self.runtime,self.graph,self.worker)
        layout=closure.private_python_layout(self.runtime,self.graph)
        prefix='import sys;sys.version='+repr(layout['version'])+';sys.executable='+repr(layout['executable'])+';sys._stdlib_dir='+repr(layout['stdlib'])+'\n'
        result=subprocess.run([sys.executable]+command[1:5]+[prefix+command[5]],capture_output=True,timeout=5)
        self.assertEqual(result.returncode,0,result.stderr)
        self.assertEqual(result.stdout,b'SOURCE_ONLY_STARTUP_BODY\n')

    def test_worker_symlink_is_not_an_approved_source(self):
        other=self.root/'other.py';other.write_bytes(self.worker.read_bytes());self.worker.unlink();self.worker.symlink_to(other)
        with self.assertRaisesRegex(ValueError,'unsafe-private-worker'):
            closure.private_python_command(self.runtime,self.graph,self.worker)

    def test_startup_command_has_bounded_size(self):
        self.worker.write_bytes(b'#'+b'a'*130000+b'\n')
        raw=self.worker.read_bytes();self.expected.update(digest=hashlib.sha256(raw).hexdigest(),byteLength=len(raw))
        with self.assertRaisesRegex(ValueError,'private-startup-command-budget'):
            closure.private_python_command(self.runtime,self.graph,self.worker)


    def test_existing_inventory_binds_startup_and_clears_it_on_stale_bytes(self):
        from test_runtime_inventory import RuntimeTests
        fixture=RuntimeTests();fixture.setUp();self.addCleanup(fixture.doCleanups)
        runtime=fixture.runtime
        runtime.verify('models','m','model')
        runtime.private_python={'stdlibArtifactDigest':'a'*64,'installedRecordInventory':[{'id':'fixture'}],
                                'selection':'ANCHORED_PRIVATE_STARTUP','productionReady':False}
        snapshot=runtime.snapshot()
        self.assertEqual(snapshot['privatePython']['stdlibArtifactDigest'],'a'*64)
        snapshot['privatePython']['installedRecordInventory'][0]['id']='foreign'
        self.assertEqual(runtime.private_python['installedRecordInventory'][0]['id'],'fixture')
        fixture.root.joinpath('model').write_bytes(b'other')
        self.assertEqual(runtime.snapshot()['status'],'BLOCKED')
        self.assertIsNone(runtime.private_python)


if __name__=='__main__':unittest.main()
