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

    def test_three_gateway_errors_then_verified_success(self):
        data = b'fixed Python archive'
        with tempfile.TemporaryDirectory() as temp:
            target = Path(temp) / 'python.tar.gz'
            errors = [urllib.error.HTTPError('https://example.invalid/fixed', 504, 'Gateway', {}, None) for _ in range(3)]
            with patch.object(prepare.urllib.request, 'urlopen', side_effect=errors+[io.BytesIO(data)]) as request, patch.object(prepare.time, 'sleep') as sleep:
                prepare.download('https://example.invalid/fixed', target, hashlib.sha256(data).hexdigest())
            self.assertEqual(request.call_count, 4)
            self.assertEqual([c.args[0] for c in sleep.call_args_list], [2,4,8])
            self.assertEqual(target.read_bytes(), data)

    def test_permanent_http_error_is_not_retried(self):
        with tempfile.TemporaryDirectory() as temp:
            target = Path(temp) / 'archive'
            error = urllib.error.HTTPError('https://example.invalid/fixed', 404, 'Missing', {}, None)
            with patch.object(prepare.urllib.request, 'urlopen', side_effect=error) as request, patch.object(prepare.time, 'sleep') as sleep:
                with self.assertRaises(urllib.error.HTTPError): prepare.download('https://example.invalid/fixed', target, '0'*64)
            self.assertEqual(request.call_count, 1)
            sleep.assert_not_called()
            self.assertFalse(target.exists())

    def test_partial_body_is_removed_before_retry(self):
        class Cut(io.BytesIO):
            def read(self, size=-1):
                raise prepare.http.client.IncompleteRead(b'partial', 99)
        data = b'complete archive'
        with tempfile.TemporaryDirectory() as temp:
            target = Path(temp) / 'archive'
            with patch.object(prepare.urllib.request, 'urlopen', side_effect=[Cut(), io.BytesIO(data)]), patch.object(prepare.time, 'sleep'):
                prepare.download('https://example.invalid/fixed', target, hashlib.sha256(data).hexdigest())
            self.assertEqual(target.read_bytes(), data)
            self.assertFalse(target.with_name('archive.partial').exists())

if __name__ == '__main__': unittest.main()
