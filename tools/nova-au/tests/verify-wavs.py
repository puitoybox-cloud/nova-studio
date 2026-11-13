"""Decode the exact exported IEEE float WAV bytes and verify correspondence and RMS matching."""
import hashlib, json, math, pathlib, struct, sys
for directory in sys.argv[1:]:
    root = pathlib.Path(directory)
    manifest = json.loads((root/'manifest.json').read_text())
    levels = []
    for row in manifest['renders']:
        for suffix in ['', '-rms-matched']:
            path = root/(row['label']+suffix+'.wav')
            data = path.read_bytes()
            assert hashlib.sha256(data).hexdigest() == row['sha256'+suffix]
            assert data[:4] == b'RIFF' and data[8:16] == b'WAVEfmt '
            assert struct.unpack_from('<I', data, 4)[0] == len(data)-8
            encoding, channels, rate = struct.unpack_from('<HHI', data, 20)
            assert encoding == 3 and channels == 2 and rate == manifest['sampleRate']
            samples = struct.unpack('<'+'f'*((len(data)-44)//4), data[44:])
            assert len(samples) == manifest['frames']*2 and all(math.isfinite(x) for x in samples)
            level = math.sqrt(sum(x*x for x in samples)/len(samples))
            if suffix: levels.append(level)
            else: assert abs(level-row['measurement']['rms']) < 1e-8
    assert max(levels)-min(levels) < 1e-7
    print(root.name, '8 WAVs decoded, sample alignment, hashes and RMS matching PASS')
