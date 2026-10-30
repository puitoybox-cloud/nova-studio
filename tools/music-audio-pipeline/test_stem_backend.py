"""Exercise the real child adapter with disposable dispatch modules, not ML assets."""
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import Mock, patch
import demucs_child


class StemBackendTests(unittest.TestCase):
    def test_wav_preserves_encoding_and_forces_declared_backend(self):
        save = Mock(return_value='written')
        tensor = object()
        self.assertEqual(demucs_child.soundfile_only_save(save, 'stem.wav', tensor,
            sample_rate=44100, encoding='PCM_S', bits_per_sample=16), 'written')
        save.assert_called_once_with('stem.wav', tensor, sample_rate=44100,
            encoding='PCM_S', bits_per_sample=16, backend='soundfile')

    def test_remote_other_formats_and_backend_rejected_before_write(self):
        for path, kwargs in [('https://example.invalid/stem.wav', {}),
                ('stem.mp3', {}), ('stem.flac', {}), ('stem.wav', {'backend':'ffmpeg'}),
                ('stem.wav', {'backend':'sox'})]:
            with self.subTest(path=path, kwargs=kwargs):
                save = Mock()
                with self.assertRaises(ValueError):
                    demucs_child.soundfile_only_save(save, path, object(), **kwargs)
                save.assert_not_called()

    def test_unavailable_backend_fails_without_retry(self):
        save = Mock(side_effect=RuntimeError('soundfile unavailable'))
        with self.assertRaises(RuntimeError):
            demucs_child.soundfile_only_save(save, 'stem.wav', object())
        self.assertEqual(save.call_count, 1)

    def run_child(self, fail=False, changed_at=None):
        separate = types.ModuleType('demucs.separate')
        package = types.ModuleType('demucs'); package.separate = separate
        audio = types.ModuleType('demucs.audio'); audio.convert_audio = Mock()
        sf = types.ModuleType('soundfile'); sf.write = Mock(return_value=None)
        ta = types.ModuleType('torchaudio'); ta.load = Mock()
        tensor = object()
        def dispatch(path, samples, **kwargs):
            self.assertIs(samples, tensor)
            self.assertEqual(kwargs['backend'], 'soundfile')
            # Represents the upstream soundfile dispatcher edge; no real backend claim.
            sf.write(file=path, data=samples, samplerate=kwargs['sample_rate'])
            if fail: raise RuntimeError('disposable encoder failure')
        ta.save = dispatch
        separate.get_model_from_args = Mock(); separate.load_track = Mock()
        separate.apply_model = Mock()
        separate.save_audio = lambda samples, path: ta.save(str(path), samples, sample_rate=44100)
        separate.main = lambda argv: separate.save_audio(tensor, Path('output/stem.wav'))
        receipt = Mock()
        receipt.call.side_effect = lambda stage, name, fn, *args, **kwargs: fn(
            *args, **{k:v for k,v in kwargs.items() if k != 'native_ids'})
        codec = {'version':'fixture', 'nativeIds':['fixture-codec']}
        originals = [separate.get_model_from_args, separate.load_track, separate.save_audio,
                     separate.apply_model, sf.write, ta.save]
        modules = {'demucs':package, 'demucs.separate':separate, 'demucs.audio':audio,
                   'soundfile':sf, 'torchaudio':ta}
        checks=[]
        def recheck():
            checks.append('recheck')
            if len(checks)==changed_at:raise ValueError('changed-child-writer-inventory')
        with patch.dict(sys.modules, modules):
            if changed_at is not None:
                with self.assertRaisesRegex(ValueError,'changed-child-writer-inventory'):
                    demucs_child.process(object(), {'modelName':'fixture', 'repository':'repo'},
                        Path('input.wav'),Path('output'),codec,receipt,recheck=recheck)
                originals[4].assert_not_called()
                self.assertEqual(len(checks),changed_at)
            elif fail:
                with self.assertRaises(RuntimeError):
                    demucs_child.process(object(), {'modelName':'fixture', 'repository':'repo'},
                        Path('input.wav'), Path('output'), codec, receipt)
            else:
                demucs_child.process(object(), {'modelName':'fixture', 'repository':'repo'},
                    Path('input.wav'), Path('output'), codec, receipt)
        actual = [separate.get_model_from_args, separate.load_track, separate.save_audio,
                  separate.apply_model, sf.write, ta.save]
        for expected, observed in zip(originals, actual): self.assertIs(observed, expected)
        names = [call.args[1] for call in receipt.call.call_args_list]
        if changed_at is None:self.assertEqual(names, ['demucs-stem-writer', 'soundfile-output'])
        else:self.assertEqual(names, [] if changed_at==1 else ['demucs-stem-writer'])

    def test_runtime_mutation_blocks_outer_and_concrete_wav_writer(self):
        for boundary in (1,2):
            with self.subTest(boundary=boundary):self.run_child(changed_at=boundary)

    def test_strict_actual_child_dispatch_and_restoration(self):
        self.run_child()

    def test_strict_child_failure_restores_all_dispatchers(self):
        self.run_child(fail=True)


if __name__ == '__main__': unittest.main()
