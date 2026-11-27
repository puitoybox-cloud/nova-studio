"""Evaluate Basic Pitch on GuitarSet performer 01 mono-mic performances."""

import argparse
import json
from pathlib import Path
import shutil
import sys
from tempfile import TemporaryDirectory
from time import perf_counter
from zipfile import ZipFile

import mir_eval
import numpy as np
import pretty_midi

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools/music-audio-pipeline'))
from server import process_transcription


def reference_notes(annotation):
    return [(row['time'],row['time']+row['duration'],row['value'])
            for track in annotation['annotations'] if track['namespace']=='note_midi'
            for row in track['data'] if row['duration']>0]


def compare(expected, detected):
    expected=np.asarray(expected,dtype=float).reshape(-1,3)
    detected=np.asarray(detected,dtype=float).reshape(-1,3)
    match=mir_eval.transcription.match_notes(
        expected[:,:2],pretty_midi.note_number_to_hz(expected[:,2]),
        detected[:,:2],pretty_midi.note_number_to_hz(detected[:,2]),
        onset_tolerance=.075,offset_ratio=None)
    return {
        'referenceNotes':len(expected),'detectedNotes':len(detected),'matchedNotes':len(match),
        'f1':round(2*len(match)/(len(expected)+len(detected)),4),
        'unmatchedReferenceNotes':len(expected)-len(match),
        'unmatchedDetectedNotes':len(detected)-len(match),
        'matchedMedianOnsetErrorMs':round(1000*np.median([
            abs(expected[i,0]-detected[j,0]) for i,j in match]),2) if match else None,
    }


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('annotations',type=Path)
    parser.add_argument('waveforms',type=Path)
    args=parser.parse_args()
    with ZipFile(args.annotations) as annotations, ZipFile(args.waveforms) as waveforms, TemporaryDirectory() as work:
        work=Path(work)
        audio_names={Path(name).stem:name for name in waveforms.namelist() if name.endswith('.wav')}
        records=[]
        for style in ('BN','Jazz'):
            for part in ('solo','comp'):
                candidates=sorted(name for name in annotations.namelist()
                    if Path(name).name.startswith(f'01_{style}') and name.endswith(f'_{part}.jams')
                    and Path(name).stem+'_mic' in audio_names)
                if not candidates:
                    raise ValueError(f'missing GuitarSet performance: {style} {part}')
                name=candidates[0]
                expected=reference_notes(json.loads(annotations.read(name)))
                wav=work/'sample.wav'
                with waveforms.open(audio_names[Path(name).stem+'_mic']) as source,wav.open('wb') as output:
                    shutil.copyfileobj(source,output)
                for mode in ('monophonic','polyphonic'):
                    start=perf_counter()
                    result=process_transcription(wav,work,mode,'guitar')
                    elapsed=perf_counter()-start
                    parsed=pretty_midi.PrettyMIDI(str(work/result['midiFileName']))
                    detected=[(note.start,note.end,note.pitch) for track in parsed.instruments for note in track.notes]
                    records.append({'recording':Path(name).stem,'instrument':'guitar','mode':mode,
                                    'inferenceSeconds':round(elapsed,3),**compare(expected,detected)})
        print(json.dumps({'dataset':'GuitarSet 1.1.0','source':'https://zenodo.org/records/3371780',
            'comparison':'Pitch and onset within 75 ms, note offsets excluded; mono mode on the same recordings is a diagnostic comparison.',
            'humanCorrectionSeconds':None,'records':records},indent=2))

if __name__=='__main__':
    main()
