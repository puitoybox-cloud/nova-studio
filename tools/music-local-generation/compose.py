"""Offline, fixed-identity SkyTNT ONNX A/B/C composer. Never downloads at runtime."""
import argparse
import hashlib
import json
import struct
from pathlib import Path


def digest(path):
    h = hashlib.sha256()
    with open(path, 'rb') as stream:
        for block in iter(lambda: stream.read(1048576), b''): h.update(block)
    return h.hexdigest()


def vlq(n):
    if not 0 <= n <= 0xfffffff: raise ValueError('MIDI time outside standard bound')
    out = [n & 127]; n >>= 7
    while n: out.insert(0, (n & 127) | 128); n >>= 7
    return bytes(out)


def midi_bytes(score):
    tracks = []; notes = 0
    for track in score[1:]:
        events = []
        for e in track:
            name, tick = e[:2]
            if name == 'note':
                duration, channel, pitch, velocity = e[2:]
                if duration <= 0 or velocity <= 0: continue
                events += [(tick, 1, bytes([0x90 | channel, pitch, velocity])), (tick + duration, 0, bytes([0x80 | channel, pitch, 0]))]; notes += 1
            elif name == 'patch_change': events.append((tick, 0, bytes([0xc0 | e[2], e[3]])))
            elif name == 'control_change': events.append((tick, 0, bytes([0xb0 | e[2], e[3], e[4]])))
            elif name == 'set_tempo': events.append((tick, 0, b'\xff\x51\x03' + int(e[2]).to_bytes(3, 'big')))
            elif name == 'time_signature': events.append((tick, 0, b'\xff\x58\x04' + bytes(e[2:])))
            elif name == 'key_signature': events.append((tick, 0, b'\xff\x59\x02' + bytes([e[2] & 255, e[3]])))
        data = bytearray(); last = 0
        for tick, _, value in sorted(events, key=lambda e: (e[0], e[1])):
            data.extend(vlq(tick - last) + value); last = tick
        data.extend(b'\x00\xff\x2f\x00'); tracks.append(b'MTrk' + struct.pack('>I', len(data)) + data)
    if not notes: raise ValueError('model produced no audible notes; generation incomplete')
    return b'MThd' + struct.pack('>IHHH', 6, 1, len(tracks), score[0]) + b''.join(tracks), notes


def compose(weights, output, seed=72, events=128, bpm=72, max_ticks=7680):
    import numpy as np
    import onnxruntime as rt
    from vendor.midi_tokenizer import MIDITokenizer
    from vendor.onnx_generate import generate
    if type(max_ticks) is not int or not 120 <= max_ticks <= 122880: raise ValueError('invalid-range-ticks')
    if not 8 <= events <= 512 or not 30 <= bpm <= 300 or not 0 <= seed <= 2147483645: raise ValueError('generation settings outside bounds')
    weights, output = Path(weights), Path(output)
    manifest = json.loads((Path(__file__).parent / 'model-lock.json').read_text())
    for name, expected in manifest['files'].items():
        if digest(weights / name) != expected['sha256']: raise ValueError('model identity mismatch: ' + name)
    config = json.loads((weights / 'config.json').read_text())
    tokenizer = MIDITokenizer('v2'); tokenizer.set_optimise_midi(True)
    if config['tokenizer'] != tokenizer.to_dict(): raise ValueError('tokenizer configuration mismatch')
    opt = rt.SessionOptions(); opt.intra_op_num_threads = 2; opt.inter_op_num_threads = 1
    models = [rt.InferenceSession(str(weights / ('model_' + n + '.onnx')), sess_options=opt, providers=['CPUExecutionProvider']) for n in ['base', 'token']]
    output.mkdir(parents=True, exist_ok=False)
    result = {'format': 'nova-local-model-candidates', 'version': 1, 'model': manifest['model'], 'revision': manifest['revision'], 'license': 'Apache-2.0', 'runtime': rt.__version__, 'provider': 'CPUExecutionProvider', 'synthetic': False, 'maxTicks': max_ticks, 'postprocess': 'clip-to-selected-range', 'candidates': []}
    prompt = [[tokenizer.bos_id] + [tokenizer.pad_id] * 7, tokenizer.event2tokens(['set_tempo', 0, 0, 0, bpm]), tokenizer.event2tokens(['patch_change', 0, 0, 0, 0, 0])]
    prompt = np.asarray(prompt, dtype=np.int64)
    for index, variant in enumerate('ABC'):
        rows = list(prompt)
        for row in generate((*models, tokenizer), prompt=prompt, max_len=events + len(prompt), generator=np.random.default_rng(seed + index), disable_patch_change=True, disable_control_change=True, disable_channels=list(range(1,16))):
            rows.append(row[0])
        score = tokenizer.detokenize(rows)
        for i, track in enumerate(score[1:], 1):
            score[i] = [e for e in track if e[1] < max_ticks]
            for e in score[i]:
                if e[0] == 'note': e[2] = min(e[2], max_ticks - e[1])
        data, notes = midi_bytes(score); name = variant + '.mid'
        (output / name).write_bytes(data)
        result['candidates'].append({'variant': variant, 'seed': seed + index, 'file': name, 'sha256': hashlib.sha256(data).hexdigest(), 'byteLength': len(data), 'notes': notes, 'midiBase64': __import__('base64').b64encode(data).decode('ascii')})
    (output / 'candidates.json').write_text(json.dumps(result, indent=2) + '\n')
    return result


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--weights', required=True); p.add_argument('--output', required=True)
    p.add_argument('--max-ticks', type=int, default=7680)
    p.add_argument('--seed', type=int, default=72); p.add_argument('--events', type=int, default=128); p.add_argument('--bpm', type=int, default=72)
    print(json.dumps(compose(**vars(p.parse_args())), indent=2))
