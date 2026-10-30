"""Local disposable child, never ML or physical Mac acceptance."""
import hashlib
import json
import os
import select
import subprocess
import sys
import unittest
from unittest.mock import patch
from demucs_receipt import OwnedExitObservation


class OwnedExitObservationTests(unittest.TestCase):
    def child(self):
        process=subprocess.Popen([sys.executable,'-I','-c',
            "import sys; print('ready',flush=True); sys.stdin.read()"],
            stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,text=True)
        self.assertEqual(process.stdout.readline(),'ready\n')
        def cleanup():
            if not process.stdin.closed:process.stdin.close()
            process.wait(timeout=3);process.stdout.close()
        self.addCleanup(cleanup)
        return process

    def test_real_creator_child_registers_exit_and_closes_descriptor(self):
        process=self.child();observer=OwnedExitObservation(process,'fixture-session',{'build':'fixture-generation'})
        self.addCleanup(observer.close)
        before=observer.observe(process,{'request':'fixture-request'})
        expected='REGISTERED_OWNED_CHILD_EXIT_ONLY' if hasattr(select,'kqueue') else 'UNSUPPORTED'
        self.assertEqual(before['kernelExitSubscription'],expected)
        self.assertFalse(before['leaderReaped']);self.assertFalse(before['kernelExitObserved'])
        self.assertFalse(before['ownedDescendantsComplete']);self.assertEqual(before['liveInterruptionHandle'],'UNVERIFIED')
        self.assertNotIn('pid',before)
        if observer.queue is not None:self.assertFalse(os.get_inheritable(observer.queue.fileno()))
        process.stdin.close();process.wait(timeout=3)
        after=observer.observe(process)
        self.assertTrue(after['leaderReaped'])
        self.assertEqual(after['kernelExitObserved'],hasattr(select,'kqueue'))
        observer.close();self.assertTrue(observer.observe(process)['descriptorClosed'])

    def test_foreign_process_and_creator_rejected_without_signals(self):
        process=self.child();observer=OwnedExitObservation(process,'session',{'build':'fixture'})
        self.addCleanup(observer.close)
        with self.assertRaisesRegex(ValueError,'foreign-owned-exit-observation'):observer.observe(object())
        with patch('demucs_receipt.os.getpid',return_value=observer.creator+1):
            with self.assertRaisesRegex(ValueError,'foreign-owned-exit-observation'):observer.observe(process)

    def test_reaped_child_does_not_register_recycled_pid(self):
        process=self.child();process.stdin.close();process.wait(timeout=3)
        observer=OwnedExitObservation(process,'session',{'build':'fixture'})
        self.assertIsNone(observer.queue);self.assertEqual(observer.status,'UNVERIFIED')
        self.assertFalse(observer.observe(process)['kernelExitObserved'])
        observer.close()

    def test_generation_and_request_bound_without_paths_or_pid_disclosure(self):
        process=self.child();generation={'build':'fixture','manifestDigest':'a'*64}
        observer=OwnedExitObservation(process,'session',generation);self.addCleanup(observer.close)
        request={'session':'parent-session','request':'b'*64}
        value=observer.observe(process,request)
        digest=lambda x:hashlib.sha256(json.dumps(x,sort_keys=True,separators=(',',':')).encode()).hexdigest()
        self.assertEqual(value['generationIdentity'],digest(generation))
        self.assertEqual(value['requestBindingDigest'],digest(request))
        self.assertEqual(value['creatorOwnership'],'RETAINED_POPEN_OBJECT')
        self.assertNotEqual(value['requestBindingDigest'],observer.observe(process,{'request':'c'*64})['requestBindingDigest'])


if __name__=='__main__':unittest.main()
