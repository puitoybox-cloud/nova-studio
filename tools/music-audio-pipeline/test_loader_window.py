"""Owned-call audit and transition regressions, never native isolation acceptance."""
import copy
import ctypes
import hashlib
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import runtime_evidence as e


class LoaderWindowTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(); self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name); self.path = self.root/'child.so'; self.path.write_bytes(b'fixture')
        self.entry = {'id': 'child', 'path': 'child.so', 'digest': hashlib.sha256(b'fixture').hexdigest(),
            'byteLength': 7, 'version': '1', 'module': None, 'kind': 'SHARED_LIBRARY'}
        self.contract = {'native': [self.entry], 'buildRevision': 'test'}
    def window(self): return e.ScopedLoaderWindow(self.root, self.contract, ['child'], 'a'*64)
    def test_real_ctypes_undeclared_load_blocked_before_loader(self):
        window = self.window()
        with window, self.assertRaises(PermissionError): ctypes.CDLL(None)
        self.assertTrue(window.snapshot()['blocked']); self.assertFalse(window.snapshot()['complete'])
        self.assertEqual(window.events[0]['classification'], 'UNEXPECTED_ATTEMPT')
        self.assertNotIn(str(self.root), json.dumps(window.snapshot()))
    def test_declared_attempt_is_disk_bound_never_runtime_edge(self):
        with self.window() as window: sys.audit('ctypes.dlopen', str(self.path))
        receipt = window.snapshot(); entry = receipt['entries'][0]
        self.assertEqual(entry['artifactDigest'], self.entry['digest'])
        self.assertFalse(entry['runtimeEdgeVerified']); self.assertFalse(entry['actualDispatchVerified'])
        self.assertEqual(receipt['hiddenTransientCoverage'], 'UNVERIFIED')
    def test_alternate_parent_dot_and_oversized_paths_are_not_normalized(self):
        for target in (str(self.root)+'/undeclared/../child.so',
                       str(self.root)+'/./child.so', 'x'*4097):
            with self.window() as window, self.assertRaises(PermissionError): sys.audit('ctypes.dlopen', target)
            self.assertEqual(window.events[0]['classification'], 'UNEXPECTED_ATTEMPT')
            self.assertNotIn(target, json.dumps(window.snapshot()))

    def test_changed_artifact_and_unrequested_fail_closed(self):
        self.path.write_bytes(b'changed')
        with self.window() as window, self.assertRaises(PermissionError): sys.audit('ctypes.dlopen', str(self.path))
        self.assertEqual(window.events[0]['classification'], 'INVALID_ARTIFACT_ATTEMPT')
        window = e.ScopedLoaderWindow(self.root, self.contract, [], 'a'*64)
        with window, self.assertRaises(PermissionError): sys.audit('ctypes.dlopen', str(self.path))
    def test_budget_and_caught_denial_remain_visible(self):
        with self.window() as window:
            for _ in range(256): sys.audit('ctypes.dlopen', str(self.path))
            with self.assertRaises(PermissionError): sys.audit('ctypes.dlopen', str(self.path))
        self.assertTrue(window.snapshot()['overflow']); self.assertEqual(len(window.events), 256)
    def test_nested_window_rejected_outer_retained(self):
        with self.window() as outer:
            with self.assertRaises(ValueError):
                with self.window(): pass
            sys.audit('ctypes.dlopen', str(self.path))
        self.assertEqual(len(outer.events), 1)
    def test_scope_releases_on_exception(self):
        with self.assertRaises(RuntimeError):
            with self.window(): raise RuntimeError('test')
        sys.audit('ctypes.dlopen', None)  # no active window
    def test_symbol_lookup_is_attempt_not_dispatch(self):
        api = type('Api', (), {'_name': str(self.path)})()
        with self.window() as window: sys.audit('ctypes.dlsym', api, 'symbol')
        self.assertEqual(window.events[0]['event'], 'ctypes.dlsym')
        self.assertFalse(window.events[0]['actualDispatchVerified'])
    def test_transition_new_disappeared_and_hidden_limit(self):
        before = {'contractRevision': 'a'*64, 'expected': ['a','b'], 'observed': ['a'],
            'unexpected': [], 'unresolved': ['b'], 'ambiguous': []}
        after = copy.deepcopy(before); after.update(observed=['b'], unresolved=['a'])
        value = e.scoped_load_transition(before, after)
        self.assertEqual(value['newlyObserved'], ['b']); self.assertEqual(value['disappeared'], ['a'])
        self.assertEqual(value['transient'], 'UNVERIFIED_BETWEEN_SNAPSHOTS'); self.assertFalse(value['complete'])
        after['contractRevision'] = 'b'*64
        with self.assertRaises(ValueError): e.scoped_load_transition(before, after)
    def test_partial_loader_evidence_blocks_even_verified_stage_labels(self):
        from test_processing_closure import fixture_inventory, binding, complete_calls
        inventory = fixture_inventory(); identity = binding(inventory); receipt = e.BoundProcessingReceipt(identity)
        calls = complete_calls(); calls['entries'][0]['callIdentity'] = 'a'*64
        calls['entries'][0]['loaderCallEvidence'] = {'complete': False, 'callIdentity':'a'*64}
        receipt.add_calls(calls); value = receipt.finish(identity, inventory, {'digest':'d'*64,'byteLength':1})
        self.assertFalse(value['complete']); self.assertIn('partial-or-invalid-loader-call-evidence', value['blockedBy'])
        self.assertEqual(value['nativeStages'][0]['callCount'], 1)
    def test_label_promotion_and_wrong_digest_cannot_complete(self):
        from test_processing_closure import fixture_inventory, binding, complete_calls
        for update in ({'complete': True}, {'complete': True, 'runtimeParentChildEdges':'VERIFIED',
                'actualNativeDispatch':'VERIFIED', 'entries':[], 'eventsDigest':'f'*64}):
            inventory = fixture_inventory(); identity = binding(inventory)
            receipt = e.BoundProcessingReceipt(identity); calls = complete_calls()
            call = calls['entries'][0]; call['callIdentity'] = 'a'*64
            call['loaderCallEvidence'] = dict(update, callIdentity='a'*64)
            receipt.add_calls(calls)
            result = receipt.finish(identity, inventory, {'digest':'d'*64,'byteLength':1})
            self.assertFalse(result['processingEligible'])
            self.assertIn('partial-or-invalid-loader-call-evidence', result['blockedBy'])

    def backend(self):
        from test_native_routing import NativeRoutingTests
        helper = NativeRoutingTests(); helper.root = self.root
        return helper.backend()
    def test_caught_undeclared_attempt_still_fails_processing(self):
        module, contract, mapped = self.backend()
        calls = e.ProcessingReceipt(self.root, contract)
        def caught():
            try: ctypes.CDLL(None)
            except PermissionError: pass
        with patch.dict(sys.modules, {'owned': module}), patch.object(e, 'mapped_native_receipts', return_value=mapped):
            with self.assertRaisesRegex(ValueError, 'blocked-scoped-loader'):
                calls.call('inference', 'inference', module.run, caught)
        call = calls.entries[0]
        self.assertTrue(call['loaderCallEvidence']['blocked']); self.assertEqual(call['status'], 'FAILED')
        self.assertFalse(call['completed'])
    def test_failed_backend_retains_attempt_receipt_and_releases_window(self):
        module, contract, mapped = self.backend(); calls = e.ProcessingReceipt(self.root, contract)
        def failed(): raise RuntimeError('backend-failed')
        with patch.dict(sys.modules, {'owned': module}), patch.object(e, 'mapped_native_receipts', return_value=mapped):
            with self.assertRaises(RuntimeError): calls.call('inference', 'inference', module.run, failed)
        self.assertFalse(calls.entries[0]['completed']); self.assertIn('loaderCallEvidence', calls.entries[0])
        sys.audit('ctypes.dlopen', None)
    def test_call_id_is_fresh_between_receipt_instances(self):
        module, contract, mapped = self.backend(); identities = []
        with patch.dict(sys.modules, {'owned': module}), patch.object(e, 'mapped_native_receipts', return_value=mapped):
            for _ in range(2):
                calls = e.ProcessingReceipt(self.root, contract); calls.call('inference', 'inference', module.run)
                identities.append(calls.entries[0]['callIdentity'])
                self.assertFalse(calls.entries[0]['nativeLoadTransition']['complete'])
        self.assertNotEqual(*identities)
    def test_worker_thread_is_explicitly_uncovered(self):
        import threading
        with self.window() as window:
            thread = threading.Thread(target=lambda: sys.audit('ctypes.dlopen', None))
            thread.start(); thread.join(timeout=2)
            self.assertFalse(thread.is_alive())
        self.assertEqual(window.events, [])
        self.assertIn('worker-thread-loads', window.snapshot()['excluded'])

    def test_network_symbol_alias_bytes_and_ordinals_in_owned_child(self):
        script = '''
import sys, json
from runtime_inventory import OfflineRuntimeGuard
g = OfflineRuntimeGuard()
blocked = 0
for symbol in (b'connect', 'connect$NOCANCEL', 'connect$UNIX2003', 'syscall', 'res_query', 1):
    try: sys.audit('ctypes.dlsym', object(), symbol)
    except PermissionError: blocked += 1
print(json.dumps({'blocked':blocked, 'snapshot':g.snapshot()}))
'''
        result = subprocess.run([sys.executable, '-c', script], cwd=Path(__file__).parent,
            capture_output=True, text=True, timeout=10, check=True)
        value = json.loads(result.stdout); self.assertEqual(value['blocked'], 6)
        self.assertFalse(value['snapshot']['nativeNetworkVerified'])


if __name__ == '__main__': unittest.main()
