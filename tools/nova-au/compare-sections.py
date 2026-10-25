#!/usr/bin/env python3
"""Read-only, gain-independent section comparison of aligned stereo float32 renders.
No source separation, intelligibility score or subjective quality claim is made.
Use PCM decoded at the same rate without resampling/time shifting between renders.
"""
import argparse
import json
import pathlib
import subprocess


def compare(original, candidate):
    left, right = original['sections'], candidate['sections']
    if len(left) != len(right) or not left:
        raise ValueError('section alignment mismatch')
    rows = []
    for a, b in zip(left, right):
        x, y = a['measurement'], b['measurement']
        if (a['startFrame'], x['frames'], x['sampleRate']) != (b['startFrame'], y['frames'], y['sampleRate']):
            raise ValueError('section alignment mismatch')
        valid = x['loudnessValid'] and y['loudnessValid']
        rows.append(dict(startFrame=a['startFrame'], frames=x['frames'],
                         loudnessValid=valid,
                         originalLufs=x['integratedLufs'] if x['loudnessValid'] else None,
                         candidateLufs=y['integratedLufs'] if y['loudnessValid'] else None,
                         gainDb=y['integratedLufs']-x['integratedLufs'] if valid else None,
                         crestChangeDb=y['crestDb']-x['crestDb'],
                         candidateTruePeakEstimateDbTP=y['truePeakEstimateDbTP'],
                         candidateClippedSamples=y['clippedSamples']))
    gains = [r['gainDb'] for r in rows if r['loudnessValid']]
    median = sorted(gains)[len(gains)//2] if gains else None
    for row in rows:
        row['gainRelativeToMedianDb'] = row['gainDb']-median if row['loudnessValid'] else None
    return dict(schema=1, sectionSeconds=3, perceptualQualityVerified=False,
                vocalIsolationMeasured=False, intelligibilityMeasured=False,
                note='Aligned nonoverlapping 3-second BS.1770 windows; final short window may be loudness-invalid. Band balance is not vocal clarity. No quality ranking.',
                medianSectionGainDb=median,
                sectionGainVariationDb=max(gains)-min(gains) if gains else None,
                sections=rows)


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--engine', type=pathlib.Path, required=True, help='path to nova-section-meter (separate from the production render executable)')
    p.add_argument('--rate', type=int, choices=(44100,48000,96000), required=True)
    p.add_argument('original', type=pathlib.Path)
    p.add_argument('candidate', type=pathlib.Path)
    a = p.parse_args()
    def measure(path):
        return json.loads(subprocess.check_output([str(a.engine.resolve()), 'sections', str(path), str(a.rate)], text=True))
    print(json.dumps(compare(measure(a.original), measure(a.candidate)), indent=2, allow_nan=False))


if __name__ == '__main__':
    main()
