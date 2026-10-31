"""Network-free integrity and transient-failure regression tests."""
import hashlib
import importlib.util
import io
import tempfile
import unittest
import urllib.error
from pathlib import Path
from unittest.mock import patch
spec = importlib.util.spec_from_file_location('prepare', Path(__file__).with_name('prepare.py'))
prepare = importlib.util.module_from_spec(spec)
spec.loader.exec_module(prepare)

class DownloadTests(unittest.TestCase):
    def test_retry_publishes_only_verified_bytes(self):
        data = b'licensed archive'
        with tempfile.TemporaryDirectory() as temp:
            target = Path(temp) / 'archive'
            with patch.object(prepare.urllib.request, 'urlopen', side_effect=[urllib.error.URLError('timeout'), io.BytesIO(data)]) as request, patch.object(prepare.time, 'sleep'):
                prepare.download('https://example.invalid/fixed', target, hashlib.sha256(data).hexdigest())
            self.assertEqual(request.call_count, 2)
            self.assertEqual(target.read_bytes(), data)
            self.assertFalse(target.with_name('archive.partial').exists())

    def test_hash_mismatch_is_not_retried_or_published(self):
        with tempfile.TemporaryDirectory() as temp:
            target = Path(temp) / 'archive'
            with patch.object(prepare.urllib.request, 'urlopen', return_value=io.BytesIO(b'tampered')) as request:
                with self.assertRaisesRegex(ValueError, 'identity mismatch'):
                    prepare.download('https://example.invalid/fixed', target, '0'*64)
            self.assertEqual(request.call_count, 1)
            self.assertFalse(target.exists())
            self.assertFalse(target.with_name('archive.partial').exists())

    def test_exhaustion_cleans_partial(self):
        with tempfile.TemporaryDirectory() as temp:
            target = Path(temp) / 'archive'
            with patch.object(prepare.urllib.request, 'urlopen', side_effect=TimeoutError), patch.object(prepare.time, 'sleep'):
                with self.assertRaises(TimeoutError): prepare.download('https://example.invalid/fixed', target, '0'*64)
            self.assertFalse(target.exists())
            self.assertFalse(target.with_name('archive.partial').exists())

if __name__ == '__main__': unittest.main()
