"""Own one Sinsy process group until completion, cancellation or deadline."""
from startup_process import _terminate_group
import subprocess
import tempfile
import time


def run_synthesis(command, cancel=None, timeout=120):
    # A file avoids pipe backpressure; only a bounded tail enters error messages.
    # This directory is ephemeral and is never a project or output destination.
    with tempfile.TemporaryFile() as errors:
        if cancel: cancel()
        child = subprocess.Popen(command, stdout=subprocess.DEVNULL, stderr=errors,
                                 start_new_session=True)
        try:
            deadline = time.monotonic() + timeout
            while True:
                if cancel: cancel()
                remaining = deadline - time.monotonic()
                if remaining <= 0: raise TimeoutError('sing-process-deadline-exceeded')
                try:
                    code = child.wait(timeout=min(.1, remaining))
                    break
                except subprocess.TimeoutExpired:
                    continue
            if cancel: cancel()
            if code:
                errors.seek(0, os.SEEK_END)
                errors.seek(max(0, errors.tell() - 2048))
                raise RuntimeError('sing-process-failed: ' + errors.read(2048).decode('utf-8', errors='replace'))
        finally:
            # Reap even on cancellation/errors. Terminate the whole owned group,
            # including descendants that outlive a normally exited group leader.
            _terminate_group(child)
