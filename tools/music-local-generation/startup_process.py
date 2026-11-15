"""Bound startup probes to owned process groups, including failed native loaders."""
import os
from pathlib import Path
import signal
import subprocess
import tempfile
import time


def _live_group_members(group):
    """Darwin may retain a zombie-only group and reject killpg with EPERM.

    Never equate EPERM with successful cleanup: inspect the OS process table,
    and require every remaining member to be a zombie (no runnable descendant).
    ps failure is a cleanup failure, not evidence of an empty group.
    """
    if Path('/proc/self/stat').exists():
        rows = []
        for entry in Path('/proc').iterdir():
            if not entry.name.isdigit():
                continue
            try:
                # comm may contain spaces or parentheses; fields after its last
                # closing parenthesis start with state, ppid, process group.
                fields = (entry / 'stat').read_text().rsplit(')', 1)[1].split()
                rows.append(f'{entry.name} {fields[2]} {entry.stat().st_uid} {fields[0]}')
            except FileNotFoundError:
                continue  # Process exited during the snapshot.
        table = '\n'.join(rows)
    else:
        table = subprocess.check_output(
            ['ps', '-axo', 'pid=,pgid=,uid=,stat='], text=True, timeout=5)
    members = []
    for line in table.splitlines():
        fields = line.split()
        if len(fields) != 4:
            raise RuntimeError('startup-probe-invalid-process-table')
        pid, pgid, uid, status = fields
        if int(pgid) == group and not status.startswith('Z'):
            if int(uid) != os.getuid():
                raise PermissionError('startup-probe-foreign-process-group')
            members.append(int(pid))
    return members


def _terminate_group(child):
    def send(sig):
        # Check before signalling a group whose leader may already be reaped.
        if not _live_group_members(child.pid):
            return
        try:
            os.killpg(child.pid, sig)
        except ProcessLookupError:
            pass
        except PermissionError:
            # The group can become zombie-only between ps and killpg on macOS.
            if _live_group_members(child.pid):
                raise

    try:
        send(signal.SIGTERM)
        deadline = time.monotonic() + 1
        while _live_group_members(child.pid) and time.monotonic() < deadline:
            child.poll()
            time.sleep(.02)
        send(signal.SIGKILL)
        child.wait(timeout=5)
        deadline = time.monotonic() + 5
        while _live_group_members(child.pid):
            if time.monotonic() >= deadline:
                raise RuntimeError('startup-probe-descendants-survived')
            time.sleep(.02)
    finally:
        # Always reap the direct child, even when descendant inspection fails.
        if child.poll() is None:
            child.kill()
        child.wait(timeout=5)


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
            try:
                _terminate_group(child)
            finally:
                for sig, handler in previous.items():
                    signal.signal(sig, handler)
