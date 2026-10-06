"""Offline negative fixtures; no native isolation or real ML acceptance claim."""
import copy
import hashlib
import io
import importlib.machinery
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
from artifact_verification import ArtifactVerifier, ALGORITHM, Cancelled, CHUNK_BYTES
from runtime_evidence import observe, validate, upgrade, decode_soundfile, ScopedImportGuard, assembly_evidence
from runtime_evidence import VerifiedSourceLoader, load as load_evidence, receipt_evidence


def entry(root, name, raw=b'fixture', module=None):
    Path(root, name).write_bytes(raw)
    return {'id': name, 'path': name, 'digest': hashlib.sha256(raw).hexdigest(),
            'byteLength': len(raw), 'version': '1', 'module': module}


class ArtifactTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(); self.root = Path(self.tmp.name)
        self.e = entry(self.root, 'model'); self.v = ArtifactVerifier()
    def tearDown(self):
        self.tmp.cleanup()
    def verify(self, **kwargs):
        return self.v.verify(self.root, 'model', self.e, build='build', **kwargs)
    def test_cache_miss_correct_hit(self):
        self.assertEqual(self.verify()['cache'], 'MISS')
        self.assertEqual(self.verify()['cache'], 'HIT')
    def test_large_stream_correct_digest(self):
        # Real >64 MiB file; one bounded chunk at a time, no whole artifact buffer.
        value = hashlib.sha256(); chunk = b'x' * CHUNK_BYTES
        with (self.root/'model').open('wb') as stream:
            for _ in range(1025):
                stream.write(chunk); value.update(chunk)
        self.e.update(digest=value.hexdigest(), byteLength=1025*CHUNK_BYTES)
        self.assertEqual(self.verify()['status'], 'VERIFIED_ARTIFACT')
        self.assertEqual(self.verify()['cache'], 'HIT')
    def test_wrong_digest_and_retry(self):
        expected = self.e['digest']; self.e['digest'] = '0'*64
        with self.assertRaises(ValueError): self.verify()
        self.e['digest'] = expected; self.assertEqual(self.verify()['cache'], 'MISS')
    def test_wrong_size_and_maximum(self):
        self.e['byteLength'] += 1
        with self.assertRaises(ValueError): self.verify()
        self.e['byteLength'] -= 1
        with self.assertRaises(ValueError): self.verify(maximum=1)
    def test_artifact_changed_after_cache_same_size_restored_mtime(self):
        self.verify(); before = (self.root/'model').stat()
        (self.root/'model').write_bytes(b'changed')
        os.utime(self.root/'model', ns=(before.st_atime_ns, before.st_mtime_ns))
        with self.assertRaises(ValueError): self.verify()
    def test_expected_digest_size_build_version_identity_changes(self):
        self.verify()
        for name, value in [('build', 'new'), ('version', 'new'), ('identity', 'new')]:
            with self.subTest(name=name):
                args = {'build': 'build', name: value}
                self.assertEqual(self.v.verify(self.root, 'model', self.e, **args)['cache'], 'MISS')
        self.e['digest'] = '0'*64
        with self.assertRaises(ValueError): self.verify()
        self.e['byteLength'] = 1
        with self.assertRaises(ValueError): self.verify()
    def test_algorithm_version_change_never_hits(self):
        self.verify()
        with self.assertRaises(ValueError): self.verify(algorithm='sha256-stream-v2')
    def test_corrupt_partial_and_stale_cache(self):
        self.verify(); key = next(iter(self.v._cache))
        for corrupt in [None, (), ('partial',), ((0,0,0,0,0),'0'*64)]:
            self.v._cache[key] = corrupt
            self.assertEqual(self.verify()['cache'], 'MISS')
        self.v._cache.clear()
        self.assertEqual(self.verify()['cache'], 'MISS')
    def test_new_process_instance_never_trusts_disk_or_copied_cache(self):
        self.verify(); other = ArtifactVerifier(); other._cache = copy.deepcopy(self.v._cache)
        self.assertEqual(other.verify(self.root, 'model', self.e, build='build')['cache'], 'MISS')
    def test_abort_cancel_cleanup_and_retry(self):
        for reason in ['Abort', 'Cancel']:
            with self.subTest(reason=reason):
                state = {'n': 0}; streams = []
                def opener(path):
                    stream = path.open('rb'); streams.append(stream); return stream
                def cancel():
                    state['n'] += 1; return state['n'] >= 2
                self.v._cache.clear()
                with self.assertRaises(Cancelled): self.verify(cancel=cancel, opener=opener)
                self.assertTrue(streams[0].closed)
                self.assertEqual(self.verify()['cache'], 'MISS')
    def test_reader_failure_cleanup_no_partial_receipt_retry(self):
        streams=[]
        class Broken:
            def __init__(self, path): self.file=path.open('rb'); streams.append(self)
            def fileno(self): return self.file.fileno()
            def __enter__(self): return self
            def __exit__(self, *args): self.file.close()
            def read(self, count): raise OSError('fixture read failure')
        with self.assertRaises(OSError): self.verify(opener=Broken)
        self.assertTrue(streams[0].file.closed); self.assertFalse(self.v._cache)
        self.assertEqual(self.verify()['cache'], 'MISS')
    def test_replacement_during_read(self):
        class Replace:
            def __init__(self, path): self.file=path.open('rb'); self.path=path
            def fileno(self): return self.file.fileno()
            def __enter__(self): return self
            def __exit__(self,*args): self.file.close()
            def read(self, n):
                data=self.file.read(n)
                if data: self.path.write_bytes(b'changed')
                return data
        with self.assertRaises(ValueError): self.verify(opener=Replace)
    def test_symlink_ancestor_and_missing(self):
        (self.root/'link').symlink_to(self.root, target_is_directory=True)
        with self.assertRaises(ValueError): self.v.verify(self.root,'link/model',self.e)
        with self.assertRaises(FileNotFoundError): self.v.verify(self.root,'missing',self.e)


class NativeDynamicTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(); self.root=Path(self.tmp.name)
        imp=entry(self.root,'soundfile.py',module='soundfile')
        native=entry(self.root,'codec.so',module='soundfile._codec')
        native.update(kind='EXTENSION',footprintComplete=False)
        self.c={'version':1,'buildRevision':'build','architecture':'fixture','namespaces':['soundfile'],
                'imports':[imp,dict(native, id='codec-import')], 'native':[native],
                'codec':{'backend':'soundfile','version':'1','nativeIds':['codec.so'],'externalExecutable':False}}
        self.c['imports'][1].pop('kind'); self.c['imports'][1].pop('footprintComplete')
        self.modules={'soundfile':SimpleNamespace(__file__=str(self.root/'soundfile.py'),__version__='1'),
                      'soundfile._codec':SimpleNamespace(__file__=str(self.root/'codec.so'),
                        __spec__=SimpleNamespace(origin=str(self.root/'codec.so'),
                        loader=importlib.machinery.ExtensionFileLoader('soundfile._codec',str(self.root/'codec.so'))))}
    def tearDown(self): self.tmp.cleanup()
    def observe(self): return observe(self.root,self.c,self.modules,build='build',architecture='fixture',verifier=ArtifactVerifier())
    def test_complete_scoped_native_and_dynamic_fixture_not_network(self):
        e=self.observe(); self.assertTrue(e['nativeClosure']['complete']); self.assertTrue(e['dynamicImports']['complete'])
        self.assertTrue(e['codec']['complete']); self.assertFalse(e['complete']); self.assertFalse(e['publicationEligible'])
        self.assertEqual(e['nativeClosure']['entries'][0]['artifactStatus'],'VERIFIED_ENTRY')
        self.assertEqual(e['network']['native'],'UNVERIFIED')
    def test_missing_native_extension(self):
        (self.root/'codec.so').unlink(); e=self.observe()
        self.assertFalse(e['nativeClosure']['complete']); self.assertEqual(e['nativeClosure']['entries'][0]['status'],'MISSING')
    def test_wrong_native_digest(self):
        (self.root/'codec.so').write_bytes(b'changed'); self.assertFalse(self.observe()['nativeClosure']['complete'])
    def test_wrong_dylib_is_not_loaded_evidence(self):
        self.c['native'][0].update(kind='SHARED_LIBRARY',module=None)
        e=self.observe(); self.assertEqual(e['nativeClosure']['entries'][0]['status'],'VERIFIED_ENTRY'); self.assertFalse(e['nativeClosure']['complete'])
        self.c['native'][0]['digest']='0'*64; self.assertEqual(self.observe()['nativeClosure']['entries'][0]['status'],'UNVERIFIED')
    def test_unexpected_native_dependency(self):
        self.modules['soundfile.unexpected_native']=SimpleNamespace(__file__='system.so')
        self.assertFalse(self.observe()['dynamicImports']['complete'])
    def test_missing_dynamic_import(self):
        self.modules.pop('soundfile._codec'); self.assertFalse(self.observe()['dynamicImports']['complete'])
    def test_runtime_observed_source_mismatch(self):
        self.modules['soundfile'].__file__=str(self.root/'codec.so')
        self.assertFalse(self.observe()['dynamicImports']['complete'])
    def test_wrong_codec_version_and_artifact(self):
        self.modules['soundfile'].__version__='wrong'; self.assertFalse(self.observe()['codec']['complete'])
        self.modules['soundfile'].__version__='1'; self.c['native'][0]['digest']='0'*64
        self.assertFalse(self.observe()['codec']['complete'])
    def test_unexpected_codec_executable_system_fallback(self):
        for key,value in [('externalExecutable',True),('backend','system'),('backend','ffmpeg')]:
            c=copy.deepcopy(self.c); c['codec'][key]=value
            with self.assertRaises(ValueError): validate(c)
    def test_wrong_architecture_build(self):
        for key,value in [('architecture','wrong'),('buildRevision','wrong')]:
            self.c[key]=value
            with self.assertRaises(ValueError): self.observe()
            self.c[key]='fixture' if key=='architecture' else 'build'
    def test_inventory_upgrade_missing_evidence_never_publishes(self):
        p={'complete':True,'status':'VERIFIED','processingEligible':True,'publicationEligible':True}
        for evidence in [None,self.observe()]:
            actual=upgrade(p,evidence); self.assertTrue(actual['identityComplete']); self.assertFalse(actual['complete'])
            self.assertFalse(actual['processingEligible']); self.assertFalse(actual['publicationEligible'])
    def test_import_guard_expected_wrong_missing_unexpected(self):
        guard=ScopedImportGuard(self.root,self.c,ArtifactVerifier())
        spec=SimpleNamespace(origin=str(self.root/'soundfile.py'))
        with patch('runtime_evidence.importlib.machinery.PathFinder.find_spec',return_value=spec):
            self.assertIs(guard.find_spec('soundfile'),spec)
        for actual in [None,SimpleNamespace(origin='system.so')]:
            with patch('runtime_evidence.importlib.machinery.PathFinder.find_spec',return_value=actual):
                with self.assertRaises(ImportError): guard.find_spec('soundfile')
        with self.assertRaises(ImportError): guard.find_spec('soundfile.plugin')
        self.assertIsNone(guard.find_spec('outside_scope'))
    def test_dynamic_source_exec_authenticates_bytes_and_rejects_late_change(self):
        e=entry(self.root,'lazy.py',b'value=42\n',module='soundfile.lazy')
        module=SimpleNamespace()
        loader=VerifiedSourceLoader(self.root/'lazy.py',e);loader.exec_module(module)
        self.assertEqual(module.value,42)
        (self.root/'lazy.py').write_bytes(b'value=99\n')
        with self.assertRaises(ImportError):loader.exec_module(SimpleNamespace())
    def test_native_metadata_expected_missing_levels_never_complete(self):
        self.modules.pop('soundfile._codec'); e=self.observe()
        self.assertEqual(e['nativeClosure']['entries'][0]['status'],'EXPECTED_ONLY')
        self.assertFalse(e['nativeClosure']['complete'])
    def test_python_wrapper_cannot_impersonate_loaded_native_library(self):
        self.modules['soundfile._codec'].__spec__.loader=object()
        e=self.observe();self.assertEqual(e['nativeClosure']['entries'][0]['status'],'OBSERVED_METADATA_ONLY')
        self.assertFalse(e['nativeClosure']['complete'])
    def test_report_no_absolute_install_path(self):
        self.assertNotIn(str(self.root),json.dumps(self.observe()))
    def test_bounded_child_summary_binds_every_observed_entry(self):
        e=self.observe();e['dynamicImports']['entries']*=4096
        first=receipt_evidence(e)
        self.assertEqual(first['dynamicImports']['entryCount'],8192)
        self.assertLess(len(json.dumps(first)),4096)
        e['dynamicImports']['entries'][-1]['digest']='0'*64
        self.assertNotEqual(receipt_evidence(e)['dynamicImports']['entriesDigest'],first['dynamicImports']['entriesDigest'])
        self.assertFalse(first['complete']);self.assertFalse(first['publicationEligible'])
    def test_assembly_requires_runtime_evidence(self):
        e=assembly_evidence(SimpleNamespace()); self.assertFalse(e['complete'])
    def test_authenticated_evidence_canonical_duplicate_size_digest_and_retry(self):
        path=self.root/'runtime-evidence.json'
        raw=json.dumps(self.c,sort_keys=True,separators=(',',':')).encode()
        def runtime(data,digest=None):
            path.write_bytes(data)
            expected={'id':'runtime-evidence','digest':digest or hashlib.sha256(data).hexdigest(),'byteLength':len(data)}
            return SimpleNamespace(root=self.root,manifest={'buildRevision':'build'},expected=lambda kind,id:expected)
        self.assertEqual(load_evidence(runtime(raw)),self.c)
        with self.assertRaises(ValueError):load_evidence(runtime(raw,'0'*64))
        pretty=json.dumps(self.c,indent=2).encode()
        with self.assertRaises(ValueError):load_evidence(runtime(pretty))
        duplicate=raw[:-1]+b',"version":1}'
        with self.assertRaises(ValueError):load_evidence(runtime(duplicate))
        with self.assertRaises(ValueError):load_evidence(runtime(b'x'*(1024*1024+1)))
        self.assertEqual(load_evidence(runtime(raw)),self.c)
    def test_allowed_local_codec_and_remote_input(self):
        path=self.root/'input.wav'; path.write_bytes(b'fixture')
        sf=SimpleNamespace(__version__='1',read=lambda *a,**k:('fixture',22050))
        self.assertEqual(decode_soundfile(sf,path,'1'),('fixture',22050))
        for path in ['https://example.invalid/a.wav','pipe:0','tcp:host']:
            with self.assertRaises(ValueError): decode_soundfile(sf,path,'1')
        with self.assertRaises(ValueError): decode_soundfile(sf,self.root/'input.wav','wrong')


class NetworkLauncherTests(unittest.TestCase):
    def test_distribution_entry_exact_sources_runtime_and_browser_envelope(self):
        import local_distribution_entry as launcher
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder); assets={}
            for identity,relative in launcher.SOURCES.items():
                artifact=entry(root,relative); artifact.update(id=identity,revision='1'); assets[identity]=artifact
            runtime=SimpleNamespace(root=root,manifest={'helper':{'sourceDigest':assets['helper-source']['digest']}},
                bindings={'version':1,'models':[],'dependencies':[],'native':[],'assets':[]},
                expected=lambda kind,identity:assets[identity],recheck=lambda:None,
                resolve_executable=lambda identity,path:str(path))
            with patch.object(launcher,'load_manifest',return_value={'assets':list(assets.values())}),patch.object(launcher,'bootstrap',return_value=runtime),patch.object(launcher,'load_contract',return_value={}),\
                 patch.object(launcher,'verify_assembly',return_value={'complete':True}),\
                 patch('runtime_evidence.load',return_value={'buildRevision':'build'}),\
                 patch('runtime_evidence.assembly_evidence',return_value={'complete':False}):
                result=launcher.prepare(root,root/'manifest','a'*64,'build',pipeline=root)
                self.assertEqual(result['command'],[sys.executable,'-I',str(root.resolve()/'server.py')])
                self.assertEqual(result['browserEnvelope']['trust'],{'manifestDigest':'a'*64,'buildRevision':'build'})
                self.assertEqual(json.loads(result['browserEnvelope']['runtimeConfigText']),runtime.bindings)
                self.assertFalse(result['publicationEligible'])
                result['_source_preflight']()
                (root/'server.py').write_bytes(b'wrong')
                with self.assertRaisesRegex(ValueError, 'launcher-source-changed'):
                    result['_source_preflight']()
                with self.assertRaises(ValueError):launcher.prepare(root,root/'manifest','a'*64,'build',pipeline=root)
    def test_every_actual_launcher_adapter_is_rechecked_before_spawn(self):
        import local_distribution_entry as launcher
        for changed_identity, changed_relative in launcher.SOURCES.items():
            with self.subTest(source=changed_identity), tempfile.TemporaryDirectory() as folder:
                root=Path(folder); assets={}
                for identity, relative in launcher.SOURCES.items():
                    artifact=entry(root,relative); artifact.update(id=identity,revision='1'); assets[identity]=artifact
                runtime=SimpleNamespace(root=root,manifest={'helper':{'sourceDigest':assets['helper-source']['digest']}},
                    bindings={'version':1,'models':[],'dependencies':[],'native':[],'assets':[]},
                    expected=lambda kind,identity:assets[identity],recheck=lambda:None,
                    resolve_executable=lambda identity,path:str(path))
                with patch.object(launcher,'load_manifest',return_value={'assets':list(assets.values())}),\
                     patch.object(launcher,'bootstrap',return_value=runtime),\
                     patch.object(launcher,'load_contract',return_value={}),\
                     patch.object(launcher,'verify_assembly',return_value={'complete':True}),\
                     patch('runtime_evidence.load',return_value={'buildRevision':'build'}),\
                     patch('runtime_evidence.assembly_evidence',return_value={'complete':False}):
                    result=launcher.prepare(root,root/'manifest','a'*64,'build',pipeline=root)
                # Same-length change must fail on the retained prepared source generation.
                path=root/changed_relative
                path.write_bytes(b'x'*path.stat().st_size)
                from test_production_lifecycle import LifecycleTests
                fixture=LifecycleTests(); lifecycle=fixture.make()
                lifecycle.prepared['_source_preflight']=result['_source_preflight']
                with patch.object(lifecycle,'popen') as spawn:
                    with self.assertRaisesRegex(ValueError,'launcher-source-changed'):
                        lifecycle.start()
                    spawn.assert_not_called()
                self.assertEqual(lifecycle.state,'FAILED')
                self.assertTrue(lifecycle.server.closed)
                self.assertFalse(lifecycle.eligibility['processingEligible'])
    def test_prepared_source_symlink_substitution_is_rejected(self):
        import local_distribution_entry as launcher
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder); assets={}
            for identity,relative in launcher.SOURCES.items():
                artifact=entry(root,relative); artifact.update(id=identity,revision='1'); assets[identity]=artifact
            (root/'demucs_child.py').rename(root/'other.py')
            (root/'demucs_child.py').symlink_to(root/'other.py')
            runtime=SimpleNamespace(expected=lambda kind,identity:assets[identity])
            with patch.object(launcher,'load_manifest',return_value={'assets':list(assets.values())}),\
                 patch.object(launcher,'bootstrap',return_value=runtime):
                with self.assertRaisesRegex(ValueError,'unsafe-runtime-path'):
                    launcher.prepare(root,'manifest','a'*64,'build',pipeline=root)
    def test_distribution_entry_incomplete_assembly_and_stale_build(self):
        import local_distribution_entry as launcher
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder); assets={}
            for identity,relative in launcher.SOURCES.items():
                e=entry(root,relative);e.update(id=identity,revision='1');assets[identity]=e
            runtime=SimpleNamespace(root=root,expected=lambda kind,id:assets[id],
                manifest={'helper':{'sourceDigest':assets['helper-source']['digest']}})
            with patch.object(launcher,'load_manifest',return_value={'assets':list(assets.values())}),patch.object(launcher,'bootstrap',return_value=runtime),patch.object(launcher,'load_contract',return_value={}):
                with patch.object(launcher,'verify_assembly',return_value={'complete':False}):
                    with self.assertRaises(ValueError):launcher.prepare(root,'manifest','anchor','build',pipeline=root)
                with patch.object(launcher,'verify_assembly',return_value={'complete':True}),patch('runtime_evidence.load',return_value={'buildRevision':'stale'}):
                    with self.assertRaises(ValueError):launcher.prepare(root,'manifest','anchor','build',pipeline=root)
    def test_child_native_receipt_bound_and_cannot_claim_network_complete(self):
        from test_demucs_closure import receipt
        from demucs_receipt import validate_receipt
        expected,value=receipt(); expected['runtimeEvidenceDigest']='a'*64
        evidence={'contractDigest':'a'*64,'complete':False,'publicationEligible':False,'network':{'native':'UNVERIFIED'}}
        value['runtimeEvidence']=evidence
        self.assertEqual(validate_receipt(value,expected,'n'),value)
        for key,replacement in [('contractDigest','b'*64),('complete',True),('publicationEligible',True),('network',{'native':'VERIFIED'})]:
            wrong=copy.deepcopy(value);wrong['runtimeEvidence'][key]=replacement
            with self.assertRaises(ValueError):validate_receipt(wrong,expected,'n')
    def test_python_socket_urllib_subprocess_model_fetch_and_udp_blocked(self):
        source='''import socket,subprocess,urllib.request,sys
from runtime_inventory import install_offline_guard
g=install_offline_guard()
attempts=[lambda:socket.create_connection(('127.0.0.1',9)),
lambda:urllib.request.urlopen('https://example.invalid/model'),
lambda:subprocess.run(['curl','https://example.invalid']),
lambda:subprocess.run(['ffmpeg','https://example.invalid/model']),
lambda:socket.socket(socket.AF_INET,socket.SOCK_DGRAM).sendto(b'x',('127.0.0.1',9))]
for action in attempts:
 try:action()
 except (PermissionError,urllib.error.URLError):pass
 else:raise AssertionError('unexpected offline operation')
'''
        result=subprocess.run([sys.executable,'-c',source],cwd=Path(__file__).parent,capture_output=True,text=True,timeout=5)
        self.assertEqual(result.returncode,0,result.stderr)
    def test_launcher_strict_precedes_install_copy_network_browser(self):
        folder=Path(__file__).parent
        for path,operation in [(folder/'START_AUDIO_PIPELINE.command','-m pip'),
                               (folder/'mac-app/NovaMusicAudioHelper','/usr/bin/rsync')]:
            source=path.read_text(); self.assertLess(source.index('local_distribution_entry.py'),source.index(operation))
    def test_launcher_missing_trust_fails_no_download(self):
        result=subprocess.run([sys.executable,'-I',str(Path(__file__).with_name('local_distribution_entry.py'))],
                              env={'PATH':os.environ.get('PATH','')},capture_output=True,text=True,timeout=5)
        self.assertEqual(result.returncode,2); self.assertNotIn('Traceback',result.stderr)


if __name__ == '__main__': unittest.main()
