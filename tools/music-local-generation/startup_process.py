"""Bound startup probes to owned process groups, including failed native loaders."""
import os
import signal
import subprocess
import tempfile
import time


def probe(command, timeout):
    """Return bounded diagnostics; reap descendants on success, failure and timeout."""
    with tempfile.TemporaryFile() as output, tempfile.TemporaryFile() as errors:
        child = subprocess.Popen(command, stdout=output, stderr=errors,
                                 start_new_session=True)
        previous = {}
        def interrupted(signum, frame):
            raise SystemExit(128 + signum)
        try:
            for sig in (signal.SIGINT, signal.SIGTERM):
                previous[sig] = signal.signal(sig, interrupted)
            deadline = time.monotonic() + timeout
            while True:
                if any(os.fstat(stream.fileno()).st_size > 1024 * 1024 for stream in (output, errors)):
                    raise ValueError("startup-probe-output-budget-exceeded")
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    raise TimeoutError('startup-probe-deadline-exceeded')
                try:
                    code = child.wait(timeout=min(.1, remaining))
                    break
                except subprocess.TimeoutExpired:
                    pass
            if any(os.fstat(stream.fileno()).st_size > 1024 * 1024 for stream in (output, errors)):
                raise ValueError("startup-probe-output-budget-exceeded")
            if code:
                errors.seek(0, os.SEEK_END)
                errors.seek(max(0, errors.tell() - 2048))
                raise ValueError('Startup probe failed: ' + errors.read(2048).decode('utf-8', errors='replace'))
        finally:
            def terminate(sig):
                try: os.killpg(child.pid, sig)
                except ProcessLookupError: pass
            terminate(signal.SIGTERM)
            try: child.wait(timeout=1)
            except subprocess.TimeoutExpired:
                terminate(signal.SIGKILL)
                child.wait()
            finally:
                terminate(signal.SIGKILL)
                for sig, handler in previous.items(): signal.signal(sig, handler)
