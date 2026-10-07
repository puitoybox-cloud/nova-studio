"""Disposable routing evidence only; no private runtime/model delivery claim."""
import copy
import hashlib
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
from scoped_closure import private_distribution_lookup, verify_assembly, canonical, private_runtime_preflight
import test_private_runtime_delivery as runtime_delivery_tests
from test_demucs_closure import contract_fixture
from runtime_inventory import RuntimeInventory


class PrivateDistributionTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve(); self.graph = contract_fixture(self.root)

    def test_actual_private_metadata_record_without_host_lookup(self):
        with patch('importlib.metadata.distribution', side_effect=AssertionError('host lookup')):
            lookup = private_distribution_lookup(self.root, self.graph, authenticate=False)
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
            private_distribution_lookup(self.root, self.graph, authenticate=False)

    def test_private_record_tamper_blocks_default_production_lookup(self):
        (self.root / 'package-1.dist-info/RECORD').write_text('unexpected.py,,\n')
        self.assertFalse(verify_assembly(self.root, self.graph)['complete'])


class PrivatePythonRoutingTests(unittest.TestCase):
    def setUp(self):
        fixture = runtime_delivery_tests.PrivateRuntimeDeliveryTests(); fixture.setUp()
        self.addCleanup(fixture.doCleanups)
        self.fixture = fixture; self.root = fixture.root; self.graph = fixture.graph
        self.runtime = fixture.runtime
        self.runtime.manifest = {'models':[], 'dependencies':[], 'assets':[]}
        self.runtime.bindings.update(models=[], dependencies=[], assets=[])
        from scoped_closure import private_python_layout
        self.layout = private_python_layout(self.runtime,self.graph)
        self.state = SimpleNamespace(executable=self.layout['executable'],
            implementation=SimpleNamespace(name='cpython'), version_info=(3,11,0),
            version='3.11.0 fixture', flags=SimpleNamespace(isolated=1,no_site=1),
            _stdlib_dir=self.layout['stdlib'], modules={},
            path=[str(self.root)]+self.layout['paths'])

    def activate(self, *, complete=True, configure_path=False):
        with patch.dict(__import__('sys').modules, {'sys':self.state}), \
             patch('scoped_closure.private_process_origin',return_value={'status':'UNVERIFIED','source':'TEST_ONLY'}), \
             patch('scoped_closure.verify_assembly',return_value={'complete':complete,'installedRecordInventory':[]}):
            private_runtime_preflight(self.runtime,self.graph,self.root,configure_path=configure_path)
            return self.runtime.private_python

    def test_routes_only_anchored_stdlib_and_private_package_root(self):
        before=list(self.state.path)
        self.state.path=['foreign-host-site']
        result=self.activate(configure_path=True)
        self.assertEqual(self.state.path,before)
        self.assertEqual(result['stdlibArtifactDigest'],self.graph['nodes'][1]['artifactDigest'])
        self.assertFalse(result['productionReady'])
        self.assertEqual(len(self.runtime.stamps),sum(len(n['files']) for n in self.graph['nodes']))
        self.state.path.append('/foreign-host-site')
        with self.assertRaises(ValueError): self.activate()

    def test_missing_stdlib_wrong_version_and_site_startup_fail_before_path_write(self):
        before=list(self.state.path)
        for key,value in [('version','3.12.0 fixture'),('flags',SimpleNamespace(isolated=1,no_site=0)),
                          ('implementation',SimpleNamespace(name='pypy'))]:
            original=getattr(self.state,key);setattr(self.state,key,value)
            with self.assertRaises(ValueError): self.activate()
            self.assertEqual(self.state.path,before);setattr(self.state,key,original)
        node=self.graph['nodes'][1];node['files']=node['files'][:1]
        node['artifactDigest']=hashlib.sha256(canonical(node['files'])).hexdigest()
        with self.assertRaisesRegex(ValueError,'missing-or-ambiguous-private-stdlib'):self.activate()
        self.assertEqual(self.state.path,before)

    def test_foreign_preloaded_module_and_incomplete_assembly_block(self):
        before=list(self.state.path)
        self.state.modules={'foreign':SimpleNamespace(__file__='/outside/foreign.py')}
        with self.assertRaisesRegex(ValueError,'foreign-preloaded'): self.activate()
        self.state.modules={}
        with self.assertRaisesRegex(ValueError,'unapproved-private-runtime-assembly'):self.activate(complete=False)
        self.assertEqual(self.state.path,before)

    def test_foreign_stdlib_never_rewrites_import_path(self):
        before=list(self.state.path);self.state._stdlib_dir='/outside/lib'
        with self.assertRaisesRegex(ValueError,'wrong-private-runtime-startup'):self.activate()
        self.assertEqual(self.state.path,before)
