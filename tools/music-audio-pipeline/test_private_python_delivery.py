"""Disposable routing evidence only; no private runtime/model delivery claim."""
import copy
import hashlib
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
from scoped_closure import private_distributions, verify_assembly, canonical
from test_demucs_closure import contract_fixture
from runtime_inventory import RuntimeInventory


class PrivateDistributionTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve(); self.graph = contract_fixture(self.root)

    def test_actual_private_metadata_record_without_host_lookup(self):
        with patch('importlib.metadata.distribution', side_effect=AssertionError('host lookup')):
            lookup = private_distributions(self.root, self.graph)
            self.assertEqual(lookup('package').version, '1')
            report = verify_assembly(self.root, self.graph)
        self.assertTrue(report['complete'])
        self.assertEqual(report['installedRecordInventory'][0]['fileCount'], 3)
        self.assertFalse(report['noticeRedistributionApproved'])

    def test_host_package_cannot_replace_missing_private_metadata(self):
        (self.root / 'package-1.dist-info/METADATA').unlink()
        with patch('importlib.metadata.distribution', return_value=SimpleNamespace(version='1')) as host:
            self.assertFalse(verify_assembly(self.root, self.graph)['complete'])
        host.assert_not_called()

    def test_ambiguous_dist_info_never_selects_first_match(self):
        node = self.graph['nodes'][2]
        node['files'].append(dict(node['files'][1], path='other.dist-info/METADATA'))
        node['artifactDigest'] = hashlib.sha256(canonical(sorted(node['files'], key=lambda f:f['path']))).hexdigest()
        with self.assertRaisesRegex(ValueError, 'ambiguous-private-distribution'):
            private_distributions(self.root, self.graph)

    def test_private_record_tamper_blocks_default_production_lookup(self):
        (self.root / 'package-1.dist-info/RECORD').write_text('unexpected.py,,\n')
        self.assertFalse(verify_assembly(self.root, self.graph)['complete'])


class PrivatePythonRoutingTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve(); self.graph = contract_fixture(self.root)
        node = self.graph['nodes'][1]; node['version'] = '3.11.17'
        node['files'] = []
        for name in ('python', 'lib/os.py', 'lib/encodings/__init__.py', 'lib/json/__init__.py', 'lib/sysconfig.py'):
            path = self.root / name; path.parent.mkdir(parents=True, exist_ok=True); path.write_bytes(b'fixture')
            node['files'].append({'path':name,'digest':hashlib.sha256(b'fixture').hexdigest(),'byteLength':7})
        node['artifactDigest'] = hashlib.sha256(canonical(sorted(node['files'], key=lambda f:f['path']))).hexdigest()
        source=self.graph['nodes'][0];(self.root/'server.py').write_bytes(b'fixture')
        source['files'].append({'path':'server.py','digest':hashlib.sha256(b'fixture').hexdigest(),'byteLength':7})
        source['artifactDigest']=hashlib.sha256(canonical(sorted(source['files'],key=lambda f:f['path']))).hexdigest()
        self.runtime = object.__new__(RuntimeInventory)
        self.runtime.root = self.root
        self.runtime.bindings = {'native':[{'id':'python-runtime','path':'python','version':'3.11.17'}]}
        self.runtime.resolve_executable = lambda *args: str(self.root / 'python')
        self.runtime.stamps = {}; self.runtime.recheck = lambda:None
        self.state = SimpleNamespace(executable=str(self.root/'python'), implementation=SimpleNamespace(name='cpython'),
            version_info=(3,11,17), version='3.11.17 fixture', flags=SimpleNamespace(isolated=1,no_site=1),
            modules={},path=['foreign-host-site'])

    def activate(self, *, complete=True):
        with patch('runtime_inventory.sys', self.state), patch('sysconfig.get_path',return_value=str(self.root/'lib')), \
             patch('scoped_closure.verify_assembly',return_value={'complete':complete,'installedRecordInventory':[]}):
            return self.runtime.activate_private_python(self.graph, self.root)

    def test_routes_only_anchored_stdlib_and_private_package_root(self):
        # Mock CPU/executable here; this test cannot prove a real CPython build.
        result = self.activate()
        self.assertEqual(self.state.path,[str(self.root),str(self.root/'lib')])
        self.assertEqual(result['stdlibArtifactDigest'],self.graph['nodes'][1]['artifactDigest'])
        self.assertFalse(result['productionReady'])
        self.assertEqual(len(self.runtime.stamps),sum(len(n['files']) for n in self.graph['nodes']))

    def test_missing_stdlib_wrong_version_and_site_startup_fail_before_path_write(self):
        for key,value in [('version','3.12.0 fixture'),('flags',SimpleNamespace(isolated=1,no_site=0))]:
            original=getattr(self.state,key);setattr(self.state,key,value)
            with self.assertRaises(ValueError): self.activate()
            self.assertEqual(self.state.path,['foreign-host-site']);setattr(self.state,key,original)
        node=self.graph['nodes'][1];node['files']=node['files'][:1]
        node['artifactDigest']=hashlib.sha256(canonical(node['files'])).hexdigest()
        with self.assertRaisesRegex(ValueError,'missing-private-stdlib'):self.activate()
        self.assertEqual(self.state.path,['foreign-host-site'])

    def test_foreign_preloaded_module_and_incomplete_assembly_block(self):
        self.state.modules={'foreign':SimpleNamespace(__file__='/outside/foreign.py')}
        with self.assertRaisesRegex(ValueError,'foreign-preloaded'): self.activate()
        self.state.modules={}
        with self.assertRaisesRegex(ValueError,'assembly-incomplete'):self.activate(complete=False)
        self.assertEqual(self.state.path,['foreign-host-site'])

    def test_foreign_stdlib_never_rewrites_import_path(self):
        with patch('runtime_inventory.sys',self.state), patch('sysconfig.get_path',return_value='/outside/lib'):
            with self.assertRaisesRegex(ValueError,'foreign-private-stdlib'):
                self.runtime.activate_private_python(self.graph,self.root)
        self.assertEqual(self.state.path,['foreign-host-site'])
