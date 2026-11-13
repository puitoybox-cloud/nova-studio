"""Transfer boundary tests with WAV fixtures; these are not model quality tests."""
import base64
import tempfile
import unittest
import wave
from pathlib import Path
from unittest.mock import patch
import server

class StemTransferTests(unittest.TestCase):
    def write(self, root, name, frames=100):
        with wave.open(str(root / (name+'.wav')), 'wb') as wav:
            wav.setnchannels(2); wav.setsampwidth(2); wav.setframerate(44100)
            wav.writeframes(b'\0' * frames * 4)

    def test_exact_six_outputs_are_hashed_and_ordered(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp)
            for name in server.STEM_NAMES: self.write(root,name)
            result=server.separated_wav_payload(root)
            self.assertEqual([r['name'] for r in result],list(server.STEM_NAMES))
            for item in result:
                raw=base64.b64decode(item['wavBase64'])
                self.assertEqual(len(raw),item['byteLength'])
                self.assertEqual(server.hashlib.sha256(raw).hexdigest(),item['sha256'])

    def test_missing_timeline_mismatch_and_total_budget_fail_closed(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp)
            for name in server.STEM_NAMES: self.write(root,name)
            with patch.object(server,'STEM_TRANSFER_LIMIT',100):
                with self.assertRaisesRegex(ValueError,'transfer-limit'): server.separated_wav_payload(root)
            self.write(root,'other',101)
            with self.assertRaisesRegex(ValueError,'timeline'): server.separated_wav_payload(root)
            (root/'other.wav').unlink()
            with self.assertRaisesRegex(ValueError,'missing'): server.separated_wav_payload(root)

    def test_native_session_rejects_unbound_new_output_before_inference(self):
        with patch.object(server,'STRICT_BOOTSTRAP',True),patch.object(server,'run_demucs') as demucs,patch.object(server,'transcribe_pitched_stem') as pitch:
            for method in (server.process_stems,server.process_transcription):
                with self.assertRaisesRegex(ValueError,'receipt-not-supported'): method(Path('source.wav'),Path('out'))
            demucs.assert_not_called();pitch.assert_not_called()
