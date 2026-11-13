"""Cache lifecycle/integrity regressions. Fake sessions are not real ONNX proof."""
import hashlib
import json
import os
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock
import model_runtime as runtime


class RuntimeTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(); self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.files = {'model_base.onnx': b'base', 'model_token.onnx': b'token', 'config.json': b'{}'}
        for name, data in self.files.items(): (self.root / name).write_bytes(data)
        self.manifest = {'files': {name: {'sha256': hashlib.sha256(data).hexdigest()} for name, data in self.files.items()}}
        self.digest = Mock(side_effect=lambda p: hashlib.sha256(p.read_bytes()).hexdigest())
        self.rt = SimpleNamespace(SessionOptions=SimpleNamespace, InferenceSession=Mock(side_effect=lambda *a, **k: object()))
        runtime._cached = None
        self.addCleanup(lambda: setattr(runtime, '_cached', None))

    def load(self, **kw): return runtime.load_runtime(self.root, self.manifest, self.digest, self.rt, **kw)

    def test_reuses_only_models_not_request_state(self):
        first, reused = self.load(); self.assertFalse(reused)
        second, reused = self.load(); self.assertTrue(reused); self.assertIs(first, second)
        self.assertEqual(self.rt.InferenceSession.call_count, 2)
        self.assertEqual(self.digest.call_count, 3)

    def test_edit_with_restored_mtime_rejected(self):
        self.load(); p = self.root / 'model_base.onnx'; before = p.stat()
        p.write_bytes(b'evil'); os.utime(p, ns=(before.st_atime_ns, before.st_mtime_ns))
        with self.assertRaisesRegex(ValueError, 'identity mismatch'): self.load()
        self.assertIsNone(runtime._cached)

    def test_same_bytes_replacement_reverified(self):
        self.load(); p = self.root / 'model_token.onnx'
        temp = self.root / 'replacement'; temp.write_bytes(b'token'); temp.replace(p)
        _, reused = self.load(); self.assertFalse(reused)
        self.assertEqual(self.digest.call_count, 6)

    def test_missing_file_does_not_reuse(self):
        self.load(); (self.root / 'config.json').unlink()
        with self.assertRaises(FileNotFoundError): self.load()
        self.assertIsNone(runtime._cached)

    def test_cancel_before_cache_hit_and_during_load(self):
        self.load()
        def cancel(): raise InterruptedError('cancelled')
        with self.assertRaises(InterruptedError): self.load(cancel=cancel)
        runtime._cached = None
        count = 0
        def later():
            nonlocal count
            count += 1
            if count == 6: raise InterruptedError('cancelled')
        with self.assertRaises(InterruptedError): self.load(cancel=later)
        self.assertIsNone(runtime._cached)

    def test_session_failure_not_cached(self):
        self.rt.InferenceSession.side_effect = RuntimeError('load failed')
        with self.assertRaises(RuntimeError): self.load()
        self.assertIsNone(runtime._cached)

    def test_file_mutation_during_session_load_rejected(self):
        def mutate(*args, **kwargs):
            (self.root / 'config.json').write_text('{"changed":true}')
            return object()
        self.rt.InferenceSession.side_effect = mutate
        with self.assertRaisesRegex(ValueError, 'changed during load'): self.load()
        self.assertIsNone(runtime._cached)


if __name__ == '__main__': unittest.main()
