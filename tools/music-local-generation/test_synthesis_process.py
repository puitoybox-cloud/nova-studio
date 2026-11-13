"""Actual OS children verify cancellation/reaping, without claiming model output."""
import os
import signal
import sys
import tempfile
import threading
import time
import unittest
from pathlib import Path
from cancellation import ComposerJobs
from synthesis_process import run_synthesis


class SynthesisProcess(unittest.TestCase):
    def test_success_and_bounded_failure(self):
        run_synthesis([sys.executable, '-c', 'print("ok")'])
        with self.assertRaisesRegex(RuntimeError, 'sing-process-failed') as error:
            run_synthesis([sys.executable, '-c', 'import sys;sys.stderr.write("x"*100000);sys.exit(2)'])
        self.assertLess(len(str(error.exception)), 2100)

    def test_cancel_before_launch_preserves_output(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / 'original'; target.write_text('original')
            def cancel(): raise ValueError('sing-request-cancelled')
            with self.assertRaisesRegex(ValueError, 'cancelled'):
                run_synthesis([sys.executable, '-c', f'open({str(target)!r},"w").write("changed")'], cancel)
            self.assertEqual(target.read_text(), 'original')

    def test_deadline_terminates_and_reaps_child(self):
        with tempfile.TemporaryDirectory() as directory:
            pidfile = Path(directory) / 'pid'
            command = [sys.executable, '-c', f'import os,time;open({str(pidfile)!r},"w").write(str(os.getpid()));time.sleep(30)']
            with self.assertRaisesRegex(TimeoutError, 'deadline'):
                run_synthesis(command, timeout=.4)
            with self.assertRaises(ProcessLookupError): os.kill(int(pidfile.read_text()), 0)

    def test_cancel_running_and_next_request_succeeds(self):
        jobs = ComposerJobs(kind='sing', timeout=10); key='sing_process_active_123'
        check=jobs.begin(key)
        with tempfile.TemporaryDirectory() as directory:
            pidfile=Path(directory)/'pid'; failures=[]
            def run():
                try: run_synthesis([sys.executable,'-c',f'import os,time;open({str(pidfile)!r},"w").write(str(os.getpid()));time.sleep(30)'],check)
                except Exception as error: failures.append(error)
                finally: jobs.finish(key)
            thread=threading.Thread(target=run);thread.start()
            try:
                deadline=time.monotonic()+3
                while not pidfile.exists() and time.monotonic()<deadline: time.sleep(.01)
                self.assertTrue(pidfile.exists());jobs.cancel(key);thread.join(3)
                self.assertFalse(thread.is_alive());self.assertIn('sing-request-cancelled',str(failures[0]))
                with self.assertRaises(ProcessLookupError): os.kill(int(pidfile.read_text()),0)
            finally: jobs.cancel(key);thread.join(3)
        jobs.begin('sing_next_process_123')()
        run_synthesis([sys.executable,'-c','pass'])

    def test_unresponsive_child_is_killed(self):
        with tempfile.TemporaryDirectory() as directory:
            pidfile=Path(directory)/'pid'
            with self.assertRaises(TimeoutError):
                run_synthesis([sys.executable,'-c',f'import os,signal,time;signal.signal(signal.SIGTERM,signal.SIG_IGN);open({str(pidfile)!r},"w").write(str(os.getpid()));time.sleep(30)'],timeout=.4)
            with self.assertRaises(ProcessLookupError): os.kill(int(pidfile.read_text()),0)


if __name__ == '__main__': unittest.main()
