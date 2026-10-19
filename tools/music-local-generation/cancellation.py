"""Bounded, process-local request cancellation; no durable generation data."""
import re
import threading
import time


class ComposerJobs:
    def __init__(self):
        self.lock = threading.Lock()
        self.jobs = {}

    def _entry(self, request_id):
        if not isinstance(request_id, str) or not re.fullmatch(r'[A-Za-z0-9_-]{16,80}', request_id):
            raise ValueError('invalid-compose-request-id')
        now = time.monotonic()
        for key, entry in list(self.jobs.items()):
            if not entry['running'] and entry['expires'] < now:
                del self.jobs[key]
        if request_id not in self.jobs:
            if len(self.jobs) >= 1024:
                raise ValueError('compose-request-registry-full')
            self.jobs[request_id] = {'cancelled': threading.Event(), 'running': False, 'started': False, 'expires': now + 600}
        return self.jobs[request_id]

    def cancel(self, request_id):
        with self.lock:
            entry = self._entry(request_id)
            # Tombstones reject a compose request that arrives after its cancellation.
            entry['cancelled'].set()

    def begin(self, request_id):
        with self.lock:
            entry = self._entry(request_id)
            if entry['started'] or entry['cancelled'].is_set():
                raise ValueError('compose-request-cancelled-or-reused')
            entry['started'] = entry['running'] = True
        def check():
            if entry['cancelled'].is_set():
                raise ValueError('compose-request-cancelled')
        return check

    def finish(self, request_id):
        if not isinstance(request_id, str): return
        with self.lock:
            entry = self.jobs.get(request_id)
            if entry:
                entry['running'] = False
                entry['expires'] = time.monotonic() + 600
