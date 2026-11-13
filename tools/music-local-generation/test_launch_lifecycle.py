"""Real process regressions for launcher shutdown; no models or providers."""
import os
import signal
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path
from launch import run_engine

HERE = Path(__file__).resolve().parent


class LaunchLifecycle(unittest.TestCase):
    def test_exit_code_and_independent_working_directory(self):
        self.assertEqual(run_engine([sys.executable, '-c',
            'import os,sys; sys.exit(7 if os.getcwd() == sys.argv[1] else 9)', str(HERE)]), 7)

    def test_ignored_term_is_bounded_and_reaped(self):
        with tempfile.TemporaryDirectory() as directory:
            marker = Path(directory) / 'pid'
            child_code = ('import os,signal,time,pathlib; '
                          'signal.signal(signal.SIGTERM, signal.SIG_IGN); '
                          'pathlib.Path(' + repr(str(marker)) + ').write_text(str(os.getpid())); '
                          'time.sleep(60)')
            wrapper = 'from launch import run_engine; import sys; sys.exit(run_engine(' + repr([sys.executable, '-c', child_code]) + '))'
            parent = subprocess.Popen([sys.executable, '-c', wrapper], cwd=HERE)
            try:
                deadline = time.monotonic() + 5
                while not marker.exists() and time.monotonic() < deadline:
                    time.sleep(.02)
                self.assertTrue(marker.exists())
                pid = int(marker.read_text())
                parent.send_signal(signal.SIGTERM)
                self.assertEqual(parent.wait(timeout=8), 143)
                with self.assertRaises(ProcessLookupError): os.kill(pid, 0)
            finally:
                if parent.poll() is None:
                    parent.kill(); parent.wait()
                    if marker.exists():
                        try: os.killpg(int(marker.read_text()), signal.SIGKILL)
                        except ProcessLookupError: pass


if __name__ == '__main__': unittest.main()
