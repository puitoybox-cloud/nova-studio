"""Anonymous owned channel evidence; disposable software fixtures only."""
import copy
import json
import os
import socket
import subprocess
import sys
import threading
import time
import unittest
from unittest.mock import patch
from pathlib import Path
from demucs_receipt import OwnedStopPipe, OwnedExitObservation
import test_production_lifecycle as lifecycle_fixtures


class StopPipeTests(unittest.TestCase):
    def pair(self):
        left,right=socket.socketpair()
        identity={'session':'a'*64,'owner':'b'*64,'generation':'c'*64,'deadline':time.monotonic()+30}
        a=OwnedStopPipe(left,identity,'d'*64);b=OwnedStopPipe(right,identity,'d'*64)
        self.addCleanup(a.close);self.addCleanup(b.close)
        return a,b

    def message(self,a):
        return a.seal({**a.identity,'kind':'STOP','requestBindingDigest':'e'*64,'challenge':'f'*64})

    def test_sealed_payload_detaches_nested_origin_and_shutdown_evidence(self):
        for kind in ('ORIGIN','HELPER_SHUTDOWN'):
            a,b=self.pair()
            payload={**a.identity,'kind':kind,'evidence':{'entries':[{'digest':'e'*64}]}}
            sealed=a.seal(payload);original=copy.deepcopy(sealed)
            payload['evidence']['entries'][0]['digest']='f'*64
            payload['evidence']['entries'].append({'late':True})
            self.assertEqual(sealed,original)
            self.assertEqual(sealed['authentication'],b.seal(sealed['payload'])['authentication'])
            a.close();self.assertEqual(sealed,original)
            sealed['payload']['evidence']['entries'][0]['digest']='0'*64
            self.assertNotEqual(sealed['authentication'],b.seal(sealed['payload'])['authentication'])

    def test_authenticated_one_shot_stop_reply_and_key_erasure(self):
        a,b=self.pair();events=[];errors=[]
        def run():
            try:b.accept(lambda p:events.append(p))
            except BaseException as e:errors.append(e)
        worker=threading.Thread(target=run);worker.start()
        receipt=a.request({'session':'a'*64,'request':'e'*64});worker.join(timeout=2)
        self.assertFalse(worker.is_alive());self.assertEqual(errors,[])
        self.assertEqual(receipt['status'],'OBSERVED');self.assertEqual(len(events),1)
        self.assertEqual(events[0]['session'],a.identity['session'])
        with self.assertRaisesRegex(ValueError,'stale-owned-stop-pipe'):a.request(None)
        a.close();self.assertEqual(a.key,'');self.assertEqual(a.handle.fileno(),-1)

    def test_owned_origin_handshake_then_existing_stop_and_final(self):
        a,b=self.pair();actual={'executable':{'digest':'e'*64},'processOrigin':{'mappedBytesVerified':False}}
        errors=[];bindings=[]
        def child():
            try:
                bindings.append(b.accept_origin(actual))
                b.accept(lambda _:None);b.send_final({'complete':False})
            except BaseException as error:errors.append(error)
        worker=threading.Thread(target=child);worker.start()
        binding=a.request_origin(actual)
        self.assertFalse(binding['parentLaunchAuthenticated']);self.assertFalse(binding['parentKernelOriginVerified'])
        with self.assertRaisesRegex(ValueError,'stale-owned-origin'):a.request_origin(actual)
        a.request({'request':'f'*64});self.assertFalse(a.receive_final()['shutdown']['complete'])
        worker.join(2);self.assertFalse(worker.is_alive());self.assertEqual(errors,[]);self.assertEqual(bindings,[binding])

    def test_owned_origin_foreign_identity_and_replay_rejected(self):
        a,b=self.pair()
        payload={**a.identity,'kind':'ORIGIN','challenge':'e'*64,'identity':{'build':'foreign'}}
        a.send(a.seal(payload))
        with self.assertRaisesRegex(ValueError,'foreign-child-owned-origin'):b.accept_origin({'build':'approved'})
        with self.assertRaisesRegex(ValueError,'stale-owned-origin'):b.accept_origin({'build':'approved'})

    def test_owned_origin_session_owner_generation_key_and_challenge_rejected(self):
        for field in ('session','owner','generation','deadline','challenge'):
            a,b=self.pair();payload={**a.identity,'kind':'ORIGIN','challenge':'e'*64,'identity':{}}
            payload[field]=0 if field=='deadline' else 'foreign'
            with self.assertRaisesRegex(ValueError,'foreign-owned-origin'):
                b._origin_envelope(a.seal(payload),'ORIGIN')
        a,b=self.pair();payload={**a.identity,'kind':'ORIGIN','challenge':'e'*64,'identity':{}}
        b.key='0'*64
        with self.assertRaisesRegex(ValueError,'foreign-owned-origin'):b._origin_envelope(a.seal(payload),'ORIGIN')

    def test_owned_origin_changed_signed_reply_consumes_attempt(self):
        a,b=self.pair();errors=[]
        def child():
            try:
                p=b._origin_envelope(b.receive(),'ORIGIN')
                b.send(b.seal({**p,'kind':'ORIGIN_REPLY','identity':{'foreign':True}}))
            except BaseException as error:errors.append(error)
        worker=threading.Thread(target=child);worker.start()
        with self.assertRaisesRegex(ValueError,'foreign-owned-origin-reply'):a.request_origin({'approved':True})
        worker.join(2);self.assertEqual(errors,[])
        with self.assertRaisesRegex(ValueError,'stale-owned-origin'):a.request_origin({'approved':True})

    def test_authenticated_foreign_session_owner_generation_deadline_rejected(self):
        for field in ('session','owner','generation','deadline','requestBindingDigest','challenge'):
            a,b=self.pair();value=self.message(a)
            value['payload'][field]=0 if field=='deadline' else 'foreign'
            value=a.seal(value['payload'])
            with self.assertRaisesRegex(ValueError,'foreign-owned-stop-pipe'):b.validate(value,'STOP')

    def test_changed_payload_wrong_key_and_wrong_direction_rejected(self):
        a,b=self.pair();value=self.message(a)
        changed=copy.deepcopy(value);changed['payload']['requestBindingDigest']='0'*64
        with self.assertRaises(ValueError):b.validate(changed,'STOP')
        b.key='0'*64
        with self.assertRaises(ValueError):b.validate(value,'STOP')
        b.key=a.key
        with self.assertRaises(ValueError):b.validate(value,'STOPPING')

    def test_expired_and_closed_channel_rejected(self):
        a,b=self.pair();b.clock=lambda:b.identity['deadline']+10
        with self.assertRaises(ValueError):b.validate(self.message(a),'STOP')
        a.close()
        with self.assertRaises(ValueError):a.request(None)

    def test_framing_budget_duplicate_keys_and_eof_fail_closed(self):
        for raw in (b'x'*4096,b'{"payload":{},"payload":{}}\n',b''):
            a,b=self.pair()
            if raw:a.handle.sendall(raw)
            else:a.close()
            with self.assertRaises(ValueError):b.receive()

    def test_fragmented_delivery_has_total_time_budget(self):
        a,b=self.pair();a.handle.sendall(b'{}\n')
        current=time.monotonic()
        ticks=iter((current,current+0.6,current+1.1,current+1.2))
        b.clock=lambda:next(ticks)
        with self.assertRaisesRegex(TimeoutError,'owned-stop-pipe-time-budget'):b.receive()

    def test_descriptor_not_inheritable_and_no_listener(self):
        a,b=self.pair()
        self.assertFalse(os.get_inheritable(a.handle.fileno()))
        self.assertEqual(a.handle.getsockname(),'');self.assertEqual(a.handle.getpeername(),'')
        internet=socket.socket(socket.AF_INET,socket.SOCK_STREAM);self.addCleanup(internet.close)
        with self.assertRaises(ValueError):OwnedStopPipe(internet,a.identity,a.key)

    def test_valid_mac_challenge_for_other_request_rejected(self):
        a,b=self.pair();errors=[]
        def run():
            try:
                p=b.validate(b.receive(),'STOP')
                b.send(b.seal({**p,'kind':'STOPPING','requestBindingDigest':'0'*64}))
            except BaseException as e:errors.append(e)
        worker=threading.Thread(target=run);worker.start()
        with self.assertRaisesRegex(ValueError,'foreign-owned-stop-reply'):a.request(None)
        worker.join(timeout=2);self.assertEqual(errors,[])

    def test_observer_pins_request_before_stop_and_rejects_late_rebinding(self):
        process=subprocess.Popen([sys.executable,'-c','import sys;sys.stdin.read()'],stdin=subprocess.PIPE)
        def cleanup():
            if not process.stdin.closed:process.stdin.close()
            process.wait(timeout=3)
        self.addCleanup(cleanup)
        observer=OwnedExitObservation(process,'session',{'generation':'fixture'});self.addCleanup(observer.close)
        binding={'session':'session','request':'e'*64}
        observer.bind_request(process,binding)
        with self.assertRaisesRegex(ValueError,'stale-owned-exit-request'):observer.observe(process,{'request':'other'})
        with self.assertRaisesRegex(ValueError,'stale-owned-stop-binding'):observer.request_stop(process,None,{})
        observer.request_stop(process,binding,{'authorization':'fixture'})
        with self.assertRaisesRegex(ValueError,'stale-owned-exit-binding'):observer.bind_request(process,binding)
        before=observer.observe(process,binding)
        self.assertIsNotNone(before['ownedPipeIdentityDigest']);self.assertIsNotNone(before['stopBindingDigest'])
        process.stdin.close();process.wait(timeout=3)
        after=observer.observe(process,binding)
        self.assertEqual(before['registrationIdentity'],after['registrationIdentity'])
        self.assertTrue(after['leaderReaped']);self.assertFalse(after['ownedDescendantsComplete'])

    def test_actual_launcher_child_inherited_stop_and_final_summary(self):
        fixture=lifecycle_fixtures.LifecycleTests();l=fixture.make();self.addCleanup(l.close)
        source=str(Path(__file__).resolve().parent)
        code="import sys,os,json,socket;sys.path.insert(0,"+repr(source)+");from demucs_receipt import OwnedStopPipe; p=OwnedStopPipe(socket.socket(fileno=int(os.environ['NOVA_OWNED_STOP_FD'])),json.loads(os.environ['NOVA_OWNED_STOP_IDENTITY']),os.environ['NOVA_OWNED_RESULT_CAPABILITY']);p.accept(lambda _:None);p.close()"
        l.prepared['command']=[sys.executable,'-I','-c',code];l.popen=subprocess.Popen
        l.start();session=l.server.session;l.close()
        self.assertEqual(l.graceful_stop_receipt['scope'],'OWNED_INHERITED_DESCRIPTOR')
        self.assertEqual(l.graceful_stop_receipt['status'],'OBSERVED')
        observed=l.shutdown_receipt['ownedExitObservation']
        self.assertTrue(observed['leaderReaped']);self.assertTrue(observed['descriptorClosed'])
        self.assertEqual(observed['childSession'],session)
        self.assertIsNotNone(observed['stopBindingDigest'])
        self.assertEqual(l.final_receipt['payload']['completionState'],'PARTIAL')
        self.assertEqual(l.stop_pipe.key,'')

    def test_actual_popen_child_origin_private_exchange_before_health(self):
        import scoped_closure
        fixture=lifecycle_fixtures.LifecycleTests();l=fixture.make();self.addCleanup(l.close)
        source=str(Path(__file__).resolve().parent)
        executable=Path(sys.executable).resolve()
        if sys.platform=='darwin':
            import ctypes
            size=ctypes.c_uint32(65536);buffer=ctypes.create_string_buffer(size.value)
            self.assertEqual(ctypes.CDLL(None)._NSGetExecutablePath(buffer,ctypes.byref(size)),0)
            executable=Path(os.fsdecode(buffer.value)).resolve()
        actual={'processOrigin':scoped_closure.private_process_origin(str(executable)),'productionReady':False}
        l.prepared['_launch_origin_identity']=lambda:copy.deepcopy(actual)
        l.prepared['_source_preflight']=lambda:None
        code=('import sys,os,json,socket;sys.path.insert(0,'+repr(source)+');'
            'from demucs_receipt import OwnedStopPipe;from scoped_closure import private_process_origin;'
            'p=OwnedStopPipe(socket.socket(fileno=int(os.environ["NOVA_OWNED_STOP_FD"])),json.loads(os.environ["NOVA_OWNED_STOP_IDENTITY"]),os.environ["NOVA_OWNED_RESULT_CAPABILITY"]);'
            'p.accept_origin({"processOrigin":private_process_origin('+repr(str(executable))+'),"productionReady":False});'
            'p.accept(lambda _:None);p.send_final({"complete":False});p.close()')
        l.prepared['command']=[sys.executable,'-I','-c',code];l.popen=subprocess.Popen
        health=l.health
        def observed_health():
            result=health();result['runtimeIdentity']['actualInventory']['privatePython']=copy.deepcopy(l.expected_child_private)
            return result
        l.health=observed_health
        l.start()
        self.assertEqual(l.inventory['privatePython'],l.expected_child_private)
        self.assertEqual(l.launch_origin_binding['session'],l.server.session)
        self.assertFalse(l.launch_origin_binding['parentLaunchAuthenticated'])
        l.close();self.assertEqual(l.graceful_stop_receipt['status'],'OBSERVED')
        self.assertTrue(l.shutdown_receipt['ownedExitObservation']['leaderReaped'])

    def test_actual_helper_inherited_descriptor_closes_admission(self):
        import server as helper
        a,b=self.pair();fd=os.dup(b.handle.fileno());b.close()
        event=threading.Event()
        class Server:
            def shutdown(self):event.set()
        registry=type('Registry',(),{'close':lambda self:event.set()})()
        environment={'NOVA_OWNED_STOP_FD':str(fd),'NOVA_OWNED_STOP_IDENTITY':json.dumps(a.identity),
            'NOVA_LIFECYCLE_SESSION':a.identity['session'],'NOVA_LIFECYCLE_DEADLINE':str(a.identity['deadline']),
            'NOVA_OWNED_RESULT_CAPABILITY':a.key}
        helper.OWNED_STOP_REQUESTED.clear()
        self.addCleanup(helper.OWNED_STOP_REQUESTED.clear)
        with patch.dict(os.environ,environment),patch.multiple(helper,STRICT_BOOTSTRAP=True,
                BOOTSTRAP_ERROR=None,PROCESSING_ATTEMPTS=registry):
            pipe=helper.start_owned_stop_pipe(Server());self.addCleanup(pipe.close)
            receipt=a.request({'request':'e'*64})
            self.assertEqual(receipt['state'],'STOPPING')
            self.assertTrue(event.wait(2));self.assertTrue(helper.OWNED_STOP_REQUESTED.is_set())
            self.assertNotIn('NOVA_OWNED_STOP_FD',os.environ)

    def test_unverified_helper_source_cannot_accept_inherited_delivery(self):
        import server as helper
        a,b=self.pair()
        with patch.dict(os.environ,{'NOVA_OWNED_STOP_FD':str(b.handle.fileno()),
                'NOVA_OWNED_STOP_IDENTITY':json.dumps(a.identity)}),patch.object(helper,'STRICT_BOOTSTRAP',False):
            with self.assertRaisesRegex(ValueError,'unverified-owned-stop-source'):
                helper.start_owned_stop_pipe(object())

    def test_demucs_timeout_retains_registration_until_actual_exit(self):
        from demucs_receipt import ChildSession
        process=subprocess.Popen([sys.executable,'-c','import sys;sys.stdin.read()'],stdin=subprocess.PIPE,stdout=subprocess.PIPE)
        session=ChildSession.__new__(ChildSession)
        session.process=process;session.processing_binding={'session':'fixture','request':'e'*64}
        observer=OwnedExitObservation(process,'fixture',{'generation':'fixture'})
        observer.bind_request(process,session.processing_binding);session.exit_observer=observer
        def cleanup():
            if not process.stdin.closed:process.stdin.close()
            process.wait(timeout=3);process.stdout.close();observer.close()
        self.addCleanup(cleanup)
        with patch.object(process,'wait',side_effect=subprocess.TimeoutExpired('fixture',3)),patch.object(process,'poll',return_value=None):
            session.close()
        self.assertFalse(observer.closed);self.assertIs(session.process,process)
        process.wait(timeout=3);session.close()
        self.assertTrue(observer.closed);self.assertIsNone(session.process)
        self.assertTrue(session.shutdown_receipt['ownedExitObservation']['leaderReaped'])
        self.assertEqual(session.shutdown_receipt['hardInterruption'],'UNVERIFIED')

    def test_authenticated_owned_source_loader_failure_prevents_actual_spawn(self):
        fixture=lifecycle_fixtures.LifecycleTests();l=fixture.make();self.addCleanup(l.close)
        l.prepared['_owned_process_loader']=lambda:(_ for _ in ()).throw(ValueError('launcher-owned-source-changed'))
        with patch.object(l,'popen') as spawn:
            with self.assertRaisesRegex(ValueError,'launcher-owned-source-changed'):l.start()
            spawn.assert_not_called()
        self.assertEqual(l.state,'FAILED');self.assertTrue(l.server.closed)

    def test_production_loader_executes_exact_anchored_source_and_rejects_tamper(self):
        import tempfile
        from types import SimpleNamespace
        import local_distribution_entry as launcher
        from test_native_verification import entry
        original=Path(__file__).with_name('demucs_receipt.py').read_bytes()
        with tempfile.TemporaryDirectory() as temporary:
            root=Path(temporary);assets={}
            for identity,relative in launcher.SOURCES.items():
                artifact=entry(root,relative,original if identity=='demucs-receipt-source' else b'fixture')
                artifact.update(id=identity,revision='1');assets[identity]=artifact
            runtime=SimpleNamespace(root=root,manifest={'helper':{'sourceDigest':assets['helper-source']['digest']}},
                bindings={'version':1,'models':[],'dependencies':[],'native':[],'assets':[]},
                expected=lambda kind,identity:assets[identity],recheck=lambda:None,
                resolve_executable=lambda identity,path:str(path))
            with patch.object(launcher,'load_manifest',return_value={'assets':list(assets.values())}),patch.object(launcher,'bootstrap',return_value=runtime),patch.object(launcher,'load_contract',return_value={}),patch.object(launcher,'private_distribution_lookup'),patch.object(launcher,'private_python_command',return_value=[sys.executable,'-I',str(root/'server.py')]),patch.object(launcher,'verify_assembly',return_value={'complete':True}),patch('runtime_evidence.load',return_value={'buildRevision':'build'}),patch('runtime_evidence.assembly_evidence',return_value={'complete':False}):
                prepared=launcher.prepare(root,'manifest','a'*64,'build',pipeline=root)
                pipe_type,observer_type=prepared['_owned_process_loader']()
                self.assertEqual(pipe_type.__module__,'nova_authenticated_owned_process')
                self.assertEqual(observer_type.__module__,'nova_authenticated_owned_process')
                marker=root/'must-not-execute'
                (root/'demucs_receipt.py').write_text('from pathlib import Path;Path('+repr(str(marker))+').write_text("unsafe")')
                with self.assertRaisesRegex(ValueError,'launcher-owned-source-changed'):
                    prepared['_owned_process_loader']()
                self.assertFalse(marker.exists())

    def test_timeout_retains_actual_observer_without_signal(self):
        fixture=lifecycle_fixtures.LifecycleTests();l=fixture.make();self.addCleanup(l.close)
        l.start()
        observer=l.exit_observer
        with patch.object(fixture.child,'wait',side_effect=subprocess.TimeoutExpired('fixture',3)):
            l.close()
        self.assertFalse(observer.closed)
        self.assertIs(l.child,fixture.child)
        self.assertFalse(l.shutdown_receipt['leaderExited'])
        self.assertEqual(l.shutdown_receipt['hardInterruption'],'UNVERIFIED')
        observer.close()


class FinalDeliveryTests(unittest.TestCase):
    pair=StopPipeTests.pair
    # Reuse fixture helpers without re-running the inherited test methods.
    def exchange(self, report):
        a,b=self.pair();errors=[]
        def worker():
            try:b.accept(lambda _:None);b.send_final(report)
            except BaseException as error:errors.append(error)
        thread=threading.Thread(target=worker);thread.start()
        a.request({'session':a.identity['session'],'request':'e'*64})
        result=a.receive_final();thread.join(timeout=2)
        self.assertFalse(thread.is_alive());self.assertEqual(errors,[])
        return a,b,result

    def test_final_delivery_one_shot_after_stop_and_not_descendant_promotion(self):
        report={'status':'PARTIAL','ownedDescendantsComplete':False,'childExit':{'leaderExited':True}}
        a,b,result=self.exchange(report)
        self.assertEqual(result['shutdown'],report)
        with self.assertRaises(ValueError):a.receive_final()
        with self.assertRaises(ValueError):b.send_final(report)
        a,b=self.pair()
        with self.assertRaises(ValueError):a.receive_final()
        with self.assertRaises(ValueError):b.send_final(report)

    def test_authenticated_foreign_final_and_tamper_rejected_without_retry(self):
        for field in ('session','owner','generation','deadline','requestBindingDigest','challenge','kind','shutdown'):
            a,b=self.pair();errors=[]
            def worker():
                try:
                    b.accept(lambda _:None)
                    payload=b._final_payload({'status':'PARTIAL'})
                    envelope=b.seal(payload)
                    payload[field]=0 if field=='deadline' else {'tampered':True} if field=='shutdown' else '0'*64
                    if field!='shutdown':envelope=b.seal(payload)
                    else:envelope['payload']['shutdown']=payload['shutdown']
                    b.send(envelope,budget=65536)
                except BaseException as error:errors.append(error)
            thread=threading.Thread(target=worker);thread.start();a.request(None)
            with self.assertRaises(ValueError):a.receive_final()
            with self.assertRaises(ValueError):a.receive_final()
            thread.join(timeout=2);self.assertEqual(errors,[])

    def test_final_frame_budget_duplicate_json_and_eof(self):
        for raw in (b'x'*65536,b'{"payload":{},"payload":{}}\n',b''):
            a,b=self.pair();errors=[]
            def worker():
                try:
                    b.accept(lambda _:None)
                    if raw:b.handle.sendall(raw)
                    b.close()
                except BaseException as error:errors.append(error)
            thread=threading.Thread(target=worker);thread.start();a.request(None)
            with self.assertRaises(ValueError):a.receive_final()
            thread.join(timeout=2);self.assertEqual(errors,[])

    def test_final_expiry_and_other_child_capability_rejected(self):
        a,b,result=self.exchange({'status':'PARTIAL'})
        a,b=self.pair()
        errors=[]
        def worker():
            try:
                b.accept(lambda _:None)
                b.key='0'*64;b.send_final({'status':'PARTIAL'})
            except BaseException as error:errors.append(error)
        thread=threading.Thread(target=worker);thread.start();a.request(None)
        with self.assertRaises(ValueError):a.receive_final()
        thread.join(timeout=2);self.assertEqual(errors,[])
        a,b=self.pair();a.consumed=True;a.stop_payload=self.message_for_final(a)
        a.clock=lambda:a.identity['deadline']+10
        with self.assertRaisesRegex(ValueError,'stale-owned-final-delivery'):a.receive_final()

    def message_for_final(self,a):
        return {**a.identity,'kind':'STOP','requestBindingDigest':'e'*64,'challenge':'f'*64}

    def test_helper_cleanup_actual_demucs_exit_before_final_report(self):
        import server as helper
        from demucs_receipt import ChildSession
        a,b=self.pair();process=subprocess.Popen([sys.executable,'-c','import sys;sys.stdin.read()'],stdin=subprocess.PIPE,stdout=subprocess.PIPE)
        session=ChildSession.__new__(ChildSession);session.process=process;session.nonce='fixture-child'
        session.processing_binding={'session':a.identity['session'],'request':'e'*64}
        session.exit_observer=OwnedExitObservation(process,session.nonce,{'generation':'fixture'})
        session.exit_observer.bind_request(process,session.processing_binding)
        def cleanup():
            if not process.stdin.closed:process.stdin.close()
            process.wait(timeout=3);process.stdout.close();session.exit_observer.close()
        self.addCleanup(cleanup);errors=[]
        def worker():
            try:
                b.accept(lambda _:None)
                with patch.object(helper,'DEMUCS_SESSION',session):helper.finish_owned_shutdown(b)
            except BaseException as error:errors.append(error)
        thread=threading.Thread(target=worker);thread.start();a.request(session.processing_binding)
        report=a.receive_final()['shutdown'];thread.join(timeout=4)
        self.assertFalse(thread.is_alive());self.assertEqual(errors,[])
        self.assertTrue(report['processingQuiescent']);self.assertTrue(report['childExit']['leaderExited'])
        observation=report['childExit']['ownedExitObservation']
        self.assertEqual(observation['childSession'],session.nonce)
        self.assertTrue(observation['leaderReaped']);self.assertFalse(report['ownedDescendantsComplete'])
        if hasattr(__import__('select'),'kqueue'):self.assertTrue(observation['kernelExitObserved'])
        self.assertEqual(b.key,'')

    def test_helper_final_report_detaches_child_binding_and_exit_evidence(self):
        import server as helper
        from types import SimpleNamespace
        child=SimpleNamespace(nonce='fixture',processing_binding={'input':{'digest':'e'*64}},
            shutdown_receipt={'events':[{'exit':True}]},close=lambda:None)
        with patch.object(helper,'DEMUCS_SESSION',child):report=helper.finish_owned_shutdown(None)
        frozen=copy.deepcopy(report)
        child.processing_binding['input']['digest']='f'*64
        child.shutdown_receipt['events'][0]['exit']=False
        self.assertEqual(report,frozen)
        report['child']['parentBinding']['input']['digest']='0'*64
        report['childExit']['events'][0]['exit']=True
        self.assertEqual(child.processing_binding['input']['digest'],'f'*64)
        self.assertFalse(child.shutdown_receipt['events'][0]['exit'])

    def test_busy_processing_never_fabricates_child_cleanup(self):
        import server as helper
        a,b=self.pair();events=[];helper.PROCESS_LOCK.acquire()
        try:
            def worker():
                b.accept(lambda _:None);events.append(helper.finish_owned_shutdown(b))
            thread=threading.Thread(target=worker);thread.start();a.request(None)
            report=a.receive_final()['shutdown'];thread.join(timeout=2)
            self.assertFalse(thread.is_alive());self.assertFalse(report['processingQuiescent'])
            self.assertIsNone(report['childExit']);self.assertFalse(report['ownedDescendantsComplete'])
        finally:helper.PROCESS_LOCK.release()

    def test_actual_launcher_final_delivery_is_in_authenticated_shutdown_digest(self):
        import hashlib
        fixture=lifecycle_fixtures.LifecycleTests();l=fixture.make();self.addCleanup(l.close)
        source=str(Path(__file__).resolve().parent)
        code="import sys,os,json,socket;sys.path.insert(0,"+repr(source)+");from demucs_receipt import OwnedStopPipe;p=OwnedStopPipe(socket.socket(fileno=int(os.environ['NOVA_OWNED_STOP_FD'])),json.loads(os.environ['NOVA_OWNED_STOP_IDENTITY']),os.environ['NOVA_OWNED_RESULT_CAPABILITY']);p.accept(lambda _:None);p.send_final({'status':'PARTIAL','ownedDescendantsComplete':False});p.close()"
        # Fake health is immediate; synchronize the actual disposable child before
        # exercising the unchanged one-second production stop/final budgets.
        parent_ready,child_ready=socket.socketpair()
        self.addCleanup(parent_ready.close);self.addCleanup(child_ready.close)
        parent_ready.settimeout(5)
        code=code.replace("p.accept(lambda _:None);", "ready=socket.socket(fileno=int(os.environ['NOVA_TEST_READY_FD']));ready.sendall(b'R');assert ready.recv(1)==b'G';ready.close();p.accept(lambda _:None);")
        def spawn(command,**options):
            options['env']=dict(options['env'],NOVA_TEST_READY_FD=str(child_ready.fileno()))
            options['pass_fds']=tuple(options['pass_fds'])+(child_ready.fileno(),)
            return subprocess.Popen(command,**options)
        l.prepared['command']=[sys.executable,'-I','-c',code];l.popen=spawn
        l.start();child_ready.close()
        self.assertEqual(parent_ready.recv(1),b'R')
        parent_ready.sendall(b'G');l.close()
        delivery=l.shutdown_receipt['helperChildShutdownDelivery']
        self.assertEqual(delivery['status'],'OBSERVED');self.assertFalse(delivery['shutdown']['ownedDescendantsComplete'])
        raw=json.dumps(l.shutdown_receipt,sort_keys=True,separators=(',',':')).encode()
        self.assertEqual(l.final_receipt['payload']['shutdownDigest'],hashlib.sha256(raw).hexdigest())
        self.assertEqual(l.final_receipt['payload']['completionState'],'PARTIAL')


if __name__=='__main__':unittest.main()
