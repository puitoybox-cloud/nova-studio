"""Render the published piano sample into an eight-second chord test WAV."""
import argparse
from array import array
from pathlib import Path
import sys
import wave

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('output', type=Path)
output = parser.parse_args().output
source = Path(__file__).resolve().parents[1] / 'assets/music-acoustic-v1/piano-60.wav'
with wave.open(str(source)) as wav:
    assert wav.getnchannels() == 1 and wav.getsampwidth() == 2
    rate = wav.getframerate()
    sample = array('h', wav.readframes(wav.getnframes()))
if sys.byteorder != 'little':
    sample.byteswap()
frames = [0.0] * (rate * 8)
for start, end, notes in [(0,2,[48,60,64,67]),(2,4,[45,57,60,64]),(4,5,[43,55,59,62,65]),(5,6,[52,60,62,67])]:
    for voice, note in enumerate(notes):
        ratio = 2 ** ((note - 60) / 12)
        gain = 0.27 if voice == 0 else 0.2
        for index in range(rate * (end - start)):
            position = index * ratio
            left = int(position)
            if left + 1 >= len(sample):
                break
            fraction = position - left
            frames[rate * start + index] += gain * (sample[left] * (1-fraction) + sample[left+1] * fraction)
pcm = array('h', (max(-32768,min(32767,int(value))) for value in frames))
if sys.byteorder != 'little':
    pcm.byteswap()
with wave.open(str(output),'wb') as wav:
    wav.setparams((1,2,rate,0,'NONE','not compressed'))
    wav.writeframes(pcm.tobytes())
