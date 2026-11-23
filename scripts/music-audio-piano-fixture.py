"""Render a deterministic piano-triad fixture from the bundled NOVA piano sample."""
import argparse
from pathlib import Path

import numpy as np
import soundfile as sf
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('output', type=Path)
args = parser.parse_args()
sample_path = Path(__file__).resolve().parents[1] / 'assets/music-acoustic-v1/piano-60.wav'
source, rate = sf.read(sample_path, always_2d=True)
source = source.mean(axis=1)
clip = np.zeros(int(rate * 4.5))
for onset, chord in [(0.25, [60,64,67]), (1.5, [62,65,69]), (2.75, [60,64,67])]:
    for pitch in chord:
        at = int(onset*rate)
        sample = np.interp(np.arange(int(rate*.85))*2**((pitch-60)/12), np.arange(len(source)), source, right=0)
        sample *= np.minimum(1, np.arange(len(sample))[::-1]/(rate*.08))
        clip[at:at+len(sample)] += sample * (.6 if pitch == chord[0] else .4)
sf.write(args.output, clip, rate)
