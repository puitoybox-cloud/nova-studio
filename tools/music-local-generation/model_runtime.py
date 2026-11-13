"""One verified CPU model pair per host process; no request or KV state cached."""
import json
import threading
from pathlib import Path

_LOCK = threading.Lock()
_cached = None


def fingerprint(paths):
    # ctime catches replacement/edit even when mtime is restored. This is a
    # local-file reuse guard; SHA-256 remains the initial identity authority.
    return tuple((str(p), s.st_dev, s.st_ino, s.st_size, s.st_mtime_ns, s.st_ctime_ns)
                 for p in paths for s in [p.stat()])


def load_runtime(weights, manifest, digest, rt, cancel=None):
    global _cached
    weights = Path(weights).resolve(strict=True)
    paths = [weights / name for name in manifest['files']]
    check = cancel or (lambda: None)
    with _LOCK:
        check()
        try:
            signature = (json.dumps(manifest, sort_keys=True), fingerprint(paths))
            if _cached and _cached[0] == signature:
                return _cached[1], True
            # Release previous sessions before constructing a replacement pair.
            _cached = None
            for name, expected in manifest['files'].items():
                check()
                if digest(weights / name) != expected['sha256']:
                    raise ValueError('model identity mismatch: ' + name)
            config = json.loads((weights / 'config.json').read_text())
            options = rt.SessionOptions()
            options.intra_op_num_threads = 2
            options.inter_op_num_threads = 1
            models = []
            for name in ['base', 'token']:
                check()
                models.append(rt.InferenceSession(str(weights / ('model_' + name + '.onnx')),
                              sess_options=options, providers=['CPUExecutionProvider']))
            check()
            if signature != (json.dumps(manifest, sort_keys=True), fingerprint(paths)):
                raise ValueError('model files changed during load')
            runtime = (tuple(models), config)
            _cached = (signature, runtime)
            return runtime, False
        except BaseException:
            _cached = None
            raise
