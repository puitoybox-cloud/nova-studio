"""Real OS process regressions; no model or native acceptance claim."""
import os
from pathlib import Path
import signal
import subprocess
import sys
import tempfile
import time
import unittest
from startup_process import probe


class StartupProcessTests(unittest.TestCase):
    def test_failure_preserves_only_bounded_error_tail(self):
        with self.assertRaises(ValueError) as caught:
            probe([sys.executable, '-c', "import sys;sys.stderr.write('x'*100000+'TAIL');sys.exit(7)"], 5)
        self.assertTrue(str(caught.exception).endswith('TAIL'))
        self.assertLess(len(str(caught.exception)), 2100)

    def test_output_budget_rejects_successful_noisy_child(self):
        with self.assertRaisesRegex(ValueError, "output-budget"):
            probe([sys.executable, "-c", "import sys;sys.stdout.write('x'*2000000)"], 5)

    def test_success_and_timeout_kill_descendants(self):
        for timeout in (False, True):
            with self.subTest(timeout=timeout), tempfile.TemporaryDirectory() as tmp:
                marker = Path(tmp) / 'escaped'
                grandchild = 'import time;from pathlib import Path;time.sleep(1);Path(' + repr(str(marker)) + ').touch()'
                parent = 'import subprocess,sys,time;subprocess.Popen([sys.executable,"-c",' + repr(grandchild) + ']);' + ('time.sleep(20)' if timeout else '')
                if timeout:
                    with self.assertRaises(TimeoutError): probe([sys.executable, '-c', parent], .2)
                else:
                    probe([sys.executable, '-c', parent], 5)
                time.sleep(1.1)
                self.assertFalse(marker.exists())

    def test_signal_stops_probe_and_its_child(self):
        with tempfile.TemporaryDirectory() as tmp:
            marker = Path(tmp) / 'escaped'
            ready = Path(tmp) / 'ready'
            worker = 'import time;from pathlib import Path;Path(' + repr(str(ready)) + ').touch();time.sleep(2);Path(' + repr(str(marker)) + ').touch()'
            parent = 'from startup_process import probe;import sys;probe([sys.executable,"-c",' + repr(worker) + '],20)'
            child = subprocess.Popen([sys.executable, '-c', parent], cwd=Path(__file__).parent)
            try:
                deadline = time.monotonic() + 5
                while not ready.exists() and time.monotonic() < deadline: time.sleep(.02)
                self.assertTrue(ready.exists())
                child.send_signal(signal.SIGTERM)
                self.assertEqual(child.wait(timeout=5), 128 + signal.SIGTERM)
                time.sleep(2.1)
                self.assertFalse(marker.exists())
            finally:
                if child.poll() is None: child.kill(); child.wait()


if __name__ == '__main__': unittest.main()
