"""Bounded SHA-256 with process-local receipts. Disk cache is never a trust source.

Stat identity only invalidates a digest receipt produced by this verifier. A new
process, corrupted/partial receipt, or changed trust inputs always hashes again.
No absolute paths or stat identifiers are returned in public evidence.
"""
import hashlib
import os
import stat
import threading
from pathlib import Path

ALGORITHM = 'sha256-stream-v1'
CHUNK_BYTES = 65536
MAX_BYTES = 8 * 1024**3


class Cancelled(ValueError):
    pass


def stamp(value):
    return (value.st_dev, value.st_ino, value.st_size, value.st_mtime_ns, value.st_ctime_ns)


def resolve(root, relative):
    root = Path(root).resolve()
    rel = Path(relative)
    if rel.is_absolute() or '..' in rel.parts or not rel.parts:
        raise ValueError('unsafe-artifact-path')
    current = root
    for part in rel.parts:
        current /= part
        if current.is_symlink():
            raise ValueError('unsafe-artifact-path')
    if not current.resolve().is_relative_to(root):
        raise ValueError('unsafe-artifact-path')
    return current


class ArtifactVerifier:
    def __init__(self, capacity=128):
        if type(capacity) is not int or not 0 < capacity <= 4096:
            raise ValueError('cache-budget')
        self.capacity = capacity
        self._cache = {}
        self._issued = {}
        self._lock = threading.RLock()

    def verify(self, root, relative, expected, maximum=MAX_BYTES, *, identity=None,
               version='1', build='UNSPECIFIED', algorithm=ALGORITHM, cancel=None,
               opener=None):
        digest = expected.get('digest')
        size = expected.get('byteLength')
        if (not isinstance(digest, str) or len(digest) != 64 or
                any(c not in '0123456789abcdef' for c in digest) or
                type(size) is not int or not 0 < size <= maximum <= MAX_BYTES or
                algorithm != ALGORITHM):
            raise ValueError('artifact-budget-or-identity')
        logical = identity or expected.get('id') or relative
        if any(not isinstance(v, str) or not v for v in (logical, version, build)):
            raise ValueError('artifact-trust-input')
        path = resolve(root, relative)
        key = (str(path), logical, digest, size, version, build, algorithm)
        def check_cancel():
            if cancel is not None and cancel():
                raise Cancelled('artifact-verification-cancelled')
        with self._lock:
            check_cancel()
            before = path.stat()
            if not stat.S_ISREG(before.st_mode) or before.st_size != size:
                self._cache.pop(key, None)
                self._issued.pop(key, None)
                raise ValueError('artifact-size-or-type')
            cached = self._cache.get(key)
            issued = self._issued.get(key)
            # A public/copied/corrupt cache object cannot supply a fresh receipt.
            hit = cached is not None and cached is issued and cached[0] == stamp(before)
            if not hit:
                self._cache.pop(key, None)
                self._issued.pop(key, None)
                total = 0
                value = hashlib.sha256()
                if opener is None:
                    fd = os.open(path, os.O_RDONLY | getattr(os, 'O_NOFOLLOW', 0))
                    stream = os.fdopen(fd, 'rb')
                else:
                    stream = opener(path)
                with stream:
                    if stamp(os.fstat(stream.fileno())) != stamp(before):
                        raise ValueError('artifact-replaced-before-read')
                    while True:
                        check_cancel()
                        chunk = stream.read(CHUNK_BYTES)
                        if not chunk:
                            break
                        total += len(chunk)
                        if len(chunk) > CHUNK_BYTES or total > maximum or total > size:
                            raise ValueError('artifact-stream-budget')
                        value.update(chunk)
                    check_cancel()
                    if (total != size or value.hexdigest() != digest or
                            stamp(os.fstat(stream.fileno())) != stamp(before)):
                        raise ValueError('artifact-digest-or-read-race')
                if stamp(path.stat()) != stamp(before):
                    raise ValueError('artifact-replaced-after-read')
                receipt = (stamp(before), digest)
                if len(self._cache) >= self.capacity:
                    self._cache.clear(); self._issued.clear()
                self._cache[key] = receipt
                self._issued[key] = receipt
            check_cancel()
            if stamp(path.stat()) != stamp(before):
                self._cache.pop(key, None); self._issued.pop(key, None)
                raise ValueError('stale-artifact-receipt')
            return {'id': logical, 'digest': digest, 'byteLength': size,
                    'version': version, 'buildRevision': build, 'algorithm': algorithm,
                    'status': 'VERIFIED_ARTIFACT', 'cache': 'HIT' if hit else 'MISS',
                    'cacheScope': 'PROCESS_LOCAL_DIGEST_RECEIPT', 'chunkBytes': CHUNK_BYTES}


VERIFIER = ArtifactVerifier()
