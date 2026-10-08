"""Disposable package bytes only; not real backend/model/license acceptance."""
import base64
import copy
import hashlib
import io
import csv
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
from scoped_closure import (canonical, verify_assembly, verify_distribution_metadata,
                            verify_distribution_record, manifest_assembly_binding)
from test_demucs_closure import contract_fixture, refresh_fixture_record


class InstalledRecordAssemblyTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.root=Path(self.temp.name);self.graph=contract_fixture(self.root)
        self.node=self.graph['nodes'][2];self.record='package-1.dist-info/RECORD'

    def lookup(self, name):
        return SimpleNamespace(version='1',files=[f['path'] for f in self.node['files']],locate_file=lambda p:self.root/p)

    def bind_record(self, text):
        raw=text.encode();(self.root/self.record).write_bytes(raw)
        f=next(f for f in self.node['files'] if f['path']==self.record)
        f.update(digest=hashlib.sha256(raw).hexdigest(),byteLength=len(raw))
        self.node['artifactDigest']=hashlib.sha256(canonical(sorted(self.node['files'],key=lambda f:f['path']))).hexdigest()

    def receipt(self):
        return verify_distribution_record(self.root,self.node,verify_distribution_metadata(self.root,self.node))

    def test_authentic_record_rows_are_bound_to_actual_assembly(self):
        report=verify_assembly(self.root,self.graph,self.lookup)
        self.assertTrue(report['complete']);r=report['installedRecordInventory'][0]
        self.assertEqual((r['id'],r['version'],r['fileCount']),('package','1',3))
        self.assertEqual(r['verifiedDeclaredHashes'],2);self.assertEqual(r['omittedHashes'],1)
        self.assertEqual(r['artifactDigest'],self.node['artifactDigest']);self.assertFalse(r['redistributionApproved'])

    def test_authenticated_but_internally_wrong_hash_or_size_is_blocked(self):
        original=(self.root/self.record).read_text()
        first=original.splitlines()[0].split(',')
        for row in [f'{first[0]},sha256={"A"*43},{first[2]}',f'{first[0]},{first[1]},999']:
            with self.subTest(row=row):
                self.bind_record(row+'\n'+'\n'.join(original.splitlines()[1:])+'\n')
                self.assertFalse(verify_assembly(self.root,self.graph,self.lookup)['complete'])

    def test_duplicate_alias_extra_and_missing_rows_are_rejected(self):
        original=(self.root/self.record).read_text()
        for text in [original+original.splitlines()[0]+'\n',original+'unexpected.py,,\n',
                     '\n'.join(original.splitlines()[1:])+'\n',original+'folder/../2.bin,,\n']:
            with self.subTest(text=text):
                self.bind_record(text)
                with self.assertRaises(ValueError):self.receipt()

    def test_generation_escape_protocol_absolute_and_bad_csv_are_rejected(self):
        for name in ['../escape','/outside','https://invalid/file','folder\\file','./2.bin','a//b']:
            with self.subTest(name=name):
                self.bind_record(name+',,\n')
                with self.assertRaises(ValueError):self.receipt()
        for raw in ['"unterminated,,,\n','2.bin,,extra,field\n']:
            self.bind_record(raw)
            with self.assertRaises(ValueError):self.receipt()

    def test_missing_ambiguous_or_tampered_record_is_not_accepted(self):
        for node in [dict(self.node,files=[f for f in self.node['files'] if f['path']!=self.record])]:
            with self.assertRaises(ValueError):verify_distribution_record(self.root,node,verify_distribution_metadata(self.root,node))
        (self.root/self.record).write_bytes(b'changed')
        with self.assertRaises(ValueError):self.receipt()

    def test_blank_fields_do_not_replace_external_byte_identity(self):
        self.bind_record('2.bin,,\npackage-1.dist-info/METADATA,,\n'+self.record+',,\n')
        self.assertEqual(self.receipt()['omittedHashes'],3)
        (self.root/'2.bin').write_bytes(b'changed!')
        with self.assertRaises(ValueError):self.receipt()

    def test_hash_algorithms_and_encoding_checked_without_fallback(self):
        original=(self.root/self.record).read_text();lines=original.splitlines()
        for algorithm in ['sha384','sha512']:
            encoded=base64.urlsafe_b64encode(hashlib.new(algorithm,(self.root/'2.bin').read_bytes()).digest()).rstrip(b'=').decode()
            self.bind_record(f'2.bin,{algorithm}={encoded},8\n'+'\n'.join(lines[1:])+'\n')
            self.assertEqual(self.receipt()['verifiedDeclaredHashes'],2)
        for digest in ['unknown=A','sha256=bad','sha256='+lines[0].split(',')[1].split('=')[1]+'=']:
            self.bind_record(f'2.bin,{digest},8\n'+'\n'.join(lines[1:])+'\n')
            with self.assertRaises(ValueError):self.receipt()

    def test_record_byte_and_row_budgets_are_enforced(self):
        with patch('scoped_closure.MAX_RECORD_BYTES',8):
            with self.assertRaises(ValueError):self.receipt()
        with patch('scoped_closure.MAX_FILES',2):
            with self.assertRaises(ValueError):self.receipt()

    def test_nested_site_packages_script_rows_remain_inside_private_generation(self):
        prefix='runtime/lib/python3.11/site-packages'
        for f in self.node['files']:
            old=self.root/f['path'];new=self.root/prefix/f['path'];new.parent.mkdir(parents=True,exist_ok=True);old.rename(new);f['path']=prefix+'/'+f['path']
        self.record=prefix+'/package-1.dist-info/RECORD'
        raw=(self.root/self.record).read_text();self.bind_record(raw)
        self.assertEqual(self.receipt()['fileCount'],3)
        script='runtime/bin/package';(self.root/script).parent.mkdir(parents=True);(self.root/script).write_bytes(b'fixture')
        self.node['files'].append({'path':script,'digest':hashlib.sha256(b'fixture').hexdigest(),'byteLength':7})
        self.bind_record(raw+'../../../bin/package,,7\n')
        self.assertEqual(self.receipt()['fileCount'],4)
        self.bind_record(raw+'../../../../../outside,,\n')
        with self.assertRaises(ValueError):self.receipt()

    def test_symlink_record_target_is_rejected(self):
        p=self.root/'2.bin';p.unlink();p.symlink_to(self.root/'3.bin')
        with self.assertRaises(ValueError):self.receipt()

    def test_manifest_identity_gate_rejects_version_digest_missing_binding_and_model_revision(self):
        manifest={'models':[],'dependencies':[],'assets':[]}
        bindings={'models':[],'dependencies':[],'assets':[],'native':[]}
        runtime=SimpleNamespace(manifest=manifest,bindings=bindings)
        file=self.node['files'][0]
        manifest['dependencies']=[{'id':'package','version':'1','digest':file['digest']}]
        bindings['dependencies']=[{'id':'package','path':file['path']}]
        nodes={n['id']:n for n in self.graph['nodes']}
        self.assertEqual(manifest_assembly_binding(runtime,nodes)['manifestIdentityMismatches'],[])
        for field,value in [('version','2'),('digest','f'*64)]:
            bad=copy.deepcopy(runtime);bad.manifest['dependencies'][0][field]=value
            self.assertFalse(verify_assembly(self.root,self.graph,self.lookup,runtime=bad)['complete'])
        bad=copy.deepcopy(runtime);bad.bindings['dependencies']=[]
        self.assertEqual(manifest_assembly_binding(bad,nodes)['manifestIdentityMismatches'],['package'])
        bad=copy.deepcopy(runtime);bad.manifest['assets']=[{'id':'missing','digest':'a'*64}]
        self.assertEqual(manifest_assembly_binding(bad,nodes)['missingManifestIdentities'],['missing'])
        model=nodes['model'];f=model['files'][0]
        runtime.manifest['models']=[{'id':'model','revision':'wrong','digest':f['digest'],'byteLength':f['byteLength']}]
        runtime.bindings['models']=[{'id':'model','path':f['path']}]
        self.assertEqual(manifest_assembly_binding(runtime,nodes)['manifestIdentityMismatches'],['model'])

    def test_actual_launcher_spawn_preflight_rechecks_same_anchored_assembly(self):
        import sys
        import local_distribution_entry as launcher
        from test_native_verification import entry
        assets={}
        for identity,relative in launcher.SOURCES.items():
            artifact=entry(self.root,relative);artifact.update(id=identity,revision='1');assets[identity]=artifact
        runtime=SimpleNamespace(root=self.root,manifest={'helper':{'sourceDigest':assets['helper-source']['digest']}},
            bindings={'version':1,'models':[],'dependencies':[],'native':[],'assets':[]},
            expected=lambda kind,identity:assets[identity],recheck=lambda:None,
            resolve_executable=lambda identity,path:str(path))
        with patch.object(launcher,'load_manifest',return_value={'assets':list(assets.values())}),\
             patch.object(launcher,'bootstrap',return_value=runtime),\
             patch.object(launcher,'load_contract',return_value={}),\
             patch.object(launcher,'private_distribution_lookup'),\
             patch.object(launcher,'private_python_command',return_value=[sys.executable,'-I',str(self.root/'server.py')]),\
             patch.object(launcher,'verify_assembly',side_effect=[{'complete':True}]+[{'complete':False}]*3) as assembly,\
             patch('runtime_evidence.load',return_value={'buildRevision':'build'}),\
             patch('runtime_evidence.assembly_evidence',return_value={'complete':False}):
            prepared=launcher.prepare(self.root,'manifest','a'*64,'build',pipeline=self.root)
            self.assertIs(assembly.call_args.kwargs['runtime'],runtime)
            from test_production_lifecycle import LifecycleTests
            lifecycle=LifecycleTests().make();lifecycle.prepared['_source_preflight']=prepared['_source_preflight']
            with patch.object(lifecycle,'popen') as spawn:
                with self.assertRaisesRegex(ValueError,'launcher-artifact-assembly-changed'):lifecycle.start()
                spawn.assert_not_called()
            self.assertEqual(assembly.call_count,4);self.assertEqual(lifecycle.state,'FAILED')
            self.assertEqual(lifecycle.final_receipt['payload']['completionState'],'FAILED')
            self.assertFalse(lifecycle.eligibility['processingEligible'])

    def test_offline_verifier_passes_runtime_into_same_assembly_gate(self):
        import importlib.util
        source=Path(__file__).resolve().parents[2]/'scripts/music-offline-assembly-verifier.py'
        spec=importlib.util.spec_from_file_location('record_assembly_offline',source)
        module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
        runtime=SimpleNamespace(manifest={},bindings={})
        with patch.object(module,'bootstrap',return_value=runtime),\
             patch.object(module,'load_contract',return_value=self.graph),\
             patch.object(module,'verify_assembly',return_value={'complete':True}) as assembly,\
             patch('runtime_evidence.assembly_evidence',return_value={'complete':False}):
            report=module.inspect(self.root,'manifest','a'*64,'build')
            self.assertIs(assembly.call_args.kwargs['runtime'],runtime)
            self.assertTrue(report['artifactAssemblyComplete']);self.assertFalse(report['assemblyReady'])


if __name__=='__main__':unittest.main()
