"""Disposable software evidence only. No downloaded models or physical claims."""
import copy
import ctypes
import hashlib
import json
import platform
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import runtime_evidence as evidence
from runtime_inventory import OfflineRuntimeGuard
from local_distribution_entry import strict_eligibility


def fixture_inventory():
    return {'mode':'STRICT', 'status':'VERIFIED', 'complete':True, 'identityComplete':True,
        'models':[{'id':'retained-model','digest':'a'*64}], 'runtimeEvidence':{
        'codec':{'backend':'fixture','version':'1'}, 'mappedNative':{'complete':True},
        'dynamicNativeGraph':{'complete':True}, 'transitiveNativeObservation':{'complete':True},
        'nativeClosure':{'complete':True}, 'processingChain':{'complete':True},
        'network':{'native':'CONTAINED','nativeNetworkVerified':True}}}


def binding(inventory=None, request='b'*64):
    return evidence.processing_binding('a'*64,request,{'digest':'c'*64,'byteLength':7},inventory or fixture_inventory())


def complete_calls():
    return {'entries':[{'stage':stage,'status':'VERIFIED','completed':True,'fallback':False,
        'nativeIdentity':'VERIFIED'} for stage in ('decoder','resample','model','inference','stem','encoder','result')]}


class ProcessingBindingTests(unittest.TestCase):
    def make(self):
        inventory=fixture_inventory(); identity=binding(inventory)
        receipt=evidence.BoundProcessingReceipt(identity)
        receipt.add_calls(complete_calls())
        return inventory, identity, receipt
    def test_complete_contract_single_response_and_no_publication(self):
        inventory,identity,receipt=self.make()
        result=receipt.finish(identity,inventory,{'digest':'d'*64,'byteLength':10})
        self.assertTrue(result['complete']);self.assertFalse(result['publicationEligible'])
        self.assertEqual(receipt.consume(result,identity),result)
        with self.assertRaises(ValueError):receipt.consume(result,identity)
    def test_missing_every_stage_blocks(self):
        for stage in ('decoder','resample','model','inference','stem','encoder','result'):
            with self.subTest(stage=stage):
                inventory,identity,receipt=self.make();receipt.calls=[e for e in receipt.calls if e['stage']!=stage]
                result=receipt.finish(identity,inventory,{'digest':'d'*64,'byteLength':10})
                self.assertIn('stage:'+stage,result['blockedBy'])
                with self.assertRaises(ValueError):receipt.consume(result,identity)
    def test_wrong_codec_fallback_stem_writer_and_native(self):
        for stage in ('decoder','resample','encoder','stem'):
            for field,value in [('status','UNVERIFIED'),('fallback',True),('nativeIdentity','UNVERIFIED'),('completed',False)]:
                with self.subTest(stage=stage,field=field):
                    inventory,identity,receipt=self.make()
                    next(e for e in receipt.calls if e['stage']==stage)[field]=value
                    self.assertFalse(receipt.finish(identity,inventory,{'digest':'d'*64,'byteLength':10})['complete'])
    def test_resample_not_applicable_only_resample(self):
        inventory,identity,receipt=self.make()
        next(e for e in receipt.calls if e['stage']=='resample')['status']='NOT_APPLICABLE'
        self.assertTrue(receipt.finish(identity,inventory,{'digest':'d'*64,'byteLength':10})['complete'])
        inventory,identity,receipt=self.make()
        next(e for e in receipt.calls if e['stage']=='decoder')['status']='NOT_APPLICABLE'
        self.assertFalse(receipt.finish(identity,inventory,{'digest':'d'*64,'byteLength':10})['complete'])
    def test_native_missing_and_network_unknown(self):
        for field in ('dynamicNativeGraph','network'):
            inventory=fixture_inventory();inventory['runtimeEvidence'][field]={}
            identity=binding(inventory);receipt=evidence.BoundProcessingReceipt(identity);receipt.add_calls(complete_calls())
            self.assertFalse(receipt.finish(identity,inventory,{'digest':'d'*64,'byteLength':10})['complete'])
    def test_old_session_request_input_and_every_inventory_identity(self):
        for field in ('session','request','inventoryRevision','modelIdentity','codecIdentity','nativeIdentity','networkIdentity'):
            _,identity,receipt=self.make();changed=copy.deepcopy(identity);changed[field]='f'*64
            with self.subTest(field=field),self.assertRaises(ValueError):receipt.check(changed)
        mutations=[lambda i:i['models'][0].update(digest='f'*64),
            lambda i:i['runtimeEvidence']['codec'].update(version='2'),
            lambda i:i['runtimeEvidence']['mappedNative'].update(artifact='changed'),
            lambda i:i['runtimeEvidence']['network'].update(native='UNVERIFIED')]
        for mutate in mutations:
            inventory,identity,receipt=self.make();mutate(inventory)
            with self.assertRaises(ValueError):receipt.finish(identity,inventory,{'digest':'d'*64,'byteLength':10})
    def test_cache_reuse_is_not_identity_change(self):
        inventory=fixture_inventory();inventory['runtimeEvidence']['largeArtifacts']={'entries':[{'digest':'e'*64,'cache':'MISS'}]}
        identity=binding(inventory);inventory['runtimeEvidence']['largeArtifacts']['entries'][0]['cache']='HIT'
        self.assertEqual(identity,binding(inventory))
    def test_abort_cancel_timeout_and_retry_fresh_request(self):
        for reason in ('Abort','Cancel','browser-close','heartbeat-expiry','helper-replacement','server-restart'):
            _,identity,receipt=self.make();receipt.abort(reason)
            with self.subTest(reason=reason),self.assertRaises(ValueError):receipt.check(identity)
            self.assertFalse(receipt.calls);self.assertIsNone(receipt.result)
        clock=[0];receipt=evidence.BoundProcessingReceipt(binding(),timeout=1,clock=lambda:clock[0]);clock[0]=1
        with self.assertRaises(ValueError):receipt.check(binding())
        self.assertNotEqual(binding(),binding(request='f'*64))
    def test_output_tamper_response_copy_and_expiry(self):
        inventory,identity,receipt=self.make();result=receipt.finish(identity,inventory,{'digest':'d'*64,'byteLength':10})
        result['output']['digest']='e'*64
        with self.assertRaises(ValueError):receipt.consume(result,identity)
        for output in ({}, {'digest':'bad','byteLength':10}, {'digest':'d'*64,'byteLength':0}):
            inventory,identity,receipt=self.make()
            with self.assertRaises(ValueError):receipt.finish(identity,inventory,output)
    def test_child_wrong_binding_and_partial_chain(self):
        _,identity,receipt=self.make()
        child={'format':'NOVA_PROCESSING_RECEIPT','parentBinding':identity,'binding':identity,'entries':complete_calls()['entries'],'complete':True,'status':'VERIFIED',
            'nativeClosureComplete':True,'networkContainment':'CONTAINED','blockedBy':[],
            'processingEligible':True,'publicationEligible':False}
        receipt.add_child(child)
        child['complete']=False
        with self.assertRaises(ValueError):receipt.add_child(child)
        child['complete']=True
        child['binding']={**identity,'request':'f'*64}
        with self.assertRaises(ValueError):receipt.add_child(child)
    def test_binding_invalid_tokens_input_and_budget(self):
        for token in ('',None,'a'*32,'g'*64):
            with self.assertRaises(ValueError):evidence.processing_binding(token,'b'*64,{'digest':'c'*64,'byteLength':1},{})
        with self.assertRaises(ValueError):evidence.BoundProcessingReceipt({})
        with self.assertRaises(ValueError):evidence.BoundProcessingReceipt(binding(),timeout=3601)
        receipt=evidence.BoundProcessingReceipt(binding())
        with self.assertRaises(ValueError):receipt.add_calls({'entries':[{}]*257})
    def test_audio_identity_streamed_and_remote_codec_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder,'input.wav');raw=b'x'*131073;path.write_bytes(raw)
            self.assertEqual(evidence.audio_identity(path),{'digest':hashlib.sha256(raw).hexdigest(),'byteLength':len(raw)})
        for path in ('https://private.example/audio','tcp:remote','pipe:input'):
            with self.assertRaises(ValueError):evidence.audio_identity(path)


class MappedTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.root=Path(self.tmp.name)
        self.path=self.root/'fixture.so';self.path.write_bytes(b'fixture')
        self.entry={'id':'codec-native','module':None,'version':'1','path':self.path.name,
            'digest':hashlib.sha256(self.path.read_bytes()).hexdigest(),'byteLength':7,'kind':'SHARED_LIBRARY'}
        self.contract={'native':[self.entry],'architecture':platform.machine(),'buildRevision':'fixture'}
    def tearDown(self):self.tmp.cleanup()
    def observe(self,path=None,source='DLINFO_EXACT_HANDLE',architecture=None):
        with patch.object(evidence,'exact_mapped_path',return_value=(path,source)),patch.object(evidence,'native_architecture',return_value=architecture or platform.machine()):
            return evidence.mapped_native_receipts(self.root,self.contract)
    def test_expected_mapped_disk_verified_never_memory_verified(self):
        result=self.observe(self.path);entry=result['entries'][0]
        self.assertTrue(entry['mapped']);self.assertEqual(entry['diskIntegrity'],'VERIFIED')
        self.assertEqual(entry['status'],'OBSERVED_UNVERIFIED');self.assertEqual(entry['mappedIntegrity'],'UNVERIFIED')
        self.assertFalse(result['complete']);self.assertNotIn(str(self.root),json.dumps(result))
    def test_mapped_disk_unverified(self):
        self.entry['digest']='0'*64;entry=self.observe(self.path)['entries'][0]
        self.assertTrue(entry['mapped']);self.assertEqual(entry['diskIntegrity'],'UNVERIFIED');self.assertFalse(self.observe(self.path)['complete'])
    def test_wrong_mapped_artifact(self):
        entry=self.observe(self.root/'wrong.so')['entries'][0]
        self.assertEqual(entry['status'],'UNEXPECTED_OBSERVED');self.assertIsNone(entry['actualMappedArtifact'])
    def test_not_loaded_missing_and_unsupported(self):
        self.assertEqual(self.observe(None,'EXPECTED_NOT_OBSERVED')['entries'][0]['status'],'EXPECTED_NOT_OBSERVED')
        self.assertEqual(self.observe(None,'UNSUPPORTED')['entries'][0]['status'],'UNSUPPORTED')
        self.path.unlink();self.assertEqual(self.observe()['entries'][0]['status'],'MISSING')
    def test_architecture_mismatch(self):
        entry=self.observe(self.path,architecture='wrong')['entries'][0]
        self.assertEqual(entry['status'],'OBSERVED_UNVERIFIED');self.assertIn('architecture',entry['reason'])
    def test_transitive_join_present_missing_wrong_and_unsupported(self):
        for child_status,expected in [('OBSERVED_UNVERIFIED','OBSERVED_UNVERIFIED'),('MISSING','MISSING'),
                ('UNEXPECTED_OBSERVED','UNEXPECTED_OBSERVED'),('UNSUPPORTED','UNSUPPORTED')]:
            mapped=self.observe(self.path);mapped['entries'][0]['status']=child_status
            graph={'edges':[{'parent':'codec-native','child':'codec-native','status':'EXPECTED_NOT_OBSERVED'}]}
            result=evidence.runtime_native_closure(mapped,graph)
            self.assertEqual(result['edges'][0]['status'],expected);self.assertFalse(result['complete'])
        result=evidence.runtime_native_closure({'entries':[]},graph)
        self.assertEqual(result['edges'][0]['status'],'MISSING')
    def test_real_disposable_library_exact_handle_no_enumeration(self):
        source=self.root/'fixture.c';source.write_text('int nova_fixture_identity(void) { return 1; }\n')
        subprocess.run(['cc','-dynamiclib' if platform.system()=='Darwin' else '-shared','-fPIC',str(source),'-o',str(self.path)],check=True,capture_output=True)
        raw=self.path.read_bytes();self.entry.update(digest=hashlib.sha256(raw).hexdigest(),byteLength=len(raw))
        self.contract['mappedSymbols']={'codec-native':'nova_fixture_identity'}
        actual,origin=evidence.exact_mapped_path(self.path,'nova_fixture_identity')
        self.assertIsNone(actual)  # Observer must never load absent library.
        library=ctypes.CDLL(str(self.path))
        try:
            result=evidence.mapped_native_receipts(self.root,self.contract)
            self.assertTrue(result['entries'][0]['mapped']);self.assertEqual(result['entries'][0]['diskIntegrity'],'VERIFIED')
            self.assertEqual(result['entries'][0]['actualMappedArtifact'],'codec-native');self.assertFalse(result['complete'])
        finally:
            import _ctypes
            _ctypes.dlclose(library._handle)


class NetworkEligibilityTests(unittest.TestCase):
    def guard(self):
        with patch('sys.addaudithook'):return OfflineRuntimeGuard()
    def test_private_loopback_external_dns_child_and_model_fetch(self):
        guard=self.guard()
        events=[('socket.connect',(None,('127.0.0.1',8766))),('socket.connect',(None,('203.0.113.4',443))),
            ('socket.getaddrinfo',('private.example',443)),('socket.connect',(None,('model.private.example',443))),
            ('socket.sendto',(None,b'private',('203.0.113.5',53)))]
        for event,args in events:
            with self.assertRaises(PermissionError):guard.audit(event,args)
        result=guard.snapshot();self.assertEqual(result['classifications']['LOOPBACK'],1)
        self.assertEqual(result['classifications']['DNS_ATTEMPT'],1);self.assertEqual(result['native'],'UNVERIFIED')
        self.assertEqual(result['nativeNetworkContainment'],'PARTIAL')
        for private in ('private.example','203.0.113','8766'):self.assertNotIn(private,json.dumps(result))
        child=self.guard()
        with self.assertRaises(PermissionError):child.audit('socket.connect',(None,('203.0.113.5',443)))
        self.assertEqual(child.snapshot()['classifications']['EXTERNAL_ATTEMPT'],1)
    def test_unknown_stays_unverified_and_strict_gate_blocked(self):
        guard=self.guard()
        with self.assertRaises(PermissionError):guard.audit('socket.connect',(None,'unix-or-unknown'))
        self.assertEqual(guard.snapshot()['classifications']['UNKNOWN'],1)
        inventory=fixture_inventory();inventory['runtimeEvidence']['network']=guard.snapshot()
        self.assertFalse(strict_eligibility(inventory,trusted_bootstrap=True,browser_verified=True,fresh_session=True)['processingEligible'])
    def test_new_receipt_gate_requires_fresh_session_mapped_and_chain(self):
        inventory=fixture_inventory();inventory.update(processingReceiptVersion=1,processingChainComplete=True)
        self.assertTrue(strict_eligibility(inventory,trusted_bootstrap=True,browser_verified=True,fresh_session=True)['processingEligible'])
        for fresh in (False,None):self.assertFalse(strict_eligibility(inventory,trusted_bootstrap=True,browser_verified=True,fresh_session=fresh)['processingEligible'])
        inventory['runtimeEvidence']['mappedNative']['complete']=False
        self.assertFalse(strict_eligibility(inventory,trusted_bootstrap=True,browser_verified=True,fresh_session=True)['processingEligible'])
    def test_legacy_and_separate_flags(self):
        inventory=fixture_inventory();inventory['mode']='LEGACY'
        self.assertFalse(strict_eligibility(inventory,trusted_bootstrap=True,browser_verified=True)['processingEligible'])
        result=evidence.upgrade(fixture_inventory())
        self.assertTrue(result['identityComplete']);self.assertFalse(result['nativeClosureComplete'])
        self.assertFalse(result['offlineRuntimeComplete']);self.assertFalse(result['processingChainComplete'])
        self.assertFalse(result['processingEligible']);self.assertFalse(result['publicationEligible'])


class ProcessingHTTPTests(unittest.TestCase):
    """Real loopback transport with synthetic complete/partial chains, never ML acceptance."""
    @classmethod
    def setUpClass(cls):
        import importlib.util
        spec=importlib.util.spec_from_file_location('nova_processing_server',Path(__file__).with_name('server.py'))
        cls.server_module=importlib.util.module_from_spec(spec);spec.loader.exec_module(cls.server_module)
    def run_request(self, mode):
        import threading
        import time
        import os
        import base64
        from http.client import HTTPConnection
        from types import SimpleNamespace
        module=self.server_module;inventory=fixture_inventory();captured={}
        def processor(source,work_dir):
            captured['work']=work_dir;captured['bound']=module.REQUEST_RECEIPTS.bound
            module.current_processing_calls().entries=complete_calls()['entries']
            if mode=='failure': raise RuntimeError('private-home-path-error')
            if mode=='partial': module.current_processing_calls().entries=[]
            if mode in ('browser-close','heartbeat-expiry'): os.environ['NOVA_LIFECYCLE_DEADLINE']='0'
            if mode in ('helper-replacement','server-restart'): os.environ['NOVA_LIFECYCLE_SESSION']='f'*64
            return {'ok':True,'midiBase64':base64.b64encode(b'disposable-midi').decode()}
        server=module.ThreadingHTTPServer(('127.0.0.1',0),module.Handler)
        thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
        try:
            with patch.dict(os.environ,{'NOVA_LIFECYCLE_SESSION':'a'*64,'NOVA_LIFECYCLE_DEADLINE':str(time.monotonic()+20)}),\
                 patch.object(module,'STRICT_BOOTSTRAP',True),patch.object(module,'require_runtime_processing'),\
                 patch.object(module,'RUNTIME_EVIDENCE_MODULE',evidence),patch.object(module,'RUNTIME_INVENTORY',SimpleNamespace(root=Path('.'))),\
                 patch.object(module,'RUNTIME_EVIDENCE_CONTRACT',{'imports':[]}),\
                 patch.object(module,'PROCESSING_ATTEMPTS',evidence.SessionRequestRegistry('a'*64)),\
                 patch.object(module,'runtime_snapshot',return_value=inventory),patch.object(module,'process_audio',side_effect=processor):
                connection=HTTPConnection('127.0.0.1',server.server_port,timeout=5)
                connection.request('POST','/process',body=b'fixture',headers={'X-Nova-Audio-Pipeline':'1','X-Nova-File-Name':'fixture.wav',
                    'X-Nova-Session':'a'*64,'X-Nova-Request':'b'*64})
                response=connection.getresponse();status=response.status;payload=json.loads(response.read());connection.close()
        finally:server.shutdown();server.server_close();thread.join(timeout=5)
        self.assertFalse(captured['work'].exists());self.assertFalse(module.PROCESS_LOCK.locked())
        self.assertNotIn('private-home',json.dumps(payload))
        self.assertEqual(captured['bound'].state,'CONSUMED' if mode=='success' else 'ABORTED')
        return status,payload
    def test_complete_software_chain_success_and_cleanup(self):
        status,payload=self.run_request('success');self.assertEqual(status,200)
        self.assertTrue(payload['processingReceipt']['complete']);self.assertFalse(payload['processingReceipt']['publicationEligible'])
    def test_partial_failure_close_expiry_replacement_restart_cleanup(self):
        for mode in ('failure','partial','browser-close','heartbeat-expiry','helper-replacement','server-restart'):
            with self.subTest(mode=mode):
                status,payload=self.run_request(mode);self.assertEqual(status,503);self.assertFalse(payload['ok'])
                self.assertNotIn('processingReceipt',payload)
    def test_retry_uses_new_attempt(self):
        self.run_request('failure');status,payload=self.run_request('success');self.assertEqual(status,200)

class RetainedModelTests(unittest.TestCase):
    def test_same_object_reuse_replacement_changed_identity_and_no_reload(self):
        from test_runtime_inventory import RuntimeTests
        fixture=RuntimeTests();fixture.setUp()
        try:
            calls=[];obj=object()
            fixture.runtime.load_model('m',lambda path:(calls.append(path),obj)[1])
            for _ in range(3):self.assertIs(fixture.runtime.retained_model('m')[0],obj)
            self.assertEqual(len(calls),1)
            fixture.runtime.loaded['m']=object()
            with self.assertRaises(ValueError):fixture.runtime.retained_model('m')
            self.assertEqual(fixture.runtime.loaded,{})
            fixture.runtime.load_model('m',lambda path:obj)
            fixture.runtime.models['m']['identity']['digest']='f'*64
            with self.assertRaises(ValueError):fixture.runtime.retained_model('m')
        finally:fixture.doCleanups()


class RequestReplayTests(unittest.TestCase):
    def test_one_session_retry_requires_new_request_and_no_eviction(self):
        registry=evidence.SessionRequestRegistry('a'*64,capacity=2)
        registry.claim('a'*64,'b'*64)
        with self.assertRaises(ValueError):registry.claim('a'*64,'b'*64)
        with self.assertRaises(ValueError):registry.claim('f'*64,'c'*64)
        registry.claim('a'*64,'c'*64)
        with self.assertRaises(ValueError):registry.claim('a'*64,'d'*64)
        registry.close()
        with self.assertRaises(ValueError):registry.claim('a'*64,'e'*64)
        fresh=evidence.SessionRequestRegistry('f'*64);fresh.claim('f'*64,'b'*64)
        with self.assertRaises(ValueError):fresh.claim('a'*64,'b'*64)


class BasicPitchCallTests(unittest.TestCase):
    def test_actual_adapter_calls_reuse_object_and_restore_on_failure(self):
        import sys
        import types
        from types import SimpleNamespace
        module=ProcessingHTTPTests.server_module if hasattr(ProcessingHTTPTests,'server_module') else None
        if module is None: ProcessingHTTPTests.setUpClass();module=ProcessingHTTPTests.server_module
        for failed in (False,True):
            librosa=types.ModuleType('librosa');events=[];model=object()
            def resample(*args,**kwargs):events.append('resample');return [1]
            def load(*args,**kwargs):events.append('decode');return librosa.resample([1]),22050
            librosa.load=load;librosa.resample=resample
            def write(path):events.append('midi-write')
            def predict(path,model_or_model_path):
                self.assertIs(model_or_model_path,model);librosa.load(path)
                if failed:raise RuntimeError('fixture-inference-failed')
                return None,SimpleNamespace(write=write),None
            inference=types.ModuleType('basic_pitch.inference');inference.predict=predict
            calls=SimpleNamespace(entries=[])
            def call(stage,logical,function,*args,**kwargs):
                calls.entries.append({'stage':stage});return function(*args,**kwargs)
            calls.call=call
            runtime=SimpleNamespace(bindings={'models':[{'id':'bp','runtimeIdentifier':'basic-pitch'}]},
                retained_model=lambda identity:(model,{'identity':{'id':'bp','digest':'a'*64}}))
            with tempfile.TemporaryDirectory() as folder:
                source=Path(folder,'stem.wav');source.write_bytes(b'fixture')
                with patch.dict(sys.modules,{'librosa':librosa,'basic_pitch':types.ModuleType('basic_pitch'),'basic_pitch.inference':inference}),\
                     patch.object(module,'STRICT_BOOTSTRAP',True),patch.object(module,'require_runtime_processing'),\
                     patch.object(module,'RUNTIME_INVENTORY',runtime),patch.object(module,'RUNTIME_EVIDENCE_MODULE',evidence),\
                     patch.object(module,'current_processing_calls',return_value=calls):
                    if failed:
                        with self.assertRaises(RuntimeError):module.transcribe_pitched_stem(source,Path(folder,'result.mid'))
                    else:module.transcribe_pitched_stem(source,Path(folder,'result.mid'))
                self.assertIs(librosa.load,load);self.assertIs(librosa.resample,resample)
                self.assertIn('decoder',[e['stage'] for e in calls.entries]);self.assertIn('resample',[e['stage'] for e in calls.entries])
                self.assertEqual('midi-write' in events,not failed)

if __name__=='__main__':unittest.main()
