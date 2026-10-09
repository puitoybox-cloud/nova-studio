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
    def test_owned_continuity_gate_blocks_publication_delivery_and_acceptance(self):
        self.begin();c=self.channel
        def changed():raise ValueError('changed-owned-helper-at-publication')
        c.continuity=changed
        with self.assertRaisesRegex(ValueError,'changed-owned-helper-at-publication'):self.publish()
        self.assertEqual(c.state,'PROCESSING');self.assertIsNone(c.result)
        c.continuity=None;self.publish();c.continuity=changed
        with self.assertRaisesRegex(ValueError,'changed-owned-helper-at-publication'):self.command('result')
        self.assertEqual(c.state,'RESULT_READY')
        c.continuity=None;r=self.command('result');c.continuity=changed
        with self.assertRaisesRegex(ValueError,'changed-owned-helper-at-publication'):
            self.command('accept',resultId=r['result']['resultId'],output=self.output)
        self.assertEqual(c.state,'DELIVERED');self.assertIsNone(c.accepted_result)

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
    def test_numeric_type_tampering_does_not_compare_equal_to_authentic_receipt(self):
        self.begin();base=self.receipt()
        for field,value in [('version',True),('publicationEligible',0),('output',{**self.output,'byteLength':12.0})]:
            with self.assertRaises(ValueError):self.publish({**base,field:value})
        self.publish(base);result=self.command('result')
        with self.assertRaises(ValueError):self.command('accept',resultId=result['result']['resultId'],output={**self.output,'byteLength':12.0})
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

class AuthorizationTests(unittest.TestCase):
    setUp=ChannelTests.setUp
    command=ChannelTests.command
    receipt=ChannelTests.receipt
    publish=ChannelTests.publish
    def authorize(self,**changes):
        self.inventory['runtimeEvidence']['contractDigest']='e'*64
        binding=processing_binding(self.channel.session,'d'*64,self.input,self.inventory)
        return self.command('authorize',request='d'*64,input=self.input,owner=self.channel.owner,
            expectedInventory=binding['inventoryRevision'],processingContract='e'*64,**changes)
    def admission(self,**changes):
        c=self.channel
        return c.admit({'session':c.session,'capability':c.helper_capability,'ticket':c.authorization['ticket'],
            'binding':c.binding,'processingContract':'e'*64,**changes},self.inventory)
    def test_terminal_close_discards_admission_and_accepted_request_authority(self):
        for failed in (False, True):
            with self.subTest(failed=failed):
                self.setUp(); self.authorize(); self.admission(); self.publish()
                result = self.command('result')['result']
                self.command('accept', resultId=result['resultId'], output=self.output)
                c = self.channel; self.assertTrue(c.admitted); self.assertIsNotNone(c.accepted_result)
                stale_admission = {'session':c.session, 'capability':c.helper_capability,
                    'ticket':c.authorization['ticket'], 'binding':copy.deepcopy(c.binding), 'processingContract':'e'*64}
                c.close(failed=failed)
                self.assertFalse(c.admitted); self.assertIsNone(c.accepted_result)
                for field in ('binding', 'result', 'authorization'): self.assertIsNone(getattr(c, field))
                for action in ('authorize', 'renew', 'result', 'accept', 'stop'):
                    with self.assertRaises(ValueError): self.command(action)
                with self.assertRaises(ValueError): c.admit(stale_admission, self.inventory)

    def test_authorization_exact_binding_one_shot_admission_and_result(self):
        response=self.authorize();auth=response['authorization'];c=self.channel
        self.assertEqual(auth['owner'],hashlib.sha256(c.capability.encode()).hexdigest())
        self.assertEqual(auth['session'],c.session);self.assertEqual(auth['input'],self.input)
        self.assertEqual(auth['capabilityGeneration'],0)
        with self.assertRaisesRegex(ValueError,'unadmitted'):self.publish()
        admission=self.admission();self.assertEqual(admission['bindingDigest'],auth['bindingDigest'])
        with self.assertRaises(ValueError):self.admission()
        self.publish();result=self.command('result');self.command('accept',resultId=result['result']['resultId'],output=self.output)
        self.assertEqual(self.channel.state,'ACCEPTED');self.command('stop');self.assertEqual(self.channel.state,'STOPPING')
    def test_missing_foreign_changed_inventory_contract_owner_denied(self):
        c=self.channel;self.inventory['runtimeEvidence']['contractDigest']='e'*64
        b=processing_binding(c.session,'d'*64,self.input,self.inventory)
        base={'session':c.session,'capability':c.capability,'sequence':0,'action':'authorize','request':'d'*64,
            'input':self.input,'owner':c.owner,'expectedInventory':b['inventoryRevision'],'processingContract':'e'*64}
        for key in ('owner','expectedInventory','processingContract'):
            for value in (None,'f'*64):
                with self.assertRaises(ValueError):c.command({**base,key:value},inventory=self.inventory,eligible=True,helper_alive=True)
                self.assertEqual(c.state,'READY');self.assertEqual(c.sequence,0)
    def test_ticket_tamper_foreign_input_and_inventory_denied(self):
        self.authorize();c=self.channel
        for key,value in [('session','f'*64),('capability','f'*64),('ticket','f'*64),('processingContract','f'*64),
                          ('binding',{**c.binding,'input':{**self.input,'digest':'f'*64}})]:
            with self.assertRaises(ValueError):self.admission(**{key:value})
            self.assertFalse(c.admitted)
        self.inventory['changed']=True
        with self.assertRaises(ValueError):self.admission()
    def test_stale_generation_expiry_and_cancel_reject_admission(self):
        self.authorize();self.command('renew')
        with self.assertRaises(ValueError):self.admission()
        self.now=160
        with self.assertRaises(ValueError):self.admission()
        self.setUp();self.authorize();self.command('stop')
        with self.assertRaises(ValueError):self.admission()
    def test_admitted_generation_change_rejects_publication_delivery_and_acceptance(self):
        self.authorize();self.admission();self.command('renew')
        with self.assertRaisesRegex(ValueError,'changed-owned-authorization-generation'):self.publish()
        self.assertEqual(self.channel.state,'PROCESSING');self.assertIsNone(self.channel.result)
        self.command('stop');self.assertEqual(self.channel.state,'STOPPING')
        for boundary in ('publication','delivery','acceptance'):
            with self.subTest(boundary=boundary):
                self.setUp();self.authorize();self.admission();c=self.channel
                if boundary != 'publication':self.publish()
                if boundary == 'acceptance':result=self.command('result')
                before=c.state;sequence=c.sequence
                def changed():c.renewals += 1
                c.continuity=changed
                with self.assertRaisesRegex(ValueError,'changed-owned-authorization-generation'):
                    if boundary == 'publication':self.publish()
                    elif boundary == 'delivery':self.command('result')
                    else:self.command('accept',resultId=result['result']['resultId'],output=self.output)
                self.assertEqual(c.state,before);self.assertEqual(c.sequence,sequence)
                self.assertIsNone(c.accepted_result)
    def test_legacy_begin_is_not_processing_authority(self):
        self.command('begin',request='d'*64,input=self.input)
        c=self.channel
        with self.assertRaises(ValueError):c.admit({'session':c.session,'capability':c.helper_capability,
            'ticket':'f'*64,'binding':c.binding,'processingContract':'e'*64},self.inventory)

class FinalClosureTests(unittest.TestCase):
    def test_terminal_or_closing_browser_callbacks_cannot_reopen_or_replace_state(self):
        from test_production_lifecycle import LifecycleTests
        from unittest.mock import Mock
        for state, closing in [('SERVER_READY',True),('FAILED',False),('STOPPING',False),
                ('STOPPED',False),('SHUTDOWN_PARTIAL',False),('SHUTDOWN_FAILED',False),('CLOSED',False)]:
            l=LifecycleTests().make(); l.state=state; l.closing=closing
            l.verified_owned_health=Mock(side_effect=AssertionError('late health read'))
            try:
                for event in ['BROWSER_READY','IDENTITY_VERIFIED','FAILED','STOPPED']:
                    with self.subTest(state=state,event=event), self.assertRaisesRegex(ValueError,'stale-browser-receipt'):
                        l.browser_event(event)
                    self.assertEqual(l.state,state)
                l.verified_owned_health.assert_not_called()
            finally: l.close(failed=True)

    def test_failed_summary_transport_error_preserves_failed_completion(self):
        from test_production_lifecycle import LifecycleTests
        for error in [OSError('closed transport'), ValueError('foreign ack')]:
            l=LifecycleTests().make()
            def reject(summary): raise error
            l.final_sink=reject
            try:
                l.start(); l.close(failed=True)
                self.assertEqual(l.final_receipt['payload']['completionState'],'FAILED')
                self.assertEqual(l.shutdown_state,'FAILED')
                self.assertEqual(l.state,'FAILED')
                self.assertEqual(l.control.state,'FAILED')
                self.assertEqual(l.control.ack_key,'')
                self.assertIsNone(l.final_acknowledgement)
                l.close(); self.assertEqual(l.shutdown_state,'FAILED')
            finally: l.close()

    def test_failed_channel_cannot_be_closed_or_summarized_as_success(self):
        from local_distribution_entry import final_lifecycle_receipt, acknowledge_final_lifecycle, _digest
        import hmac
        for repeat_close in [False, True]:
            c=OwnedResultChannel('a'*64,time.monotonic()+20)
            c.close(failed=True)
            if repeat_close: c.close()
            self.assertEqual(c.state,'FAILED')
            summary=final_lifecycle_receipt(c,{'status':'OBSERVED','state':'STOPPING'},
                {'ownedDescendantsComplete':True,'remainingOwnedDescendants':0},True)
            self.assertEqual(summary['payload']['completionState'],'FAILED')
            self.assertFalse(summary['payload']['complete'])
            self.assertEqual(c.state,'FAILED')
            body={'format':'NOVA_FINAL_ACKNOWLEDGEMENT','version':1,'owner':c.owner,'session':c.session,
                'request':None,'bindingDigest':None,'processingContract':None,'generation':0,
                'summaryDigest':_digest(summary['payload']),'auditDigest':c.audit.entries[-1]['digest'],
                'completionState':'FAILED','accepted':True}
            ack={'payload':body,'authentication':hmac.new(c.ack_key.encode(),
                json.dumps(body,sort_keys=True,separators=(',',':')).encode(),hashlib.sha256).hexdigest()}
            self.assertFalse(acknowledge_final_lifecycle(c,ack)['complete'])
            with self.assertRaises(ValueError): acknowledge_final_lifecycle(c,ack)

    def test_partial_final_authentication_after_invalidation_and_duplicate_snapshot(self):
        import hmac
        from local_distribution_entry import final_lifecycle_receipt
        c=OwnedResultChannel('a'*64,time.monotonic()+20);key=c.capability
        result=final_lifecycle_receipt(c,{'status':'OBSERVED','state':'STOPPING'},
            {'leaderExited':True,'complete':False},True)
        self.assertFalse(result['payload']['complete']);self.assertEqual(result['payload']['completionState'],'PARTIAL')
        self.assertIsNone(result['payload']['remainingOwnedDescendants']);self.assertEqual(c.capability,'');self.assertEqual(c.final_key,'')
        raw=json.dumps(result['payload'],sort_keys=True,separators=(',',':')).encode()
        self.assertEqual(result['authentication'],hmac.new(key.encode(),raw,hashlib.sha256).hexdigest())
        again=final_lifecycle_receipt(c,{}, {},False);self.assertEqual(again,result)
        again['payload']['complete']=True;self.assertFalse(c.final_receipt['payload']['complete'])
    def test_leader_stop_transport_alone_and_boolean_count_cannot_complete(self):
        from local_distribution_entry import final_lifecycle_receipt
        for shutdown,stop,closed in [({'leaderExited':True},{'status':'OBSERVED','state':'STOPPING'},True),
            ({'ownedDescendantsComplete':True,'remainingOwnedDescendants':False},{'status':'OBSERVED','state':'STOPPING'},True),
            ({'ownedDescendantsComplete':True,'remainingOwnedDescendants':0},{'status':'UNVERIFIED'},True),
            ({'ownedDescendantsComplete':True,'remainingOwnedDescendants':0},{'status':'OBSERVED','state':'STOPPING'},False)]:
            c=OwnedResultChannel('a'*64,time.monotonic()+20)
            self.assertFalse(final_lifecycle_receipt(c,stop,shutdown,closed)['payload']['complete'])
    def test_close_private_sink_receipt_no_admission_or_reopen(self):
        from test_production_lifecycle import LifecycleTests
        l=LifecycleTests().make();seen=[];l.final_sink=seen.append
        try:
            l.start();l.close();self.assertEqual(len(seen),1)
            self.assertEqual(seen[0]['payload']['completionState'],'PARTIAL')
            self.assertTrue(seen[0]['payload']['transportClosed']);self.assertTrue(seen[0]['payload']['capabilityInvalidated'])
            self.assertEqual(l.shutdown_state,'PARTIAL')
            with self.assertRaisesRegex(ValueError,'closed-helper-admission'):l.control_event('/owned-helper-admit',{})
            l.close();self.assertEqual(len(seen),1)
        finally:l.close()

class SafeInterruptionAdapterTests(unittest.TestCase):
    def test_no_operation_until_fresh_live_handle_proof_and_one_use(self):
        from local_distribution_entry import OwnedChildInterruptionAdapter
        handle=object();operations=[]
        def verify(h,o,n):return {'owner':o,'challenge':n,'liveHandleVerified':True,'scope':'EXACT_OWNED_HANDLE'}
        def interrupt(h,o,n,t):
            operations.append(h);return {'owner':o,'challenge':n,'liveHandleVerified':True,'ownedChildrenComplete':True,'stopped':True}
        adapter=OwnedChildInterruptionAdapter(handle,'a'*64,verify,interrupt)
        with self.assertRaises(ValueError):adapter(object(),'a'*64,1)
        with self.assertRaises(ValueError):adapter(handle,'b'*64,1)
        self.assertEqual(operations,[]);self.assertTrue(adapter(handle,'a'*64,1)['stopped'])
        with self.assertRaises(ValueError):adapter(handle,'a'*64,1)
        self.assertEqual(operations,[handle])
    def test_partial_foreign_stale_verifier_never_executes(self):
        from local_distribution_entry import OwnedChildInterruptionAdapter
        handle=object();operations=[]
        for kind in ('partial','foreign','stale'):
            clock=[100.]
            def verify(h,o,n):
                if kind=='stale':clock[0]+=4
                return {'owner':'b'*64 if kind=='foreign' else o,'challenge':n,
                    'liveHandleVerified':kind!='partial','scope':'EXACT_OWNED_HANDLE'}
            adapter=OwnedChildInterruptionAdapter(handle,'a'*64,verify,lambda *args:operations.append(args),clock=lambda:clock[0])
            with self.assertRaises(ValueError):adapter(handle,'a'*64,1)
        self.assertEqual(operations,[])
    def test_demucs_timeout_retains_handle_without_pid_signals(self):
        import io
        from demucs_receipt import ChildSession
        from types import SimpleNamespace
        child=SimpleNamespace(stdin=io.StringIO(),stdout=io.StringIO(),poll=lambda:None,
            wait=lambda **kwargs:(_ for _ in ()).throw(subprocess.TimeoutExpired('fixture',3)))
        session=ChildSession.__new__(ChildSession);session.process=child;session.receipt={}
        with patch('os.kill') as kill,patch('os.killpg') as group:
            session.close();self.assertIs(session.process,child)
            self.assertFalse(session.shutdown_receipt['complete']);self.assertTrue(child.stdin.closed)
            kill.assert_not_called();group.assert_not_called()

class Stage2CategoryTests(unittest.TestCase):
    def test_category_separation_and_no_runtime_formal_promotion(self):
        from local_distribution_entry import stage2_software_closure
        initial=stage2_software_closure({});self.assertFalse(initial['repositorySoftwareComplete'])
        evidence={r['requirement']:True for r in initial['requirements'] if r['category']=='A'}
        r=stage2_software_closure(evidence);self.assertTrue(r['repositorySoftwareComplete'])
        self.assertEqual(r['pureSoftwareBlockedBy'],[]);self.assertEqual(r['formalA'],0)
        self.assertEqual(r['stage2'],'OPEN');self.assertEqual(r['stage3Gate'],'NOT_PASSED')
        self.assertTrue(all(not x['satisfied'] for x in r['requirements'] if x['category']!='A'))
    def test_expanded_scoped_native_network_lookup_not_kernel_proof(self):
        with patch('sys.addaudithook'):guard=OfflineRuntimeGuard()
        for name in ('getaddrinfo_a','ares_getaddrinfo','ares_query','curl_multi_poll','SSL_set_fd','nw_endpoint_create_host'):
            with self.assertRaises(PermissionError):guard.audit('ctypes.dlsym',(None,name))
        self.assertFalse(guard.snapshot()['nativeNetworkVerified'])
