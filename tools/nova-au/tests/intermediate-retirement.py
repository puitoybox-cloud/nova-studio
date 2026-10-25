#!/usr/bin/env python3
"""Retirement never deletes retained audio; crash intent survives restart."""
import importlib.util
import pathlib
import tempfile
from unittest.mock import patch
root = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('whole', root / 'whole-song.py')
w = importlib.util.module_from_spec(spec)
spec.loader.exec_module(w)
with tempfile.TemporaryDirectory() as tmp:
    folder = pathlib.Path(tmp)
    names = ['source.f32'] + [label + suffix for label in 'ABC' for suffix in ('-trial.f32', '.f32')]
    retained = ['adopted.wav'] + [label + suffix for label in ('original', 'A', 'B', 'C') for suffix in ('.wav', '-lufs-matched.wav')]
    for name in names + retained:
        (folder / name).write_bytes(name.encode() * 100)
    hashes = {name: w.sha(folder / name) for name in names + retained}
    manifest = dict(complete=True, artifacts=hashes.copy(), history=[dict(operation='adopt', approved=True)])
    real_unlink = pathlib.Path.unlink
    def fail_unlink(path, *args, **kwargs):
        if path.name == 'B.f32':
            raise OSError('simulated interrupted cleanup')
        return real_unlink(path, *args, **kwargs)
    with patch.object(pathlib.Path, 'unlink', fail_unlink):
        try:
            w.retire_intermediates(folder, manifest)
            raise AssertionError('cleanup failure ignored')
        except OSError:
            pass
    import json
    saved = json.loads((folder / 'manifest.json').read_text())
    assert saved['complete'] and set(saved['artifacts']) == set(retained)
    assert len(saved['retiredIntermediates']) == 7
    # Changed pending content must survive; never delete unrecognized data.
    path = folder / 'B.f32'
    content = path.read_bytes()
    path.write_bytes(b'changed')
    try:
        w.retire_intermediates(folder, saved)
        raise AssertionError('changed pending file deleted')
    except ValueError:
        assert path.read_bytes() == b'changed'
    path.write_bytes(content)
    w.retire_intermediates(folder, saved)
    assert all(not (folder / name).exists() for name in names)
    assert all(w.sha(folder / name) == hashes[name] for name in retained)
    assert saved['intermediateBytesRetired'] == sum(len(name.encode()) * 100 for name in names)
    assert saved['history'] == manifest['history']
    w.retire_intermediates(folder, saved)
    for hostile in ('original.wav', '../outside.wav'):
        saved['retiredIntermediates'][hostile] = dict(sha256=hashes['original.wav'], bytes=1)
        try:
            w.retire_intermediates(folder, saved)
            raise AssertionError('non-intermediate retirement accepted')
        except ValueError:
            assert w.sha(folder / 'original.wav') == hashes['original.wav']
        del saved['retiredIntermediates'][hostile]
print('intermediate retirement crash/restart/hash/retained-audio/history/idempotence PASS')
