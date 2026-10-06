"""Disposable owned channel/transport fixtures; no native or physical attestation."""
import copy
import hashlib
import http.client
import json
import socket
import subprocess
import time
import unittest
from unittest.mock import patch
from local_distribution_entry import OwnedResultChannel, bounded_owned_shutdown, LocalEnvelopeServer
from runtime_evidence import ScopedPythonDispatch, processing_binding
from runtime_inventory import OfflineRuntimeGuard

class ChannelTests(unittest.TestCase):
    def setUp(self):
        self.now=100.;self.channel=OwnedResultChannel('a'*64,160.,clock=lambda:self.now,wall=lambda:1000+self.now)
        from test_processing_closure import fixture_inventory
        self.inventory=fixture_inventory()
        self.input={'digest':'b'*64,'byteLength':7};self.output={'digest':'c'*64,'byteLength':12}
    def command(self,action,**extra):
        c=self.channel
        return c.command({'session':c.session,'capability':c.capability,'sequence':c.sequence,'action':action,**extra},
            inventory=self.inventory,eligible=True,helper_alive=True)
    def receipt(self):
        from runtime_evidence import BoundProcessingReceipt
        from test_processing_closure import complete_calls
        bound=BoundProcessingReceipt(self.channel.binding)
        bound.add_calls(complete_calls())
        return bound.finish(self.channel.binding,self.inventory,self.output)
    def begin(self):self.command('begin',request='d'*64,input=self.input)
    def publish(self,receipt=None,**extra):
        c=self.channel
        value=self.receipt()
        c.publish({'session':c.session,'capability':c.helper_capability,'receipt':receipt or value,**extra},self.inventory)
    def test_one_shot_result_acceptance_output_bound(self):
        self.begin();self.publish();r=self.command('result')
        self.assertEqual(r['state'],'DELIVERED');self.assertEqual(r['result']['output'],self.output)
        with self.assertRaises(ValueError):self.command('result')
        with self.assertRaises(ValueError):self.command('accept',resultId=r['result']['resultId'],output={**self.output,'digest':'e'*64})
        self.command('accept',resultId=r['result']['resultId'],output=self.output)
        self.assertEqual(self.channel.state,'ACCEPTED')
        with self.assertRaises(ValueError):self.command('accept',resultId=r['result']['resultId'],output=self.output)
    def test_wrong_owner_sequence_capability_and_helper_dead(self):
        c=self.channel
        valid={'session':c.session,'capability':c.capability,'sequence':0,'action':'renew'}
        for key,value in [('session','f'*64),('capability','f'*64),('sequence',1),('sequence',False),('action','other')]:
            with self.assertRaises(ValueError):c.command({**valid,key:value},inventory=self.inventory,eligible=True,helper_alive=True)
        with self.assertRaises(ValueError):c.command(valid,inventory=self.inventory,eligible=True,helper_alive=False)
        self.assertEqual(c.sequence,0)
    def test_renewal_rotates_bounded_same_session_no_helper_authority_extension(self):
        c=self.channel;old=c.capability;helper=c.helper_capability;deadline=c.deadline
        self.now=110;self.command('renew');self.assertNotEqual(old,c.capability)
        self.assertEqual(c.helper_capability,helper);self.assertEqual(c.session,'a'*64);self.assertEqual(c.deadline,deadline)
        self.now=130;self.command('renew');self.assertEqual(c.expires,deadline)
        with self.assertRaises(ValueError):self.command('renew')
        self.now=160
        with self.assertRaises(ValueError):self.command('stop')
    def test_stale_renewal_and_expired_capability(self):
        c=self.channel;old={'session':c.session,'capability':c.capability,'sequence':0,'action':'renew'}
        self.command('renew')
        with self.assertRaises(ValueError):c.command(old,inventory=self.inventory,eligible=True,helper_alive=True)
        self.now=140
        with self.assertRaises(ValueError):self.command('renew')
    def test_partial_changed_foreign_replay_and_cancel_result(self):
        self.begin();c=self.channel
        base=self.receipt()
        for key,value in [('binding',{**base['binding'],'request':'e'*64}),('complete',False),('status','OBSERVED_UNVERIFIED'),
                          ('processingEligible',False),('blockedBy',['native']),('output',{**self.output,'byteLength':0})]:
            with self.assertRaises(ValueError):self.publish({**base,key:value})
        with self.assertRaises(ValueError):self.publish(capability=c.capability)
        self.inventory['changed']=True
        with self.assertRaises(ValueError):self.publish(base)
        del self.inventory['changed'];self.publish(base)
        with self.assertRaises(ValueError):self.publish(base)
        self.command('stop')
        with self.assertRaises(ValueError):self.publish(base)
    def test_changed_inventory_after_publication_blocks_delivery_and_acceptance(self):
        self.begin();self.publish();self.inventory['changed']=True
        with self.assertRaises(ValueError):self.command('result')
        del self.inventory['changed'];result=self.command('result')
        self.inventory['changed']=True
        with self.assertRaises(ValueError):self.command('accept',resultId=result['result']['resultId'],output=self.output)
        self.assertEqual(self.channel.state,'DELIVERED')
    def test_tampered_stages_and_native_digest_rejected_without_label_promotion(self):
        self.begin();base=self.receipt()
        for field in ['stages','nativeStages','entries','children','nativeClosureComplete','networkContainment']:
            altered=copy.deepcopy(base);altered[field]=[] if isinstance(altered[field],list) else 'UNVERIFIED'
            if altered != base:
                with self.assertRaises(ValueError):self.publish(altered)
        call=base['entries'][0];call.update(callIdentity='e'*64,dispatchEvidence={'actualNativeDispatch':'VERIFIED'})
        with self.assertRaises(ValueError):self.publish(base)
    def test_ineligible_or_duplicate_begin(self):
        c=self.channel;value={'session':c.session,'capability':c.capability,'sequence':0,'action':'begin','request':'d'*64,'input':self.input}
        with self.assertRaises(ValueError):c.command(value,inventory=self.inventory,eligible=False,helper_alive=True)
        self.begin()
        with self.assertRaises(ValueError):self.command('begin',request='e'*64,input=self.input)
    def test_expired_result_and_invalid_session(self):
        self.begin();self.now=160
        with self.assertRaises(ValueError):self.publish()
        for deadline in [99,401,float('nan')]:
            with self.assertRaises(ValueError):OwnedResultChannel('a'*64,deadline,clock=lambda:100)
    def test_close_invalidates_secrets_and_receipts(self):
        self.begin();self.publish();self.channel.close()
        self.assertEqual(self.channel.capability,'');self.assertEqual(self.channel.helper_capability,'')
        self.assertIsNone(self.channel.result)
        with self.assertRaises(ValueError):self.command('result')

class HardInterruptionTests(unittest.TestCase):
    class Child:
        def __init__(self):self.exited=False
        def poll(self):return 0 if self.exited else None
        def wait(self,timeout=None):raise subprocess.TimeoutExpired('fixture',timeout)
    def test_no_signal_even_hung_or_exited_leader(self):
        child=self.Child()
        with patch('os.kill') as kill,patch('os.killpg') as group:
            result=bounded_owned_shutdown(child)
            self.assertFalse(result['complete']);self.assertFalse(result['ownershipReleased'])
            self.assertEqual(result['hardInterruption'],'UNVERIFIED');kill.assert_not_called();group.assert_not_called()
            child.exited=True;self.assertFalse(bounded_owned_shutdown(child)['ownershipReleased'])
    def test_foreign_partial_interruption_and_budget_rejected(self):
        child=self.Child()
        for proof in [{'owner':'b'*64,'liveHandleVerified':True,'ownedChildrenComplete':True,'stopped':True},
                      {'owner':'a'*64,'liveHandleVerified':False,'ownedChildrenComplete':True,'stopped':True}]:
            with self.assertRaises(ValueError):bounded_owned_shutdown(child,owner='a'*64,interruption=lambda *args:proof)
        with self.assertRaises(ValueError):bounded_owned_shutdown(child,timeout=4)
    def test_valid_external_adapter_is_observed_not_native_verified(self):
        child=self.Child()
        def adapter(handle,owner,timeout):
            self.assertIs(handle,child);child.exited=True
            return {'owner':owner,'liveHandleVerified':True,'ownedChildrenComplete':True,'stopped':True}
        r=bounded_owned_shutdown(child,owner='a'*64,interruption=adapter)
        self.assertEqual(r['hardInterruption'],'OBSERVED');self.assertFalse(r['complete'])

class NativeBoundaryTests(unittest.TestCase):
    def test_real_c_boundary_entry_return_not_native_artifact_proof(self):
        def backend():return len([1,2])
        with ScopedPythonDispatch(backend,'fixture') as window:self.assertEqual(backend(),2)
        r=window.snapshot(True);events=r['nativeBoundary']['entries']
        self.assertEqual([v['event'] for v in events],['c_call','c_return'])
        self.assertEqual(events[0]['operation'],events[1]['operation']);self.assertEqual(events[0]['name'],'len')
        self.assertEqual(r['nativeBoundary']['artifactIdentity'],'UNVERIFIED');self.assertFalse(r['nativeBoundary']['complete'])
        self.assertEqual(r['actualNativeDispatch'],'UNVERIFIED')
    def test_exception_and_budget_remain_partial(self):
        def backend():return int('not-a-number')
        with self.assertRaises(ValueError):
            with ScopedPythonDispatch(backend,'fixture') as window:backend()
        self.assertTrue(window.snapshot(False)['nativeBoundary']['partial'])
        def overflow():
            for _ in range(200):len([])
        with self.assertRaisesRegex(PermissionError,'budget'):
            with ScopedPythonDispatch(overflow,'fixture') as window:overflow()
        self.assertTrue(window.snapshot(False)['overflow'])

class SocketPermissionTests(unittest.TestCase):
    def guard(self):
        with patch('sys.addaudithook'):return OfflineRuntimeGuard()
    def test_only_exact_socket_one_connect_no_dns_or_external(self):
        guard=self.guard()
        with socket.socket() as own,socket.socket() as foreign:
            with guard.permit_owned_socket(own,('127.0.0.1',12345)):
                for args in [(foreign,('127.0.0.1',12345)),(own,('127.0.0.1',12346)),(own,('203.0.113.1',12345))]:
                    with self.assertRaises(PermissionError):guard.audit('socket.connect',args)
                with self.assertRaises(PermissionError):guard.audit('socket.getaddrinfo',('localhost',12345))
                guard.audit('socket.connect',(own,('127.0.0.1',12345)))
                with self.assertRaises(PermissionError):guard.audit('socket.connect',(own,('127.0.0.1',12345)))
            self.assertFalse(guard.snapshot()['nativeNetworkVerified'])
    def test_invalid_nested_and_exception_cleanup(self):
        guard=self.guard()
        with socket.socket() as own:
            for address in [('localhost',1),('127.0.0.1',True),('0.0.0.0',1)]:
                with self.assertRaises(ValueError):guard.permit_owned_socket(own,address)
            with self.assertRaises(RuntimeError):
                with guard.permit_owned_socket(own,('127.0.0.1',1)):
                    with self.assertRaises(ValueError):
                        with guard.permit_owned_socket(own,('127.0.0.1',1)):pass
                    raise RuntimeError('fixture')
            with self.assertRaises(PermissionError):guard.audit('socket.connect',(own,('127.0.0.1',1)))

class PrivateTransportTests(unittest.TestCase):
    def test_private_control_http_origin_denial_and_sequence_replay(self):
        from test_production_lifecycle import LifecycleTests
        fixture=LifecycleTests();lifecycle=fixture.make();server=lifecycle.server
        # Isolated transport contract. Synthetic eligibility, not production acceptance.
        channel=lifecycle.control
        server.on_control=lambda route,value:channel.command(value,inventory={},eligible=True,helper_alive=True)
        server.start()
        self.assertTrue(server.server.daemon_threads);self.assertFalse(server.server.block_on_close)
        def post(value,origin=None):
            c=http.client.HTTPConnection('127.0.0.1',server.server.server_port,timeout=3)
            headers={'Content-Type':'application/json'}
            if origin:headers['Origin']=origin
            c.request('POST','/owned-control',json.dumps(value),headers);r=c.getresponse();status=r.status;r.read();c.close();return status
        value={'session':channel.session,'capability':channel.capability,'sequence':0,'action':'renew'}
        try:
            self.assertEqual(post(value,server.origin),403);self.assertEqual(channel.sequence,0)
            self.assertEqual(post({**value,'capability':'f'*64}),403)
            self.assertEqual(post(value),200);self.assertEqual(post(value),403)
        finally:server.close();channel.close()

if __name__=='__main__':unittest.main()

class ProductionOwnershipTests(unittest.TestCase):
    def test_native_launcher_adapter_private_handoff_and_dead_helper_fail_closed(self):
        from test_production_lifecycle import LifecycleTests
        fixture=LifecycleTests();l=fixture.make();seen=[]
        l.native_host=lambda value:seen.append(value)
        try:
            result=l.start();private=seen[0]['ownedControl']['capability']
            self.assertNotIn(private,result['startURL']);self.assertNotIn('ownedControl',result['handoff'])
            self.assertNotEqual(private,l.server.nonce);self.assertNotEqual(private,l.control.helper_capability)
            fixture.child.exited=True
            with self.assertRaisesRegex(ValueError,'unexpected-helper'):
                l.control_event('/owned-control',{'session':l.control.session,'capability':private,'sequence':0,'action':'stop'})
            self.assertEqual(l.state,'FAILED');self.assertEqual(l.control.state,'FAILED');self.assertTrue(l.done.is_set())
            self.assertFalse(l.eligibility['processingEligible'])
        finally:l.close(failed=True)
    def test_server_start_never_extends_already_issued_helper_deadline(self):
        from test_production_lifecycle import LifecycleTests
        fixture=LifecycleTests();l=fixture.make();before=l.server.deadline
        try:l.start();self.assertEqual(l.server.deadline,before);self.assertEqual(l.control.deadline,before)
        finally:l.close()
    def test_no_private_stop_capability_rejected_by_helper(self):
        from test_processing_closure import ProcessingHTTPTests
        import os
        import threading
        ProcessingHTTPTests.setUpClass();module=ProcessingHTTPTests.server_module
        server=module.ThreadingHTTPServer(('127.0.0.1',0),module.Handler)
        thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
        try:
            with patch.dict(os.environ,{'NOVA_LIFECYCLE_SESSION':'a'*64,'NOVA_LIFECYCLE_DEADLINE':str(time.monotonic()+20),
                    'NOVA_OWNED_RESULT_CAPABILITY':'b'*64}),patch.object(module,'STRICT_BOOTSTRAP',True):
                c=http.client.HTTPConnection('127.0.0.1',server.server_port,timeout=3)
                c.request('POST','/owned-stop',body=b'',headers={'Host':'127.0.0.1:8766','X-Nova-Session':'a'*64,'X-Nova-Owned-Capability':'c'*64})
                r=c.getresponse();self.assertEqual(r.status,403);r.read();c.close()
                self.assertFalse(module.OWNED_STOP_REQUESTED.is_set())
        finally:server.shutdown();server.server_close();thread.join(timeout=3)

class AuthenticatedStopTests(unittest.TestCase):
    def test_authenticated_stop_cancels_owned_admission_and_only_acknowledges_stopping(self):
        from test_processing_closure import ProcessingHTTPTests
        import os
        import threading
        ProcessingHTTPTests.setUpClass();module=ProcessingHTTPTests.server_module
        server=module.ThreadingHTTPServer(('127.0.0.1',0),module.Handler)
        thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
        event=threading.Event()
        from runtime_evidence import SessionRequestRegistry
        registry=SessionRequestRegistry('a'*64)
        try:
            with patch.dict(os.environ,{'NOVA_LIFECYCLE_SESSION':'a'*64,'NOVA_LIFECYCLE_DEADLINE':str(time.monotonic()+20),
                    'NOVA_OWNED_RESULT_CAPABILITY':'b'*64}),patch.object(module,'STRICT_BOOTSTRAP',True),\
                    patch.object(module,'OWNED_STOP_REQUESTED',event),patch.object(module,'PROCESSING_ATTEMPTS',registry):
                def stop(origin=None):
                    c=http.client.HTTPConnection('127.0.0.1',server.server_port,timeout=3)
                    headers={'Host':'127.0.0.1:8766','X-Nova-Session':'a'*64,'X-Nova-Owned-Capability':'b'*64}
                    if origin:headers['Origin']=origin
                    c.request('POST','/owned-stop',body=b'',headers=headers);r=c.getresponse();status=r.status;body=json.loads(r.read());c.close();return status,body
                status,_=stop('http://127.0.0.1:18766');self.assertEqual(status,403);self.assertFalse(event.is_set())
                status,body=stop();self.assertEqual(status,200)
                self.assertEqual(body,{'format':'NOVA_OWNED_STOP_RECEIPT','version':1,'session':'a'*64,'state':'STOPPING'})
                self.assertTrue(event.is_set());self.assertTrue(registry.closed)
                with self.assertRaises(ValueError):module.require_owned_session('a'*64)
                self.assertNotIn('complete',body)
        finally:server.shutdown();server.server_close();thread.join(timeout=3)
