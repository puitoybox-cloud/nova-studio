"""Actual child-process readiness/reaping. Not physical native app acceptance."""
import subprocess
import sys
import unittest
from native_launch import ready, stop, ORIGIN


class NativeLaunch(unittest.TestCase):
    def child(self, text):
        child = subprocess.Popen([sys.executable, '-u', '-c', text], stdout=subprocess.PIPE)
        def cleanup():
            if child.poll() is None: child.kill()
            child.wait()
            child.stdout.close()
        self.addCleanup(cleanup)
        return child

    def test_ready_requires_exact_owned_stdout_and_reaps(self):
        child = self.child('import time; print(' + repr(ORIGIN + '/music-studio.html') + '); time.sleep(20)')
        ready(child, 2); stop(child)
        self.assertIsNotNone(child.poll())

    def test_foreign_origin_and_timeout_cannot_start_ui(self):
        child = self.child('import time; print("http://example.com/music-studio.html"); time.sleep(20)')
        with self.assertRaises(TimeoutError): ready(child, .1)
        stop(child)

    def test_early_exit_is_not_readiness(self):
        child = self.child('print("failed")')
        with self.assertRaises(RuntimeError): ready(child, 2)

    def test_output_budget_is_bounded(self):
        child = self.child('import time; print("x"*40000); time.sleep(20)')
        with self.assertRaises(ValueError): ready(child, 2)
        stop(child)


if __name__ == '__main__': unittest.main()
