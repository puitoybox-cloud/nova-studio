"""Offline, fixed-identity SkyTNT ONNX A/B/C composer. Never downloads at runtime."""
import argparse
import hashlib
import json
import struct
import re
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


KEYS = {'C':0,'C#':1,'Db':1,'D':2,'D#':3,'Eb':3,'E':4,'F':5,'F#':6,'Gb':6,'G':7,'G#':8,'Ab':8,'A':9,'A#':10,'Bb':10,'B':11}
STYLES = {'balanced': (1.0, .98, 20), 'gentle': (.8, .9, 12), 'varied': (1.15, .99, 32)}


# Deliberately finite vocabulary. No language model or implicit genre guarantee.
MOODS = {'優しい': 'gentle', '切ない': 'gentle', '明るい': 'varied',
         'gentle': 'gentle', 'sad': 'gentle', 'bright': 'varied'}
GENRES = {'ballad': 'gentle', 'バラード': 'gentle', 'pop': 'balanced', 'ポップ': 'balanced'}
CHORDS = {'': (0,4,7), 'm': (0,3,7), '7': (0,4,7,10),
          'maj7': (0,4,7,11), 'm7': (0,3,7,10), 'dim': (0,3,6), 'sus4': (0,5,7)}

def interpret_request(description='', genre='', style='balanced', chords=''):
    if not isinstance(description, str) or len(description) > 120: raise ValueError('invalid-description')
    if not isinstance(genre, str) or genre not in ['', *GENRES]: raise ValueError('unsupported-genre')
    words = [w for w in re.split(r'[\s、,]+', description.strip()) if w]
    if any(w not in MOODS for w in words): raise ValueError('unsupported-description: use 優しい / 切ない / 明るい')
    mapped = {MOODS[w] for w in words}
    if len(mapped) > 1: raise ValueError('conflicting-moods')
    selected = next(iter(mapped), GENRES.get(genre, style))
    if selected not in STYLES: raise ValueError('unsupported-style')
    if not isinstance(chords, str) or len(chords) > 256: raise ValueError('invalid-chords')
    names = [n for n in re.split(r'[\s,|→]+', chords.strip()) if n]
    if len(names) > 32: raise ValueError('too-many-chords')
    parsed = []
    for name in names:
        match = re.fullmatch(r'([A-G](?:#|b)?)(maj7|m7|sus4|dim|m|7)?', name)
        if not match or match[1] not in KEYS: raise ValueError('unsupported-chord: ' + name)
        parsed.append({(KEYS[match[1]] + n) % 12 for n in CHORDS[match[2] or '']})
    return selected, names, parsed


def constraints(key=None, pitch_min=48, pitch_max=84, numerator=4, denominator=4, style='balanced'):
    if key is not None and (not isinstance(key, str) or key.removesuffix('m') not in KEYS): raise ValueError('unsupported-key')
    if type(pitch_min) is not int or type(pitch_max) is not int or not 0 <= pitch_min <= pitch_max <= 127: raise ValueError('invalid-pitch-range')
    if type(numerator) is not int or not 1 <= numerator <= 12 or type(denominator) is not int or denominator not in [2,4,8,16]: raise ValueError('unsupported-meter')
    if style not in STYLES: raise ValueError('unsupported-style')
    scale = None if key is None else {(KEYS[key.removesuffix('m')] + n) % 12 for n in ([0,2,3,5,7,8,10] if key.endswith('m') else [0,2,4,5,7,9,11])}
    allowed = [n for n in range(pitch_min, pitch_max+1) if scale is None or n % 12 in scale]
    if not allowed: raise ValueError('no-scale-note-in-range')
    return allowed


def constrain_score(score, *, key=None, pitch_min=48, pitch_max=84, numerator=4, denominator=4, style='balanced', bpm=72, chord_sets=None):
    # Explicit postprocessing of real inference, never presented as model conditioning.
    allowed = constraints(key, pitch_min, pitch_max, numerator, denominator, style)
    changed = 0
    chord_sets = chord_sets or []
    measure_ticks = score[0] * 4 * numerator // denominator
    chord_allowed = [[n for n in range(pitch_min, pitch_max+1) if n % 12 in chord] for chord in chord_sets]
    if any(not notes for notes in chord_allowed): raise ValueError('no-chord-note-in-range')
    for track in score[1:]:
        track[:] = [e for e in track if e[0] not in ['set_tempo','time_signature','key_signature']]
        for event in track:
            if event[0] == 'note':
                old = event[4]
                choices = chord_allowed[(event[1] // measure_ticks) % len(chord_allowed)] if chord_allowed else allowed
                event[4] = min(choices, key=lambda n: (abs(n-old), n))
                changed += int(old != event[4])
    score[1].extend([['set_tempo',0,round(60000000/bpm)], ['time_signature',0,numerator,denominator.bit_length()-1,24,8]])
    return changed


def source_notes(value, max_ticks):
    if value is None: return []
    if not isinstance(value, list) or not 1 <= len(value) <= 64: raise ValueError('invalid-source-notes')
    result = []
    for note in value:
        if not isinstance(note, dict) or set(note) != {'pitch', 'velocity', 'startTick', 'durationTicks'}: raise ValueError('invalid-source-note')
        if any(type(v) is not int for v in note.values()): raise ValueError('invalid-source-note-integer')
        if not 0 <= note['pitch'] <= 127 or not 1 <= note['velocity'] <= 127 or not 0 <= note['startTick'] < max_ticks or not 1 <= note['durationTicks'] <= max_ticks-note['startTick']: raise ValueError('invalid-source-note-boundary')
        result.append(['note',note['startTick'],note['durationTicks'],0,note['pitch'],note['velocity']])
    return sorted(result, key=lambda e: (e[1], e[4]))


def remove_prompt_notes(score, prompt_score):
    # Both scores use the same tokenizer Track/channel allocation. Prefix notes
    # are removed by event order, never by pitch matching or a guessed timestamp.
    for index, track in enumerate(score[1:], 1):
        count = sum(e[0] == 'note' for e in prompt_score[index]) if index < len(prompt_score) else 0
        kept = []
        for e in track:
            if e[0] == 'note' and count:
                count -= 1
            else: kept.append(e)
        track[:] = kept
    first = min((e[1] for track in score[1:] for e in track if e[0] == 'note'), default=None)
    if first is None: raise ValueError('model produced no new source-conditioned notes')
    for track in score[1:]:
        for e in track: e[1] = max(0, e[1]-first)
    return score


def compose(weights, output, seed=72, events=128, bpm=72, max_ticks=7680, key=None, pitch_min=48, pitch_max=84, numerator=4, denominator=4, style='balanced', description='', genre='', chords='', sourceNotes=None):
    style, chord_names, chord_sets = interpret_request(description, genre, style, chords)
    constraints(key, pitch_min, pitch_max, numerator, denominator, style)
    import numpy as np
    import onnxruntime as rt
    from vendor.midi_tokenizer import MIDITokenizer
    from vendor.onnx_generate import generate
    if type(max_ticks) is not int or not 120 <= max_ticks <= 122880: raise ValueError('invalid-range-ticks')
    if not 8 <= events <= 512 or not 30 <= bpm <= 300 or not 0 <= seed <= 2147483645: raise ValueError('generation settings outside bounds')
    source = source_notes(sourceNotes, max_ticks)
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
    if source:
        prompt = tokenizer.tokenize([480, [['set_tempo',0,round(60000000/bpm)], ['patch_change',0,0,0], *source]])
        if prompt[-1][0] == tokenizer.eos_id: prompt = prompt[:-1]
        result['sourceConditioning'] = {'method':'source-prefix-then-rebase-continuation', 'notes':len(source), 'limit':64, 'freeText':False}
    prompt = np.asarray(prompt, dtype=np.int64)
    prompt_score = tokenizer.detokenize(prompt) if source else None
    for index, variant in enumerate('ABC'):
        rows = list(prompt)
        for row in generate((*models, tokenizer), prompt=prompt, max_len=events + len(prompt), generator=np.random.default_rng(seed + index), temp=STYLES[style][0], top_p=STYLES[style][1], top_k=STYLES[style][2], disable_patch_change=True, disable_control_change=True, disable_channels=list(range(1,16))):
            rows.append(row[0])
        score = tokenizer.detokenize(rows)
        if source: remove_prompt_notes(score, prompt_score)
        for i, track in enumerate(score[1:], 1):
            score[i] = [e for e in track if e[1] < max_ticks]
            for e in score[i]:
                if e[0] == 'note': e[2] = min(e[2], max_ticks - e[1])
        adjusted = constrain_score(score, key=key, pitch_min=pitch_min, pitch_max=pitch_max, numerator=numerator, denominator=denominator, style=style, bpm=bpm, chord_sets=chord_sets)
        data, notes = midi_bytes(score); name = variant + '.mid'
        (output / name).write_bytes(data)
        result['candidates'].append({'variant': variant, 'seed': seed + index, 'file': name, 'sha256': hashlib.sha256(data).hexdigest(), 'byteLength': len(data), 'notes': notes, 'adjustedNotes': adjusted, 'constraints': {'key': key, 'pitchMin': pitch_min, 'pitchMax': pitch_max, 'numerator': numerator, 'denominator': denominator, 'bpm': bpm, 'style': style, 'description': description, 'genre': genre, 'chords': chord_names, 'chordTiming': 'one-chord-per-measure-repeat-from-selection-start', 'method': 'model-sampling-and-explicit-chord-or-scale-range-projection'}, 'midiBase64': __import__('base64').b64encode(data).decode('ascii')})
    (output / 'candidates.json').write_text(json.dumps(result, indent=2) + '\n')
    return result


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--weights', required=True); p.add_argument('--output', required=True)
    p.add_argument('--max-ticks', type=int, default=7680)
    p.add_argument('--seed', type=int, default=72); p.add_argument('--events', type=int, default=128); p.add_argument('--bpm', type=int, default=72)
    print(json.dumps(compose(**vars(p.parse_args())), indent=2))
