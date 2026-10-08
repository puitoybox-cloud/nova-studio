import copy
import hashlib
import json
import tempfile
import subprocess
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
from local_distribution_entry import LocalProductionLifecycle, strict_eligibility
from runtime_evidence import scoped_macho_dependencies, ProcessingReceipt


def digest(value):
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':')).encode()).hexdigest()

class Child:
    pid=987654
    def __init__(self): self.exited=False
    def poll(self): return 0 if self.exited else None
    def wait(self,timeout=None): self.exited=True

class LifecycleTests(unittest.TestCase):
    def make(self, health=None, browser=None):
        config='{}';manifest={'buildRevision':'fixture','helper':{'version':1,'pipelineRevision':2,'sourceDigest':'a'*64},'assets':[{'id':'runtime-config','digest':hashlib.sha256(config.encode()).hexdigest()}]}
        prepared={'command':['/fixture/python','server.py'],'environment':{},'browserEnvelope':{'manifest':manifest,'trust':{'buildRevision':'fixture','manifestDigest':digest(manifest)},'runtimeConfigText':config}}
        self.child=Child()
        lifecycle=LocalProductionLifecycle(prepared,{'/music-studio.html':b'<html></html>'},{'/music-studio.html':hashlib.sha256(b'<html></html>').hexdigest()},popen=lambda *a,**k:self.child, browser=browser or (lambda url: True), timeout=.1)
        def valid():return {'version':1,'pipelineRevision':2,'sourceDigest':'a'*64,'host':'127.0.0.1','port':8766,'localOnly':True,'lifecycleSession':lifecycle.server.session,'runtimeIdentity':{'actualInventory':{'mode':'STRICT','identityComplete':True}}}
        lifecycle.health=health or valid
        return lifecycle
    def cleanup(self,l):
        with patch('local_distribution_entry.os.killpg') as kill:
            l.close();self.assertEqual(l.state,'STOPPED')
            self.assertFalse(l.eligibility['processingEligible']);self.assertEqual(l.server.nonce,'')
            self.assertEqual(l.server.server.socket.fileno(),-1)
        l.close()
    def test_normal_start_inventory_partial_blocks_processing(self):
        l=self.make()
        try:
            r=l.start();self.assertEqual(r['state'],'SERVER_READY');self.assertTrue(r['startURL'].startswith(l.server.origin))
            l.browser_event('BROWSER_READY');l.browser_event('IDENTITY_VERIFIED')
            self.assertEqual(l.state,'IDENTITY_VERIFIED');self.assertFalse(l.eligibility['processingEligible'])
            self.assertFalse(l.eligibility['publicationEligible'])
        finally:self.cleanup(l)
    def test_stale_helper_identity_incomplete_and_wrong_identity(self):
        for key,value in [('lifecycleSession','old'),('sourceDigest','b'*64),('runtimeIdentity',{'actualInventory':{'mode':'STRICT'}})]:
            l=self.make();valid=l.health
            l.health=lambda key=key,value=value:{**valid(),key:value}
            with patch('local_distribution_entry.os.killpg'):
                with self.assertRaises(ValueError):l.start()
            self.assertEqual(l.state,'FAILED');self.assertTrue(l.server.closed)
    def test_helper_failure(self):
        l=self.make();self.child.exited=True
        with patch('local_distribution_entry.os.killpg'):
            with self.assertRaisesRegex(ValueError,'helper-startup'):l.start()
        self.assertTrue(l.server.closed)

    def test_owned_helper_disk_preflight_brackets_actual_spawn(self):
        l=self.make();events=[]
        l.prepared['_source_preflight']=lambda:events.append('verify')
        def spawn(*args,**kwargs):events.append('spawn');return self.child
        l.popen=spawn
        try:
            l.start();self.assertEqual(events,['verify','spawn','verify','verify','verify'])
        finally:self.cleanup(l)

    def test_changed_post_spawn_identity_blocks_health_admission(self):
        l=self.make();events=[]
        def verify():
            events.append('verify')
            if len(events)==2:raise ValueError('changed-executable-after-spawn')
        l.prepared['_source_preflight']=verify
        l.health=lambda:(_ for _ in ()).throw(AssertionError('health-admitted-before-postflight'))
        with self.assertRaisesRegex(ValueError,'changed-executable-after-spawn'):l.start()
        self.assertEqual(l.state,'FAILED');self.assertTrue(l.server.closed)

    def test_pinned_private_channel_origin_cannot_change_in_health(self):
        l=self.make();health=l.health()
        l.expected_child_private={'parentLaunchEvidence':{'session':l.server.session}}
        health['runtimeIdentity']['actualInventory']['privatePython']=copy.deepcopy(l.expected_child_private)
        try:
            l.verify_health(health)
            health['runtimeIdentity']['actualInventory']['privatePython']['parentLaunchEvidence']['session']='foreign'
            with self.assertRaisesRegex(ValueError,'changed-or-foreign-helper-private-origin'):l.verify_health(health)
        finally:l.close()
    def test_completion_preflight_blocks_publication_and_delivery_on_mutation(self):
        for route, action in (('/owned-helper-result', None), ('/owned-control', 'result'),
                ('/owned-control', 'accept')):
            for timing in ('before', 'during'):
                with self.subTest(route=route, action=action, timing=timing):
                    l=self.make();l.child=self.child;l.inventory={'stale':True}
                    changed=[timing=='before'];health=l.health
                    def preflight():
                        if changed[0]:raise ValueError('changed-runtime-at-completion')
                    def read():
                        value=health();changed[0]=True;return value
                    l.prepared['_source_preflight']=preflight
                    if timing=='during':l.health=read
                    try:
                        with patch.object(l.control,'publish') as publish, patch.object(l.control,'command') as command:
                            with self.assertRaisesRegex(ValueError,'changed-runtime-at-completion'):
                                l.control_event(route,{'action':action})
                            publish.assert_not_called();command.assert_not_called()
                        self.assertEqual(l.inventory,{})
                        self.assertFalse(l.eligibility['processingEligible'])
                    finally:l.child=None;l.close()

    def test_replaced_private_pipe_with_same_identity_is_rejected(self):
        import socket
        l=self.make();process=subprocess.Popen([sys.executable,'-I','-c','import sys;sys.stdin.read()'],stdin=subprocess.PIPE)
        a,b=socket.socketpair();c,d=socket.socketpair()
        identity={'session':l.control.session,'owner':l.control.owner,
            'generation':digest(l.server.binding),'deadline':l.server.deadline}
        pipe=SimpleNamespace(identity=copy.deepcopy(identity),handle=a,closed=False)
        l.child=process;l._origin_owned_child=process;l._origin_owned_identity=identity
        l.stop_pipe=pipe;l._origin_owned_pipe=pipe;l._origin_owned_handle=a
        try:
            l.verify_owned_continuity()
            pipe.handle=c
            with self.assertRaisesRegex(ValueError,'changed-or-dead-owned-helper'):l.verify_owned_continuity()
            pipe.handle=a;l.stop_pipe=SimpleNamespace(identity=copy.deepcopy(identity),handle=a,closed=False)
            with self.assertRaisesRegex(ValueError,'changed-or-dead-owned-helper'):l.verify_owned_continuity()
            l.stop_pipe=pipe;a.close()
            with self.assertRaisesRegex(ValueError,'changed-or-dead-owned-helper'):l.verify_owned_continuity()
        finally:
            for handle in (a,b,c,d):handle.close()
            process.stdin.close();process.wait(timeout=3);l.child=None;l.stop_pipe=None;l.close()

    def test_publication_boundary_rechecks_inventory_after_receipt_aggregation(self):
        from runtime_evidence import processing_binding
        from test_processing_closure import fixture_inventory
        l=self.make();l.child=self.child
        inventory=fixture_inventory()
        l.control.binding=processing_binding(l.control.session,'a'*64,{'digest':'b'*64,'byteLength':7},inventory)
        l.inventory=copy.deepcopy(inventory);l.inventory['privatePython']={'buildRevision':'changed'}
        l.prepared['_source_preflight']=lambda:None
        try:
            with patch.object(l,'verified_owned_health') as health:
                with self.assertRaisesRegex(ValueError,'changed-publication-processing-inventory'):
                    l.control.continuity()
                health.assert_called_once()
            self.assertEqual(l.inventory,{})
            self.assertFalse(l.eligibility['processingEligible'])
        finally:l.child=None;l.close()

    def test_processing_supervision_rejects_changed_owned_continuity(self):
        l=self.make();l.child=self.child;l.state='PROCESSING_ELIGIBLE'
        try:
            with patch.object(l.done,'wait',return_value=False), \
                    patch.object(l,'verify_owned_continuity',side_effect=ValueError('changed-owned-helper')) as check, \
                    patch.object(l,'close') as close:
                l.supervise()
                check.assert_called_once();close.assert_called_once_with(failed=True)
            self.assertEqual(l.state,'FAILED')
        finally:l.child=None;l.close()

    def test_server_failure(self):
        l=self.make()
        with patch.object(l.server,'start',side_effect=OSError('bind')),patch('local_distribution_entry.os.killpg'):
            with self.assertRaises(OSError):l.start()
        self.assertEqual(l.state,'FAILED')

    def test_owned_health_rejects_process_exit_and_binding_changes_during_read(self):
        for mutation in ('exit', 'object', 'session', 'owner', 'generation', 'pipe'):
            with self.subTest(mutation=mutation):
                l=self.make(); process=subprocess.Popen([sys.executable,'-I','-c',
                    'import sys;sys.stdin.read()'],stdin=subprocess.PIPE)
                try:
                    l.child=process;l._origin_owned_child=process
                    identity={'session':l.control.session,'owner':l.control.owner,
                        'generation':digest(l.server.binding),'deadline':l.server.deadline}
                    l._origin_owned_identity=copy.deepcopy(identity)
                    l.stop_pipe=type('Pipe',(),{'identity':copy.deepcopy(identity)})()
                    valid=l.health
                    def changed():
                        health=valid()
                        if mutation=='exit':process.stdin.close();process.wait(timeout=3)
                        elif mutation=='object':l.child=Child()
                        elif mutation=='session':l.server.session='foreign'
                        elif mutation=='owner':l.control.owner='foreign'
                        elif mutation=='generation':l.server.binding['buildRevision']='foreign'
                        elif mutation=='pipe':l.stop_pipe.identity['session']='foreign'
                        return health
                    l.health=changed
                    with self.assertRaisesRegex(ValueError,'changed-or-dead-owned-helper'):
                        l.verified_owned_health()
                    self.assertEqual(l.inventory,{})
                    self.assertFalse(l.eligibility['processingEligible'])
                finally:
                    if not process.stdin.closed:process.stdin.close()
                    process.wait(timeout=3)
                    l.child=None;l.stop_pipe=None;l.close()

    def test_owned_health_rejects_replaced_child_before_health_read(self):
        l=self.make();process=subprocess.Popen([sys.executable,'-I','-c',
            'import sys;sys.stdin.read()'],stdin=subprocess.PIPE)
        try:
            l._origin_owned_child=process;l.child=Child()
            l._origin_owned_identity={'session':l.control.session,'owner':l.control.owner,
                'generation':digest(l.server.binding),'deadline':l.server.deadline}
            l.health=lambda:(_ for _ in ()).throw(AssertionError('foreign-health-read'))
            with self.assertRaisesRegex(ValueError,'changed-or-dead-owned-helper'):l.verified_owned_health()
        finally:
            process.stdin.close();process.wait(timeout=3);l.child=None;l.close()
    def test_browser_failure_and_retry(self):
        l=self.make(browser=lambda url:False);old=l.server.session
        with patch('local_distribution_entry.os.killpg'):
            with self.assertRaisesRegex(ValueError,'browser-startup'):l.start()
        with self.assertRaisesRegex(ValueError,'stale-lifecycle'):l.start()
        fresh=self.make()
        try:self.assertNotEqual(old,fresh.server.session);fresh.start()
        finally:self.cleanup(fresh)
    def test_browser_failure_invalidation(self):
        l=self.make()
        try:
            l.start();l.browser_event('FAILED');self.assertTrue(l.done.is_set())
            with self.assertRaises(ValueError):l.browser_event('IDENTITY_VERIFIED')
            self.assertFalse(l.eligibility['processingEligible'])
        finally:self.cleanup(l)
    def test_out_of_order_rejected(self):
        l=self.make()
        try:
            l.start()
            with self.assertRaises(ValueError):l.browser_event('IDENTITY_VERIFIED')
        finally:self.cleanup(l)
    def test_eligibility_complete_partial_legacy_absent_backend(self):
        inv={'mode':'STRICT','status':'VERIFIED','complete':True,'identityComplete':True,'runtimeEvidence':{'processingChain':{'complete':True},'dynamicNativeGraph':{'complete':True},'network':{'nativeNetworkVerified':True,'native':'CONTAINED'}}}
        self.assertTrue(strict_eligibility(inv,trusted_bootstrap=True,browser_verified=True)['processingEligible'])
        self.assertFalse(strict_eligibility(inv,trusted_bootstrap=True,browser_verified=True)['publicationEligible'])
        for key,value in [('complete',False),('mode','LEGACY'),('identityComplete',False)]:
            partial=copy.deepcopy(inv);partial[key]=value
            self.assertFalse(strict_eligibility(partial,trusted_bootstrap=True,browser_verified=True)['processingEligible'])
        for field in ['processingChain','dynamicNativeGraph','network']:
            partial=copy.deepcopy(inv);partial['runtimeEvidence'][field]={}
            self.assertFalse(strict_eligibility(partial,trusted_bootstrap=True,browser_verified=True)['processingEligible'])

class NativeTests(unittest.TestCase):
    def image(self,name):
        import struct
        encoded=name.encode()+b'\0';length=(24+len(encoded)+7)//8*8
        encoded += b'\0'*(length-24-len(encoded))
        command=struct.pack('<6I',0xc,length,24,0,0,0)+encoded
        return struct.pack('<8I',0xfeedfacf,0x1000007,0,6,1,len(command),0,0)+command
    def test_declared_transitive_missing_unexpected_and_wrong_artifact(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);parent={'id':'entry','kind':'EXTENSION','path':'entry.so'}
            child={'id':'lib','kind':'SHARED_LIBRARY','path':'lib.dylib','version':'1','module':None,'digest':hashlib.sha256(b'fixture').hexdigest(),'byteLength':7}
            (root/'entry.so').write_bytes(self.image('@loader_path/lib.dylib'))
            parent.update(version='1',digest=hashlib.sha256((root/'entry.so').read_bytes()).hexdigest(),byteLength=(root/'entry.so').stat().st_size)
            (root/'lib.dylib').write_bytes(b'fixture')
            c={'native':[parent,child],'buildRevision':'fixture','architecture':'x86_64'}
            with patch('runtime_evidence.scoped_loaded_library',return_value={'actualLoaded':True}):
                r=scoped_macho_dependencies(root,c);self.assertFalse(r['complete']);self.assertEqual(r['edges'][0]['status'],'OBSERVED_UNVERIFIED');self.assertIsNotNone(r['edges'][0]['artifactDigest'])
                child['digest']='0'*64;r=scoped_macho_dependencies(root,c);self.assertIsNone(r['edges'][0]['artifactDigest'])
                (root/'lib.dylib').unlink();r=scoped_macho_dependencies(root,c);self.assertEqual(r['edges'][0]['status'],'MISSING')
            (root/'entry.so').write_bytes(self.image('@rpath/unknown.dylib'))
            parent.update(digest=hashlib.sha256((root/'entry.so').read_bytes()).hexdigest(),byteLength=(root/'entry.so').stat().st_size)
            r=scoped_macho_dependencies(root,c);self.assertEqual(r['edges'][0]['status'],'UNEXPECTED_OBSERVED');self.assertNotIn(folder,json.dumps(r))
    def test_unverified_codec_and_fallback_never_called(self):
        def unexpected():raise AssertionError('must not execute')
        receipt=ProcessingReceipt(Path('.'),{'imports':[]})
        for stage in ['decoder','resample','encoder','stem']:
            with self.assertRaisesRegex(ValueError,'unverified-or-fallback'):receipt.call(stage,stage,unexpected)
        with self.assertRaises(ValueError):receipt.call('decoder','decoder',unexpected,fallback=True)
        self.assertFalse(receipt.snapshot()['complete'])

if __name__=='__main__':unittest.main()

class CodecReceiptTests(unittest.TestCase):
    def make(self):
        def actual_backend(): return 'fixture'
        path=Path(__file__).resolve();raw=path.read_bytes()
        entry={'id':'fixture-backend','module':__name__,'path':path.name,'digest':hashlib.sha256(raw).hexdigest(),'byteLength':len(raw),'version':'1'}
        return actual_backend,ProcessingReceipt(path.parent,{'imports':[entry],'buildRevision':'fixture'}),entry
    def test_actual_decoder_resample_encoder_stem_calls_identity_bound(self):
        for stage in ['decoder','resample','encoder','stem']:
            fn,receipt,entry=self.make();self.assertEqual(receipt.call(stage,stage,fn),'fixture')
            value=receipt.snapshot();self.assertEqual(value['entries'][0]['artifactDigest'],entry['digest'])
            self.assertTrue(value['entries'][0]['completed']);self.assertFalse(value['complete'])
            self.assertEqual(value['entries'][0]['nativeIdentity'],'UNVERIFIED')
            dispatch=value['entries'][0]['dispatchEvidence']
            self.assertEqual(dispatch['pythonDispatch'],'OBSERVED')
            self.assertEqual(dispatch['entryCount'],1)
            self.assertEqual(dispatch['returnCount'],1)
            self.assertEqual(dispatch['callIdentity'],value['entries'][0]['callIdentity'])
            self.assertEqual(dispatch['actualNativeDispatch'],'UNVERIFIED')
    def test_wrong_artifact_and_external_fallback_blocked(self):
        fn,receipt,entry=self.make();entry['digest']='0'*64
        with self.assertRaises(ValueError):receipt.call('encoder','writer',fn)
        fn,receipt,_=self.make()
        with self.assertRaises(ValueError):receipt.call('decoder','ffmpeg',fn,fallback=True)


class ActualDispatchTests(unittest.TestCase):
    def window(self, function):
        from runtime_evidence import ScopedPythonDispatch
        return ScopedPythonDispatch(function, 'fixture-call')

    def test_disk_presence_without_invocation_is_unverified(self):
        def backend(): return 1
        with self.window(backend) as window: pass
        self.assertEqual(window.snapshot(True)['pythonDispatch'],'UNVERIFIED')

    def test_other_callable_does_not_prove_requested_dispatch(self):
        def backend(): return 1
        def other(): return 2
        with self.window(backend) as window: other()
        self.assertEqual(window.snapshot(True)['entryCount'],0)

    def test_exception_is_not_successful_dispatch(self):
        def backend(): raise RuntimeError('fixture')
        with self.assertRaises(RuntimeError):
            with self.window(backend) as window: backend()
        self.assertEqual(window.snapshot(False)['pythonDispatch'],'UNVERIFIED')

    def test_existing_profiler_preserved(self):
        import sys
        def hook(*args): pass
        sys.setprofile(hook)
        try:
            with self.assertRaisesRegex(ValueError,'occupied'):
                with self.window(lambda: None): pass
            self.assertIs(sys.getprofile(),hook)
        finally: sys.setprofile(None)

    def test_backend_disables_observer_rejected_and_released(self):
        import sys
        def backend(): sys.setprofile(None)
        with self.window(backend) as window: backend()
        self.assertTrue(window.snapshot(True)['observerChanged'])
        self.assertEqual(window.snapshot(True)['pythonDispatch'],'UNVERIFIED')
        self.assertIsNone(sys.getprofile())

    def test_builtin_native_boundary_remains_unverified(self):
        with self.window(len) as window: len([])
        self.assertEqual(window.snapshot(True)['pythonDispatch'],'UNVERIFIED')

    def test_recursion_budget_and_cleanup(self):
        import sys
        def backend(n):
            if n: return backend(n-1)
            return 0
        with self.assertRaisesRegex(PermissionError,'budget'):
            with self.window(backend) as window: backend(257)
        self.assertTrue(window.snapshot(False)['overflow'])
        self.assertIsNone(sys.getprofile())
