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
            with patch.object(launcher,'load_manifest',return_value={'assets':list(assets.values())}),patch.object(launcher,'bootstrap',return_value=runtime),patch.object(launcher,'load_contract',return_value={}),patch.object(launcher,'verify_assembly',return_value={'complete':True}),patch('runtime_evidence.load',return_value={'buildRevision':'build'}),patch('runtime_evidence.assembly_evidence',return_value={'complete':False}):
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


if __name__=='__main__':unittest.main()
